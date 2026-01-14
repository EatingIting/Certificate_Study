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

  // ✅ user가 없을 때 사용할 안전한 fallback
  const safeUser = user ?? {
    name: '대기 중',
    isMe: false,
    muted: true,
    cameraOff: true,
    speaking: false,
  };

  const mediaAvailable = !!stream;

  const canShowVideo = mediaAvailable;

  useEffect(() => {
    if (!videoEl.current) return;

    if (!canShowVideo) {
      videoEl.current.srcObject = null;
      return;
    }

    videoEl.current.srcObject = stream;
    videoEl.current.play().catch(() => {});
  }, [canShowVideo, stream]);

  return (
    <div className={`video-tile ${isMain ? "main" : ""} ${safeUser.speaking ? "speaking" : ""}`}>
      <div className="video-content">
        {canShowVideo ? (
          <video
            ref={videoEl}
            autoPlay
            playsInline
            muted
            className="video-element"
          />
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

  const [layoutMode, setLayoutMode] = useState("speaker"); // 'speaker' | 'grid'
  const [sidebarView, setSidebarView] = useState("chat"); // 'chat' | 'participants'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // My device state
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [micPermission, setMicPermission] = useState("prompt");
  const [camPermission, setCamPermission] = useState("prompt");

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  // speaking 감지 (내 로컬만)
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 참가자 목록(서버가 내려준 단일 진실)
  const [participants, setParticipants] = useState([]);

  // 발표자(메인) 선택
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  // chat (더미 유지)
  const [messages, setMessages] = useState([
    { id: 1, sender: "김민아", text: "다들 LMS에 올린 기출문제 확인하셨나요??", time: "10:02 AM", isMe: false },
    { id: 2, sender: "박서준", text: "네, 잘 봤습니다! 4번 문제 관련해서 질문이 있어요.", time: "10:03 AM", isMe: false },
    { id: 3, sender: "나", text: "제 화면 공유해서 보여드릴게요.", time: "10:05 AM", isMe: true },
  ]);
  const [chatDraft, setChatDraft] = useState("");

  // reactions (더미 유지)
  const [showReactions, setShowReactions] = useState(false);
  const [myReaction, setMyReaction] = useState(null);

  const wsRef = useRef(null);
  const sfuWsRef = useRef(null);

  const sfuDeviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);

  // producer / consumer 관리
  const consumersRef = useRef(new Map()); // producerId -> MediaStream

  // ✅ 유저 ID / 이름: 탭(시크릿 포함)마다 고유
  const userIdRef = useRef(null);
  const userNameRef = useRef(null);

  if (!userIdRef.current) {
    const id = crypto.randomUUID();
    userIdRef.current = id;
    userNameRef.current = `User-${id.slice(0, 4)}`;
  }

  const userId = userIdRef.current;
  const userName = userNameRef.current;

  // --- Derived flags ---
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
  };

  // --- UI handlers ---
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "나",
        text: chatDraft,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
      },
    ]);
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

  // ✅ 메인 유저(발표자) 선택: 항상 participants에서만 선택
  const getMainUser = () => {
    // 1️⃣ activeSpeaker가 "나"인 경우
    if (activeSpeakerId === me.id) {
      return me;
    }

    // 2️⃣ activeSpeaker가 다른 참가자인 경우
    const found = participants.find(p => p.id === activeSpeakerId);
    if (found) {
      return found;
    }

    // 3️⃣ activeSpeaker가 없거나 잘못된 경우 → 나 우선
    if (me) {
      return me;
    }

    // 4️⃣ 그래도 없다면 참가자 중 첫 번째
    if (participants.length > 0) {
      return participants[0];
    }

    // 5️⃣ 진짜 아무도 없을 때만
    return {
      id: 'empty',
      name: '대기 중',
      muted: true,
      cameraOff: true,
      speaking: false,
      isMe: false,
    };
  };

  // --- Local media ---
  const startLocalMedia = async () => {
    // 1) video+audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (avErr) {
      console.warn("AV 요청 실패 → video-only 시도", avErr);
    }

    // 2) video only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (vErr) {
      console.warn("video-only 실패 → audio-only 시도", vErr);
    }

    // 3) audio only
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (aErr) {
      console.warn("audio-only도 실패 → 미디어 없는 테스트 모드", aErr);
    }

    // 4) 완전 실패
    localStreamRef.current = null;
    setLocalStream(null);
    return null;
  };

  const consumeProducer = async (producerId, peerId) => {
  const device = sfuDeviceRef.current;
  const recvTransport = recvTransportRef.current;
  if (!device || !recvTransport) return;

  sfuWsRef.current.send(JSON.stringify({
    action: "consume",
    requestId: crypto.randomUUID(),
    data: {
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    },
  }));

  const handler = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.action !== "consume:response") return;

    const { consumerId, kind, rtpParameters } = msg.data;

    const consumer = await recvTransport.consume({
      id: consumerId,
      producerId,
      kind,
      rtpParameters,
    });

    const stream = new MediaStream([consumer.track]);

      // 🔥 participants에 stream 붙이기
      setParticipants(prev =>
        prev.map(p =>
          p.id === peerId ? { ...p, stream } : p
        )
      );

      sfuWsRef.current.send(JSON.stringify({
        action: "resumeConsumer",
        requestId: crypto.randomUUID(),
        data: { consumerId },
      }));

      sfuWsRef.current.removeEventListener("message", handler);
    };

    sfuWsRef.current.addEventListener("message", handler);
  };

  // speaking(내 로컬만)
  const startAudioLevelMonitor = (stream) => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const THRESHOLD = 20;

    let speaking = false;

    const checkVolume = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;

      if (avg > THRESHOLD) {
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
  };

  // start local media on mount
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

  // camera toggle
  useEffect(() => {
    if (!localStreamRef.current) return;
    const vt = localStreamRef.current.getVideoTracks()[0];
    if (!vt) return;
    vt.enabled = camOn;
  }, [camOn]);

  // permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const mic = await navigator.permissions.query({ name: "microphone" });
        setMicPermission(mic.state);
        mic.onchange = () => setMicPermission(mic.state);
      } catch {}

      try {
        const cam = await navigator.permissions.query({ name: "camera" });
        setCamPermission(cam.state);
        cam.onchange = () => setCamPermission(cam.state);
      } catch {}
    };

    checkPermissions();
  }, []);

  // start speaking monitor when stream ready
  useEffect(() => {
    if (!localStream) return;
    startAudioLevelMonitor(localStream);
  }, [localStream]);

  // --- WebSocket: join room and receive participants ---
  useEffect(() => {
    if (!roomId) return;

    // 기존 ws 정리
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(
      `ws://localhost:8080/ws/room/${roomId}?userId=${encodeURIComponent(
        userId
      )}&userName=${encodeURIComponent(userName)}`
    );

    ws.onopen = () => {
      console.log("✅ WebSocket connected", { roomId, userId, userName });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "USERS_UPDATE" && Array.isArray(data.users)) {
        const serverUsers = data.users.map(u => ({
          id: u.userId,
          name: u.userName,
          muted: false,
          cameraOff: true,
          speaking: false,
          isMe: u.userId === userId,
        }));

        // 🔥 핵심: me가 없으면 강제로 합친다
        const hasMe = serverUsers.some(u => u.id === me.id);

        const meWithStream = {
          ...me,
          stream: localStream,
        };

        const merged = hasMe
          ? serverUsers.map(u => (u.id === me.id ? meWithStream : u))
          : [meWithStream, ...serverUsers];

        setParticipants(merged);

        setActiveSpeakerId(prev =>
          prev && merged.some(p => p.id === prev)
            ? prev
            : merged[0]?.id ?? null
        );
      }
    };

    ws.onclose = () => {
      console.log("❌ WebSocket closed");
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, userName]);

  // 내 상태(말하기/카메라/마이크)가 바뀔 때 participants 내 내 항목만 갱신
  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.isMe
          ? {
              ...p,
              muted: micMuted,
              cameraOff: camMuted,
              speaking: isSpeaking,
            }
          : p
      )
    );
  }, [micMuted, camMuted, isSpeaking]);

  useEffect(() => {
    if (!roomId || !localStream) return;

    // 1️⃣ SFU WebSocket 연결
    const sfuWs = new WebSocket("ws://localhost:4000");
    sfuWsRef.current = sfuWs;

    sfuWs.onopen = () => {
      console.log("✅ SFU WebSocket connected");

      // 2️⃣ SFU join (서버에 방 + 피어 등록)
      sfuWs.send(JSON.stringify({
        action: "join",
        requestId: crypto.randomUUID(),
        data: {
          roomId,
          peerId: userId,   // ⭐ Spring userId 그대로 사용
        },
      }));
    };

    sfuWs.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      console.log("📩 SFU message:", msg);

      // -----------------------------
      // join response
      // -----------------------------
      if (msg.action === "join:response") {
        const { rtpCapabilities, existingProducers } = msg.data;

        // 1️⃣ Device 생성
        const device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        sfuDeviceRef.current = device;

        // 2️⃣ send transport 생성
        sfuWs.send(JSON.stringify({
          action: "createTransport",
          requestId: crypto.randomUUID(),
          data: { direction: "send" },
        }));

        // 3️⃣ recv transport 생성
        sfuWs.send(JSON.stringify({
          action: "createTransport",
          requestId: crypto.randomUUID(),
          data: { direction: "recv" },
        }));

        // 기존 producer들 consume 준비
        sfuDeviceRef.current._existingProducers = existingProducers;
        return;
      }

      // -----------------------------
      // createTransport response
      // -----------------------------
      if (msg.action === "createTransport:response") {
        const {
          transportId,
          direction,
          iceParameters,
          iceCandidates,
          dtlsParameters,
        } = msg.data;

        const device = sfuDeviceRef.current;
        if (!device) return;

        // =====================
        // SEND TRANSPORT
        // =====================
        if (direction === "send") {
          const sendTransport = device.createSendTransport({
            id: transportId,
            iceParameters,
            iceCandidates,
            dtlsParameters,
          });

          sendTransport.on("connect", ({ dtlsParameters }, cb) => {
            const requestId = crypto.randomUUID();

            const handler = (event) => {
              const msg = JSON.parse(event.data);
              if (
                msg.action === "connectTransport:response" &&
                msg.requestId === requestId
              ) {
                cb();
                sfuWs.removeEventListener("message", handler);
              }
            };

            sfuWs.addEventListener("message", handler);

            sfuWs.send(JSON.stringify({
              action: "connectTransport",
              requestId,
              data: { transportId, dtlsParameters },
            }));
          });

          sendTransport.on("produce", ({ kind, rtpParameters }, cb, errback) => {
            const requestId = crypto.randomUUID();

            const handleProduceResponse = (event) => {
              const msg = JSON.parse(event.data);

              if (
                msg.action === "produce:response" &&
                msg.requestId === requestId
              ) {
                cb({ id: msg.data.producerId });
                sfuWs.removeEventListener("message", handleProduceResponse);
              }

              if (
                msg.action === "produce:error" &&
                msg.requestId === requestId
              ) {
                errback(msg.error);
                sfuWs.removeEventListener("message", handleProduceResponse);
              }
            };

            sfuWs.addEventListener("message", handleProduceResponse);

            sfuWs.send(JSON.stringify({
              action: "produce",
              requestId,
              data: { transportId, kind, rtpParameters },
            }));
          });

          localStream.getTracks().forEach(track => {
            sendTransport.produce({ track });
          });

          sendTransportRef.current = sendTransport;
        }

        // =====================
        // RECV TRANSPORT
        // =====================
        if (direction === "recv") {
          const recvTransport = device.createRecvTransport({
            id: transportId,
            iceParameters,
            iceCandidates,
            dtlsParameters,
          });

          recvTransport.on("connect", ({ dtlsParameters }, cb) => {
            const requestId = crypto.randomUUID();

            const handler = (event) => {
              const msg = JSON.parse(event.data);
              if (
                msg.action === "connectTransport:response" &&
                msg.requestId === requestId
              ) {
                cb();
                sfuWs.removeEventListener("message", handler);
              }
            };

            sfuWs.addEventListener("message", handler);

            sfuWs.send(JSON.stringify({
              action: "connectTransport",
              requestId,
              data: { transportId, dtlsParameters },
            }));
          });

          recvTransportRef.current = recvTransport;

          const producers = sfuDeviceRef.current._existingProducers || [];
          for (const p of producers) {
            consumeProducer(p.producerId, p.peerId);
          }
        }
      }
    }

    sfuWs.onerror = (err) => {
      console.error("❌ SFU WS error", err);
    };

    sfuWs.onclose = () => {
      console.log("❌ SFU WebSocket closed");
    };

    return () => {
      sfuWs.close();
      sfuWsRef.current = null;
    };
  }, [roomId, localStream, userId]);


  // --- Render ---
  const mainUser = getMainUser();

  return (
    <>
      <div className="meet-layout">
        {/* --- Main Stage Area --- */}
        <main className="meet-main">
          {/* Header (Floating) */}
          <div className="meet-header">
            <div className="header-info glass-panel">
              <div className="header-icon">
                <Monitor size={20} />
              </div>
              <div>
                <h1 className="header-title">주간 제품 회의</h1>
                <div className="header-meta">
                  <span>
                    <Users size={10} /> {participants.length}명 접속 중
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

          {/* Video Grid Logic */}
          <div className="meet-stage">
            {layoutMode === "speaker" ? (
              <div className="layout-speaker">
                <div className="main-stage">
                  <VideoTile
                    user={mainUser}
                    isMain
                    stream={mainUser.stream}
                  />
                </div>

                <div className="bottom-strip custom-scrollbar">
                  {/* ✅ 항상 내 타일 먼저 */}
                  <div
                    className={`strip-item ${activeSpeakerId === me.id ? "active-strip" : ""}`}
                    onClick={() => setActiveSpeakerId(me.id)}
                  >
                    <VideoTile user={me} stream={localStream} />
                  </div>

                  {/* ✅ 서버에서 받은 다른 참가자들 */}
                  {participants
                    .filter(p => !p.isMe)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`strip-item ${activeSpeakerId === p.id ? "active-strip" : ""}`}
                        onClick={() => setActiveSpeakerId(p.id)}
                      >
                        <VideoTile user={p} stream={p.stream}/>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="layout-grid custom-scrollbar">
                {participants.map((p) => (
                  <div key={p.id} className="video-tile-wrapper">
                    <VideoTile user={p} stream={p.stream} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Bottom Control Bar --- */}
          <div className="meet-controls-container">
            {showReactions && (
              <div className="reaction-popup glass-panel">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="reaction-btn"
                  >
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

              <ButtonControl
                label="반응"
                icon={Smile}
                active={showReactions}
                onClick={() => setShowReactions(!showReactions)}
              />

              <ButtonControl
                label="채팅"
                active={sidebarOpen && sidebarView === "chat"}
                icon={MessageSquare}
                onClick={() => toggleSidebar("chat")}
              />
              <ButtonControl
                label="참여자"
                active={sidebarOpen && sidebarView === "participants"}
                icon={Users}
                onClick={() => toggleSidebar("participants")}
              />

              <div className="divider"></div>

              <ButtonControl
                label="통화 종료"
                danger
                icon={Phone}
                onClick={() => alert("통화가 종료되었습니다.")}
              />
            </div>
          </div>
        </main>

        {/* --- Right Sidebar Panel --- */}
        <aside className={`meet-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-inner">
            <div className="sidebar-header">
              <h2 className="sidebar-title">
                {sidebarView === "chat" ? "회의 채팅" : "참여자 목록"}
              </h2>
              <button onClick={() => setSidebarOpen(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>

            {/* Chat Content */}
            {sidebarView === "chat" && (
              <>
                <div className="chat-area custom-scrollbar">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.isMe ? "me" : "others"}`}>
                      <div className="msg-content-wrapper">
                        {!msg.isMe && <UserAvatar name={msg.sender} size="sm" />}
                        <div className="msg-bubble">{msg.text}</div>
                      </div>
                      <span className="msg-time">
                        {msg.sender}, {msg.time}
                      </span>
                    </div>
                  ))}
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

            {/* Participants Content */}
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
