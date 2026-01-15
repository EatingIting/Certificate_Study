import {
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  MoreHorizontal,
  Phone,
  Send,
  Share,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import "pretendard/dist/web/static/pretendard.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";
import "./MeetingPage.css";

// --- Components ---

const ButtonControl = ({ active, danger, disabled, icon: Icon, onClick, label }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`btn-control ${danger ? "danger" : ""} ${active ? "active" : ""} ${
      disabled ? "disabled" : ""
    }`}
    title={label}
  >
    <Icon size={20} strokeWidth={2.5} />
    <span className="tooltip">{label}</span>
  </button>
);

const UserAvatar = ({ name, size = "md", src }) => {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  if (src) return <img src={src} alt={name} className={`user-avatar ${size}`} />;

  return <div className={`user-avatar ${size} placeholder`}>{initials}</div>;
};

const VideoTile = ({ user, isMain = false, stream }) => {
  const videoEl = useRef(null);

  const safeUser = user ?? {
    name: "대기 중",
    isMe: false,
    muted: true,
    cameraOff: true,
    speaking: false,
  };

  const mediaAvailable = !!stream;
  const canShowVideo = mediaAvailable;

  useEffect(() => {
    const v = videoEl.current;
    if (!v) return;

    if (!canShowVideo) {
      v.srcObject = null;
      return;
    }

    // ✅추가: srcObject 교체 시 한번 리셋(브라우저별 black frame 방지)
    if (v.srcObject !== stream) {
      v.srcObject = null; // ✅추가
      v.srcObject = stream;

      v.playsInline = true;
      v.muted = true; // (오디오는 별도 Audio로 재생 중)

      // ✅추가: loadedmetadata 이후 play 재시도
      const tryPlay = () => {
        v.play().catch((e) => {
          // autoplay 정책/타이밍 이슈 대응
          console.warn("Auto-play blocked or timing issue:", e);
        });
      };

      v.onloadedmetadata = () => {
        tryPlay();
      };

      // ✅추가: metadata 이전에도 1회 시도
      tryPlay();
    }
  }, [canShowVideo, stream]);

  return (
    <div className={`video-tile ${isMain ? "main" : ""} ${safeUser.speaking ? "speaking" : ""}`}>
      <div className="video-content">
        {canShowVideo ? (
          <video ref={videoEl} autoPlay playsInline muted className="video-element" />
        ) : (
          <div className="camera-off-placeholder">
            <UserAvatar name={safeUser.name} size={isMain ? "lg" : "md"} />
            <p className="stream-label">{safeUser.name}</p>
          </div>
        )}
      </div>

      <div className="video-overlay">
        {safeUser.muted && <MicOff size={14} />}
        {safeUser.cameraOff && <VideoOff size={14} />}
      </div>
    </div>
  );
};

// --- Main App Component ---

function MeetingPage() {
  const { roomId } = useParams();
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    if (loggedRef.current) return;

    console.log("[CLIENT] roomId from URL =", roomId);
    loggedRef.current = true;
  }, [roomId]);

  const [layoutMode, setLayoutMode] = useState("speaker");

  const [sidebarView, setSidebarView] = useState(() => {
    return sessionStorage.getItem("sidebarView") || "chat";
  });

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return sessionStorage.getItem("sidebarOpen") === "true";
  });

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [micPermission, setMicPermission] = useState("prompt");
  const [camPermission, setCamPermission] = useState("prompt");

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const [streamVersion, setStreamVersion] = useState(0);

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`chat_${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [participantCount, setParticipantCount] = useState(1); //참가자 수 SFU서버에서 가져옴

  const [chatDraft, setChatDraft] = useState("");

  const [showReactions, setShowReactions] = useState(false);
  const [myReaction, setMyReaction] = useState(null);

  const wsRef = useRef(null);
  const sfuWsRef = useRef(null);

  const sfuDeviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);

  const pendingProducersRef = useRef([]);

  const consumersRef = useRef(new Map()); // producerId -> Consumer
  const peerStreamsRef = useRef(new Map()); // peerId -> MediaStream

  const producersRef = useRef(new Map()); // ✅추가: kind(or track.id) -> Producer

  const audioElsRef = useRef(new Map());

  const userIdRef = useRef(null);
  const userNameRef = useRef(null);

  const effectAliveRef = useRef(true);

  const chatEndRef = useRef(null); //채팅 자동 스크롤

  // const restoredRef = useRef(false); //새로고침 채팅 복원

  const lastSpeakingRef = useRef(null);

  if (!userIdRef.current) {
    const savedId = localStorage.getItem("stableUserId");
    const savedName = localStorage.getItem("stableUserName");

    const id = savedId || crypto.randomUUID();
    const name = savedName || `User-${id.slice(0, 4)}`;

    localStorage.setItem("stableUserId", id);
    localStorage.setItem("stableUserName", name);

    userIdRef.current = id;
    userNameRef.current = name;
  }

  const userId = userIdRef.current;
  const userName = userNameRef.current;

  const hasAudioTrack = localStream?.getAudioTracks().length > 0;
  const hasVideoTrack = localStream?.getVideoTracks().length > 0;

  const micMuted = !hasAudioTrack || !micOn;
  const camMuted = !hasVideoTrack || !camOn;

  const micDisabled = micPermission !== "granted";
  const camDisabled = camPermission !== "granted";

  const reactionEmojis = useMemo(
    () => ["👍", "👏", "❤️", "🎉", "😂", "😮", "😢", "🤔", "👋", "🔥", "👀", "💯", "✨", "🙏", "🤝", "🙌"],
    []
  );

  const me = {
    id: userId,
    name: userName,
    muted: micMuted,
    cameraOff: camMuted,
    speaking: isSpeaking,
    isMe: true,
    stream: localStream,
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;

    wsRef.current?.send(
      JSON.stringify({
        type: "CHAT",
        message: chatDraft,
      })
    );

    setChatDraft("");
  };

  const handleReaction = (emoji) => {
    setMyReaction(emoji);
    setShowReactions(false);
    setTimeout(() => setMyReaction(null), 2500);
  };

  const toggleSidebar = (view) => {
    if (sidebarOpen && sidebarView === view) {
      setSidebarOpen(false);
    } else {
      setSidebarView(view);
      setSidebarOpen(true);
    }
  };

  const getMainUser = () => {
    if (activeSpeakerId === me.id) return me;
    const found = participants.find((p) => p.id === activeSpeakerId);
    if (found) return found;
    if (me) return me;
    if (participants.length > 0) return participants[0];
    return {
      id: "empty",
      name: "대기 중",
      muted: true,
      cameraOff: true,
      speaking: false,
      isMe: false,
    };
  };

  const bumpStreamVersion = () => {
    setStreamVersion((v) => v + 1);
  };

  // --- Local media ---
  const startLocalMedia = async () => {
    if (localStreamRef.current) {
      console.log("[MEDIA] already acquired, skip getUserMedia");
      return localStreamRef.current;
    }

    try {
      console.log("[MEDIA] requesting camera + mic");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      setMicPermission("granted");
      setCamPermission("granted");

      console.log("[MEDIA] media acquired", stream.id);
      return stream;
    } catch (err) {
      console.error("[MEDIA] getUserMedia failed", err);

      setMicPermission("denied");
      setCamPermission("denied");

      return null;
    }
  };

  // --- SFU Functions ---
  const safeSfuSend = (obj) => {
    const ws = sfuWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("SFU WS not open yet, skip send:", obj.action);
      return;
    }
    ws.send(JSON.stringify(obj));
  };

  const ensureParticipant = (peerId) => {
    setParticipants((prev) => {
      const exists = prev.some((p) => p.id === peerId);
      if (exists) return prev;

      return [
        ...prev,
        {
          id: peerId,
          name: `User-${String(peerId).slice(0, 4)}`,
          isMe: false,
          muted: true,
          speaking: false,
          stream: null,
          cameraOff: true,
        },
      ];
    });
  };

  const safeClose = (obj) => {
    if (!obj) return;
    try {
      if (obj.closed) return;
      obj.close();
    } catch (e) {
      console.warn("safeClose ignored:", e?.message);
    }
  };

  const removePeerMedia = (peerId) => {
    // ✅추가: peer 떠나거나 producer 닫힐 때 UI/stream 정리
    peerStreamsRef.current.delete(peerId);

    setParticipants((prev) =>
      prev
        .filter((p) => p.id !== peerId)
        .map((p) =>
          p.id === peerId
            ? { ...p, stream: null, cameraOff: true, muted: true }
            : p
        )
    );
  };

  const consumeProducer = async (producerId, peerId) => {
    if (!producerId || !peerId) return;
    if (peerId === userIdRef.current) return;
    if (consumersRef.current.has(producerId)) return;

    const device = sfuDeviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!device || !recvTransport) {
      pendingProducersRef.current.push({ producerId, peerId });
      return;
    }

    ensureParticipant(peerId);

    const requestId = crypto.randomUUID();

    safeSfuSend({
      action: "consume",
      requestId,
      data: {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
    });

    const handler = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.action !== "consume:response") return;
      if (msg.requestId !== requestId) return;

      const { consumerId, kind, rtpParameters } = msg.data;

      let consumer;
      try {
        consumer = await recvTransport.consume({
          id: consumerId,
          producerId,
          kind,
          rtpParameters,
        });

        consumersRef.current.set(producerId, consumer);

        // 🔥 기존 stream + 새 track 병합
        const prev = peerStreamsRef.current.get(peerId);
        const newStream = new MediaStream();

        if (prev) {
          prev.getTracks().forEach((t) => {
            if (t.readyState !== "ended") newStream.addTrack(t);
          });
        }
        newStream.addTrack(consumer.track);

        peerStreamsRef.current.set(peerId, newStream);
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === peerId
              ? {
                  ...p,
                  stream: newStream,
                  cameraOff: !newStream.getVideoTracks().length,
                }
              : p
          )
        );
        bumpStreamVersion();

        // 🔥 track 종료 시 stream 재구성 (흰 화면 방지)
        consumer.track.onended = () => {
          const cur = peerStreamsRef.current.get(peerId);
          if (!cur) return;

          const alive = cur
            .getTracks()
            .filter((t) => t.readyState !== "ended" && t.id !== consumer.track.id);

          const rebuilt = new MediaStream(alive);
          peerStreamsRef.current.set(peerId, rebuilt);
          bumpStreamVersion();

          setParticipants((prev) =>
            prev.map((p) =>
              p.id === peerId
                ? { ...p, cameraOff: rebuilt.getVideoTracks().length === 0 }
                : p
            )
          );
        };

        // 🔊 오디오 재생
        if (kind === "audio") {
          const audio = new Audio();
          audio.srcObject = new MediaStream([consumer.track]);
          audio.autoplay = true;
          audio.playsInline = true;
          audioElsRef.current.set(producerId, audio);
          audio.play().catch(() => {});
        }

        safeSfuSend({
          action: "resumeConsumer",
          requestId: crypto.randomUUID(),
          data: { consumerId },
        });
      } catch (e) {
        console.error("consume failed", e);
      } finally {
        sfuWsRef.current?.removeEventListener("message", handler);
      }
    };

    sfuWsRef.current.addEventListener("message", handler);
  };

  // --- Hooks ---

  useEffect(() => {
    const init = async () => {
      await startLocalMedia();
    };
    init();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!localStreamRef.current) return;
    const vt = localStreamRef.current.getVideoTracks()[0];
    if (vt) vt.enabled = camOn;

    const at = localStreamRef.current.getAudioTracks()[0];
    if (at) at.enabled = micOn;
  }, [camOn, micOn]);

  useEffect(() => {
    if (!localStream) return;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(localStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let speaking = false;
    const checkVolume = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      if (avg > 20) {
        if (!speaking) {
          speaking = true;
          setIsSpeaking(true);
        }
      } else {
        if (speaking) {
          speaking = false;
          setIsSpeaking(false);
        }
      }
      requestAnimationFrame(checkVolume);
    };
    checkVolume();
    return () => audioContext.close();
  }, [localStream]);

  // 1️⃣ Signaling WebSocket (8080)
  useEffect(() => {
    if (!roomId) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(
      `wss://192.168.35.235:8080/ws/room/${roomId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(
        userName
      )}`
    );

    ws.onopen = () => console.log("✅ WebSocket connected");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "USERS_UPDATE" && Array.isArray(data.users)) {
        setParticipants(prev => {
          const prevMap = new Map(prev.map(p => [p.id, p]));

          return data.users.map(u => {
            const old = prevMap.get(u.userId);

            return {
              id: u.userId,
              name: u.userName,
              isMe: u.userId === userId,

              // ✅ 상태만 갱신
              muted: old?.muted ?? false,
              speaking: old?.speaking ?? false,

              // 🔥 핵심: stream은 절대 여기서 변경 ❌
              stream: old?.stream ?? null,

              cameraOff:
                u.userId === userId
                  ? camMuted
                  : old?.stream
                  ? !old.stream.getVideoTracks().length
                  : true,
            };
          });
        });

        setActiveSpeakerId(prev => {
          const exists = data.users.some(u => u.userId === prev);
          return exists ? prev : data.users[0]?.userId ?? null;
        });
      }

      if (data.type === "CHAT") {
        setMessages((prev) => [
          ...prev,
          {
            id: data.timestamp,
            userId: data.userId,
            userName: data.userName,
            text: data.message,
            time: new Date(data.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isMe: data.userId === userId,
          },
        ]);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [roomId, userId, userName]);

  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) => (p.isMe ? { ...p, muted: micMuted, cameraOff: camMuted, speaking: isSpeaking } : p))
    );
  }, [micMuted, camMuted, isSpeaking]);

  // 2️⃣ SFU WebSocket (4000)
  useEffect(() => {
    effectAliveRef.current = true;

    if (!roomId || !localStream) return;

    const resetSfuLocalState = () => {
      consumersRef.current.clear();
      producersRef.current.clear(); // ✅추가
      peerStreamsRef.current.clear();
      pendingProducersRef.current = [];

      // ✅추가: 오디오 엘리먼트 참조 정리
      audioElsRef.current.forEach((a) => {
        try {
          a.srcObject = null;
        } catch {}
      });
      audioElsRef.current.clear();

      sendTransportRef.current = null;
      recvTransportRef.current = null;
      sfuDeviceRef.current = null;
    };

    resetSfuLocalState();

    const sfuWs = new WebSocket("wss://192.168.35.235:4000");
    sfuWsRef.current = sfuWs;

    const drainPending = async () => {
      if (!recvTransportRef.current || !sfuDeviceRef.current) return;
      const pending = pendingProducersRef.current;
      if (!pending.length) return;

      const uniq = new Map();
      for (const p of pending) uniq.set(p.producerId, p);
      pendingProducersRef.current = [];

      for (const p of uniq.values()) {
        await consumeProducer(p.producerId, p.peerId);
      }
    };

    sfuWs.onopen = () => {
      safeSfuSend({
        action: "join",
        requestId: crypto.randomUUID(),
        data: { roomId, peerId: userId },
      });
    };

    sfuWs.onmessage = async (event) => {
      if (!effectAliveRef.current) return;

      const msg = JSON.parse(event.data);

      if (msg.action === "peerCount") {
        setParticipantCount(msg.data.count);
        return;
      }

      if (msg.action === "join:response") {
        const { rtpCapabilities, existingProducers } = msg.data;

        const device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        sfuDeviceRef.current = device;

        sfuDeviceRef.current._existingProducers = existingProducers || [];

        safeSfuSend({ action: "createTransport", requestId: crypto.randomUUID(), data: { direction: "send" } });
        safeSfuSend({ action: "createTransport", requestId: crypto.randomUUID(), data: { direction: "recv" } });
        return;
      }

      if (msg.action === "createTransport:response") {
        const { transportId, direction, iceParameters, iceCandidates, dtlsParameters } = msg.data;
        const device = sfuDeviceRef.current;
        if (!device) return;

        if (direction === "send") {
          const sendTransport = device.createSendTransport({
            id: transportId,
            iceParameters,
            iceCandidates,
            dtlsParameters,
          });

          sendTransport.on("connect", ({ dtlsParameters }, cb) => {
            const reqId = crypto.randomUUID();
            const handler = (e) => {
              const m = JSON.parse(e.data);
              if (m.action === "connectTransport:response" && m.requestId === reqId) {
                cb();
                sfuWs.removeEventListener("message", handler);
              }
            };
            sfuWs.addEventListener("message", handler);
            safeSfuSend({ action: "connectTransport", requestId: reqId, data: { transportId, dtlsParameters } });
          });

          sendTransport.on("produce", ({ kind, rtpParameters }, cb, errback) => {
            const reqId = crypto.randomUUID();
            const handler = (e) => {
              const m = JSON.parse(e.data);
              if (m.action === "produce:response" && m.requestId === reqId) {
                cb({ id: m.data.producerId });
                sfuWs.removeEventListener("message", handler);
              }
              if (m.action === "produce:error" && m.requestId === reqId) {
                errback(m.error);
                sfuWs.removeEventListener("message", handler);
              }
            };
            sfuWs.addEventListener("message", handler);
            safeSfuSend({ action: "produce", requestId: reqId, data: { transportId, kind, rtpParameters } });
          });

          // ✅수정: Producer 객체를 저장해서 cleanup 시 close 가능하게
          for (const track of localStream.getTracks()) {
            try {
              const producer = await sendTransport.produce({ track }); // ✅수정
              producersRef.current.set(producer.id, producer); // ✅추가
            } catch (e) {
              console.error("produce failed:", e);
            }
          }

          sendTransportRef.current = sendTransport;
        }

        if (direction === "recv") {
          const recvTransport = device.createRecvTransport({
            id: transportId,
            iceParameters,
            iceCandidates,
            dtlsParameters,
          });

          recvTransport.on("connect", ({ dtlsParameters }, cb) => {
            const reqId = crypto.randomUUID();
            const handler = (e) => {
              const m = JSON.parse(e.data);
              if (m.action === "connectTransport:response" && m.requestId === reqId) {
                cb();
                sfuWs.removeEventListener("message", handler);
              }
            };
            sfuWs.addEventListener("message", handler);
            safeSfuSend({ action: "connectTransport", requestId: reqId, data: { transportId, dtlsParameters } });
          });

          recvTransportRef.current = recvTransport;

          const producers = sfuDeviceRef.current?._existingProducers || [];
          for (const p of producers) {
            await consumeProducer(p.producerId, p.peerId);
          }

          await drainPending();
        }

        return;
      }

      if (msg.action === "newProducer") {
        const { producerId, peerId } = msg.data;

        if (!recvTransportRef.current || !sfuDeviceRef.current) {
          pendingProducersRef.current.push({ producerId, peerId });
          return;
        }

        await consumeProducer(producerId, peerId);
        return;
      }

      // ✅추가: 서버가 지원한다면 producerClosed/peerLeft 처리
      if (msg.action === "producerClosed") {
        const { producerId } = msg.data || {};

        if (producerId) {
          const c = consumersRef.current.get(producerId);
          if (c) safeClose(c);
          consumersRef.current.delete(producerId);

          const a = audioElsRef.current.get(producerId);
          if (a) {
            try { a.srcObject = null; } catch {}
            audioElsRef.current.delete(producerId);
          }

          bumpStreamVersion(); // ⭐️ 필수
        }
        return;
      }

      if (msg.action === "peerLeft") {
        const { peerId } = msg.data || {};
        if (peerId) {
          peerStreamsRef.current.delete(peerId);
          bumpStreamVersion();

          setParticipants((prev) =>
            prev.filter((p) => p.id !== peerId)
          );
        }
        return;
      }
    };

    // ✅추가: onclose에서 로컬도 정리(예상치 못한 끊김 대비)
    sfuWs.onclose = () => {
      // 필요 시 재접속 로직을 넣을 수 있지만, 여기서는 정리만 수행
      consumersRef.current.forEach((c) => safeClose(c));
      consumersRef.current.clear();

      producersRef.current.forEach((p) => safeClose(p));
      producersRef.current.clear();

      peerStreamsRef.current.clear();
      pendingProducersRef.current = [];

      audioElsRef.current.forEach((a) => {
        try { a.srcObject = null; } catch {}
      });
      audioElsRef.current.clear();
    };

    return () => {
      effectAliveRef.current = false;

      // ✅추가: 서버가 leave를 지원한다면 먼저 알림
      try {
        safeSfuSend({ action: "leave", requestId: crypto.randomUUID(), data: { roomId, peerId: userId } }); // ✅추가
      } catch {}

      // ✅수정: Producer/Consumer/Transport/Device를 모두 안전하게 닫기
      producersRef.current.forEach((p) => safeClose(p)); // ✅추가
      producersRef.current.clear(); // ✅추가

      consumersRef.current.forEach((c) => safeClose(c));
      consumersRef.current.clear();

      safeClose(sendTransportRef.current); // ✅추가
      safeClose(recvTransportRef.current); // ✅추가
      sendTransportRef.current = null;
      recvTransportRef.current = null;

      safeClose(sfuDeviceRef.current); // ✅추가
      sfuDeviceRef.current = null; // ✅추가

      audioElsRef.current.forEach((a) => {
        try { a.srcObject = null; } catch {}
      });
      audioElsRef.current.clear();

      try {
        sfuWsRef.current?.close();
      } catch {}
      sfuWsRef.current = null;

      peerStreamsRef.current.clear();
      pendingProducersRef.current = [];
    };
  }, [roomId, localStream, userId]);

  useEffect(() => {
    sessionStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    sessionStorage.setItem("sidebarView", sidebarView);
  }, [sidebarView]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(`chat_${roomId}`, JSON.stringify(messages));
  }, [messages, roomId]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // 이전 상태와 동일하면 전송하지 않음
    if (lastSpeakingRef.current === isSpeaking) return;

    lastSpeakingRef.current = isSpeaking;

    wsRef.current.send(
      JSON.stringify({
        type: "SPEAKING",
        speaking: isSpeaking,
      })
    );
  }, [isSpeaking]);

  // --- Render ---
  const mainUser = getMainUser();
  const mainStream =
    mainUser?.id === userId
      ? localStream
      : peerStreamsRef.current.get(mainUser?.id) || null;

  // 🔥 렌더 강제 트리거용 (값은 사용 안 해도 됨)
  const _sv = streamVersion;
  return (
    <>
      <div className="meet-layout">
        <main className="meet-main">
          <div className="meet-header">
            <div className="header-info glass-panel">
              <div className="header-icon">
                <Monitor size={20} />
              </div>
              <div>
                <h1 className="header-title">주간 제품 회의</h1>
                <div className="header-meta">
                  <span>
                    <Users size={10} /> {participantCount}명 접속 중
                  </span>
                  <span className="dot" />
                  <span>00:24:15</span>
                </div>
              </div>
            </div>

            <div className="header-actions glass-panel">
              <button
                onClick={() => setLayoutMode("speaker")}
                className={`view-btn ${layoutMode === "speaker" ? "active" : ""}`}
                title="발표자 보기"
              >
                <Monitor size={18} />
              </button>
              <button
                onClick={() => setLayoutMode("grid")}
                className={`view-btn ${layoutMode === "grid" ? "active" : ""}`}
                title="그리드 보기"
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          <div className="meet-stage">
            {layoutMode === "speaker" ? (
              <div className="layout-speaker">
                <div className="main-stage">
                  <VideoTile user={mainUser} isMain stream={mainStream} />
                </div>
                <div className="bottom-strip custom-scrollbar">
                  <div
                    className={`strip-item ${activeSpeakerId === me.id ? "active-strip" : ""}`}
                    onClick={() => setActiveSpeakerId(me.id)}
                  >
                    <VideoTile user={me} stream={localStream} />
                  </div>
                  {participants
                  .filter((p) => !p.isMe)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`strip-item ${activeSpeakerId === p.id ? "active-strip" : ""}`}
                      onClick={() => setActiveSpeakerId(p.id)}
                    >
                      {/* ✅ 수정: stream은 p.stream만 사용 */}
                      <VideoTile user={p} stream={p.stream ?? null} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="layout-grid custom-scrollbar">
                {participants.map((p) => (
                  <div key={p.id} className="video-tile-wrapper">
                    {/* ✅ stream은 반드시 p.stream */}
                    <VideoTile user={p} stream={p.stream ?? null} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="meet-controls-container">
            {showReactions && (
              <div className="reaction-popup glass-panel">
                {reactionEmojis.map((emoji) => (
                  <button key={emoji} onClick={() => handleReaction(emoji)} className="reaction-btn">
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="controls-toolbar glass-panel">
              <ButtonControl
                label={micOn ? "마이크 끄기" : "마이크 켜기"}
                icon={Mic}
                active={!micOn}
                disabled={micDisabled}
                onClick={() => setMicOn(!micOn)}
              />
              <ButtonControl
                label={camOn ? "카메라 끄기" : "카메라 켜기"}
                icon={Video}
                active={!camOn}
                disabled={camDisabled}
                onClick={() => setCamOn(!camOn)}
              />
              <div className="divider"></div>
              <ButtonControl label="화면 공유" icon={Monitor} onClick={() => {}} />
              <ButtonControl label="반응" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
              <ButtonControl label="채팅" active={sidebarOpen && sidebarView === "chat"} icon={MessageSquare} onClick={() => toggleSidebar("chat")} />
              <ButtonControl label="참여자" active={sidebarOpen && sidebarView === "participants"} icon={Users} onClick={() => toggleSidebar("participants")} />
              <div className="divider"></div>
              <ButtonControl label="통화 종료" danger icon={Phone} onClick={() => alert("통화가 종료되었습니다.")} />
            </div>
          </div>
        </main>

        <aside className={`meet-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-inner">
            <div className="sidebar-header">
              <h2 className="sidebar-title">{sidebarView === "chat" ? "회의 채팅" : "참여자 목록"}</h2>
              <button onClick={() => setSidebarOpen(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>

            {sidebarView === "chat" && (
              <>
                <div className="chat-area custom-scrollbar">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.isMe ? "me" : "others"}`}>
                      <div className="msg-content-wrapper">
                        {!msg.isMe && <UserAvatar name={msg.userName} size="sm" />}
                        <div className="msg-bubble">{msg.text}</div>
                      </div>
                      <span className="msg-time">
                        {msg.userName}, {msg.time}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-area">
                  <form onSubmit={handleSendMessage} className="chat-form">
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="메시지를 입력하세요..."
                      className="chat-input"
                    />
                    <button type="submit" className="send-btn" disabled={!chatDraft.trim()}>
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </>
            )}

            {sidebarView === "participants" && (
              <div className="participants-area custom-scrollbar">
                <div className="section-label">참여 중 ({participants.length})</div>
                {participants.map((p) => (
                  <div key={p.id} className={`participant-card ${p.isMe ? "me" : ""}`}>
                    <div className="p-info">
                      <UserAvatar name={p.name} />
                      <div>
                        <div className={`p-name ${p.isMe ? "me" : ""}`}>
                          {p.name} {p.isMe ? "(나)" : ""}
                        </div>
                        <div className="p-role">{p.isMe ? "나" : "팀원"}</div>
                      </div>
                    </div>
                    <div className="p-status">
                      {p.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} className="icon-hidden" />}
                      {p.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} className="icon-hidden" />}
                      {!p.isMe && (
                        <button className="more-btn">
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="invite-section">
                  <button className="invite-btn">
                    <Share size={16} /> 초대하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export default MeetingPage;
