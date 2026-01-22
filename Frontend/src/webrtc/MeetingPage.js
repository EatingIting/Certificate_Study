import { ChevronDown, ChevronUp, LayoutGrid, Loader2, Maximize, Minimize, MessageSquare, Mic, MicOff,
    Monitor, MoreHorizontal, Phone, PictureInPicture2, Send, Share, Smile, Users, Video, VideoOff, X,} from "lucide-react";
import "pretendard/dist/web/static/pretendard.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";
import "./MeetingPage.css";
import { useMeeting } from "./MeetingContext";

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

// VideoTile 내부에서 오디오 레벨을 직접 감지
const VideoTile = ({ user, isMain = false, stream, isScreen, reaction, roomReconnecting = false, videoRef, streamVersion }) => {
  const internalVideoRef = useRef(null);

  const setVideoRef = (el) => {
    internalVideoRef.current = el;
    if (videoRef) videoRef.current = el;
  };

  const safeUser = user ?? {
    name: "대기 중",
    isMe: false,
    muted: true,
    cameraOff: true,
    speaking: false,
    isJoining: false,
    isReconnecting: false,
  };

  const [isSpeakingLocally, setIsSpeakingLocally] = useState(false);
  const [isVideoTrackMuted, setIsVideoTrackMuted] = useState(true);

  const cameraOff = safeUser.cameraOff;

  /* =========================
     비디오 트랙 유효성 판단
  ========================= */
  const hasLiveVideoTrack = useMemo(() => {
    return stream?.getVideoTracks().some((t) => t.readyState === "live") ?? false;
  }, [stream]);

  const canShowVideo = useMemo(() => {
    if (!stream) return false;
    if (cameraOff) return false;
    if (isScreen) return stream.getVideoTracks().length > 0;

    // ⭐ 핵심: live video track 존재 여부만 본다
    return hasLiveVideoTrack;
  }, [stream, cameraOff, isScreen, hasLiveVideoTrack]);

  /* =========================
     오디오 볼륨 감지
  ========================= */
  useEffect(() => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    let audioContext;
    let analyser;
    let raf;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioContext = new AC();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setIsSpeakingLocally(avg > 15);
        raf = requestAnimationFrame(loop);
      };

      loop();
    } catch {}

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (audioContext?.state !== "closed") audioContext.close();
    };
  }, [stream]);

  /* =========================
     비디오 트랙 mute 감지
  ========================= */
  useEffect(() => {
    const videoTrack = stream?.getVideoTracks()[0];
    if (!videoTrack) {
      setIsVideoTrackMuted(true);
      return;
    }

    const check = () => {
      const muted =
        !videoTrack.enabled ||
        videoTrack.muted ||
        videoTrack.readyState === "ended";
      setIsVideoTrackMuted(muted);
    };

    check();
    videoTrack.addEventListener("mute", check);
    videoTrack.addEventListener("unmute", check);
    videoTrack.addEventListener("ended", check);

    const interval = setInterval(check, 1000);

    return () => {
      videoTrack.removeEventListener("mute", check);
      videoTrack.removeEventListener("unmute", check);
      videoTrack.removeEventListener("ended", check);
      clearInterval(interval);
    };
  }, [stream]);

  /* =========================
     video srcObject 연결
     (video가 렌더될 때만)
  ========================= */
  useEffect(() => {
    const v = internalVideoRef.current;
    if (!v || !stream) return;

    const hasLiveVideo =
        stream.getVideoTracks().some(
        (t) => t.readyState === "live" && t.enabled !== false
        );

    // ⭐ PiP 복귀 포함: live video track이 있으면 무조건 다시 붙인다
    if (hasLiveVideo) {
        if (v.srcObject !== stream) {
        v.srcObject = stream;
        }

        v.muted = true;
        v.play().catch(() => {});
    }
  }, [stream, streamVersion]);

  const isSpeaking = safeUser.speaking || isSpeakingLocally;
  const isJoining = safeUser.isJoining;
  const isReconnecting = safeUser.isReconnecting;
  const showRoomReconnecting = roomReconnecting && !safeUser.isMe;

  const showVideoOffIcon = !isScreen && (cameraOff || isVideoTrackMuted);

  /* =========================
     JSX
  ========================= */
  return (
    <div
      className={`video-tile ${isMain ? "main" : ""} ${
        isSpeaking ? "speaking" : ""
      }`}
    >
      {(isJoining || isReconnecting || showRoomReconnecting) && (
        <div className="reconnecting-overlay">
          <Loader2 className="spinner" />
          <p>{isJoining ? "접속 중..." : "재접속 중..."}</p>
        </div>
      )}

      <div className="video-content">
        {canShowVideo ? (
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className={`video-element ${isScreen ? "screen" : ""}`}
          />
        ) : (
          <div className="camera-off-placeholder">
            <UserAvatar name={safeUser.name} size={isMain ? "lg" : "md"} />
            <p className="stream-label">{safeUser.name}</p>
          </div>
        )}
      </div>

      {!isReconnecting && (
        <div className="video-overlay">
          {safeUser.muted && <MicOff size={16} className="icon-red" />}
          {showVideoOffIcon && <VideoOff size={16} className="icon-red" />}
        </div>
      )}

      {reaction && <div className="reaction-overlay">{reaction}</div>}
    </div>
  );
};


function safeUUID() {
    if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// --- Main App Component ---

function MeetingPage({ roomId: propRoomId, subjectId: propSubjectId }) {
    const params = useParams();
    const navigate = useNavigate();
    const loggedRef = useRef(false);

    // props 우선, 없으면 useParams에서 가져옴
    const roomId = propRoomId || params.roomId;
    const subjectId = propSubjectId || params.subjectId;

    useEffect(() => {
        if (!roomId) return;
        if (loggedRef.current) return;

        console.log("[CLIENT] roomId from URL =", roomId);
        loggedRef.current = true;
    }, [roomId]);

    const {
        startMeeting,
        endMeeting,
        saveMeetingState,
        saveCleanupFunction,
        meetingUrl,
    } = useMeeting();

    const [layoutMode, setLayoutMode] = useState("speaker");

    const [sidebarView, setSidebarView] = useState(() => {
        return sessionStorage.getItem("sidebarView") || "chat";
    });

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        return sessionStorage.getItem("sidebarOpen") === "true";
    });

    const [micOn, setMicOn] = useState(() => {
        const saved = localStorage.getItem("micOn");
        return saved !== null ? saved === "true" : true;
    });

    const [camOn, setCamOn] = useState(() => {
        const saved = localStorage.getItem("camOn");
        return saved !== null ? saved === "true" : true;
    });

    const [micPermission, setMicPermission] = useState("prompt");
    const [camPermission, setCamPermission] = useState("prompt");

    const [localStream, setLocalStream] = useState(null);
    const localStreamRef = useRef(null);

    const ensureLocalProducersRunningRef = useRef(false);

    const [isSpeaking, setIsSpeaking] = useState(false);

    const [participants, setParticipants] = useState([]);
    const [activeSpeakerId, setActiveSpeakerId] = useState(null);

    const [streamVersion, setStreamVersion] = useState(0);

    const [isLoading, setIsLoading] = useState(false);

    const [isLocalLoading, setIsLocalLoading] = useState(true);

    const [messages, setMessages] = useState(() => {
        try {
            const saved = sessionStorage.getItem(`chat_${roomId}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [roomReconnecting, setRoomReconnecting] = useState(true);

    const [participantCount, setParticipantCount] = useState(1);
    const [chatDraft, setChatDraft] = useState("");

    const [showReactions, setShowReactions] = useState(false);
    const [myReaction, setMyReaction] = useState(null);

    const [isBrowserPip, setIsBrowserPip] = useState(false);
    const [pipLockedPeerId, setPipLockedPeerId] = useState(null);

    const wsRef = useRef(null);
    const sfuWsRef = useRef(null);

    const sfuDeviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);

    const pendingProducersRef = useRef([]);

    const consumersRef = useRef(new Map());
    const peerStreamsRef = useRef(new Map());
    const producersRef = useRef(new Map());
    const audioElsRef = useRef(new Map());

    const userIdRef = useRef(null);
    const userNameRef = useRef(null);

    const effectAliveRef = useRef(true);
    const chatEndRef = useRef(null);
    const [chatConnected, setChatConnected] = useState(false);
    const lastSpeakingRef = useRef(null);

    const reactionTimersRef = useRef({});

    const micOnRef = useRef(micOn);
    const camOnRef = useRef(camOn);
    const micPermissionRef = useRef(micPermission);
    const camPermissionRef = useRef(camPermission);

    const reconnectTimeoutRef = useRef(new Map());

    const reconnectHistoryRef = useRef(new Set());

    const reconnectCompletedTimeRef = useRef(new Map());  // ✅ 재접속 완료 시간 기록 (1초 동안 다시 추가 방지)

    const joiningTimeoutRef = useRef(new Map());

    const hasFinishedInitialSyncRef = useRef(false); // 초기 동기화 완료 플래그

    const lastActiveSpeakerRef = useRef(null);
    const manuallySelectedRef = useRef(false);  // 사용자가 수동으로 타일을 선택했는지 여부

    const screenStreamRef = useRef(null);
    const screenProducerRef = useRef(null);
    const cameraWasOnBeforeScreenShareRef = useRef(false); // 화면공유 시작 전 카메라 상태
    const isStoppingScreenShareRef = useRef(false); // stopScreenShare 중복 실행 방지
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const isLeavingRef = useRef(false); // 통화종료 버튼으로 나가는 중인지 여부

    // 전체화면 관련
    const mainStageRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isStripVisible, setIsStripVisible] = useState(false);
    const [showStripToggle, setShowStripToggle] = useState(false);
    const [gridFullscreenId, setGridFullscreenId] = useState(null); // 그리드 타일 전체화면 ID
    const [gridStripVisible, setGridStripVisible] = useState(false); // 그리드 전체화면 스트립 표시
    const [showGridStripToggle, setShowGridStripToggle] = useState(false); // 그리드 전체화면 토글 버튼 표시
    const [isGridFullscreen, setIsGridFullscreen] = useState(false); // 그리드 전체화면 여부
    const gridFullscreenStageRef = useRef(null); // 그리드 전체화면 컨테이너 ref

    // PiP 관련
    const mainVideoRef = useRef(null);

    // 사용자 튕기지 않게
    const wsReconnectTimerRef = useRef(null);
    const wsReconnectAttemptRef = useRef(0);
    const wsPingTimerRef = useRef(null);
    const wsAliveRef = useRef(true);
    const wsConnectRef = useRef(null);
    const autoRestoringCameraRef = useRef(false);

    useEffect(() => { micOnRef.current = micOn; }, [micOn]);
    useEffect(() => { camOnRef.current = camOn; }, [camOn]);
    useEffect(() => { micPermissionRef.current = micPermission; }, [micPermission]);
    useEffect(() => { camPermissionRef.current = camPermission; }, [camPermission]);    

    if (!userIdRef.current) {
        const savedId = localStorage.getItem("stableUserId");
        const savedName = localStorage.getItem("stableUserName");

        const id = savedId || safeUUID();
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
        screenStream: isScreenSharing ? screenStreamRef.current : null,
        isScreenSharing,
        isLoading: isLocalLoading,
    };

    const getMainUser = useCallback(() => {
        if (isBrowserPip && pipLockedPeerId != null) {
        const locked = participants.find((p) => String(p.id) === String(pipLockedPeerId));
        if (locked) return locked;
        if (String(pipLockedPeerId) === String(userId)) return me;
        // 잠긴 사용자가 목록에서 사라지면 fallback
        }

        const found = participants.find((p) => String(p.id) === String(activeSpeakerId));
        return found || me;
    }, [isBrowserPip, pipLockedPeerId, participants, activeSpeakerId, me, userId]);

    const mainUser = getMainUser();

    // ✅ mainStream 계산: 화면공유 중이면 screenStream, 아니면 일반 stream 사용
    const mainStream = mainUser?.isMe
        ? (mainUser?.isScreenSharing ? screenStreamRef.current : localStream)
        : (mainUser?.isScreenSharing ? mainUser?.screenStream : mainUser?.stream);
    const isMainScreenShare = !!mainUser?.isScreenSharing;

    // 전체화면 핸들러 (원본 유지)
    const handleFullscreen = () => {
        if (!mainStageRef.current) return;
        if (!document.fullscreenElement) {
        mainStageRef.current.requestFullscreen().catch((err) => console.error("전체화면 전환 실패:", err));
        } else {
        document.exitFullscreen();
        }
    };

    const pipTargetStream = useMemo(() => {
        if (!mainUser) return null;

        if (mainUser.isScreenSharing) {
            return mainUser.isMe
                ? screenStreamRef.current
                : mainUser.screenStream;
        }

        return mainUser.isMe
            ? localStream
            : mainUser.stream;
    }, [mainUser, localStream, streamVersion]);

    const pipVideoRef = useRef(null);

    const enterPipWithStream = async (stream) => {
        if (!stream || stream.getVideoTracks().length === 0) {
            console.warn("[PiP] invalid stream");
            return;
        }

        if (!pipVideoRef.current) {
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.style.position = "fixed";
            v.style.top = "-9999px";
            v.style.left = "-9999px";
            document.body.appendChild(v);
            pipVideoRef.current = v;
        }

        const video = pipVideoRef.current;

        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }

        try {
            await video.play();
            if (!document.pictureInPictureElement) {
                await video.requestPictureInPicture();
            }
        } catch (e) {
            console.error("[PiP] failed:", e);
        }
    };

    const enterPipForCurrentMain = async () => {
        try {
            if (document.pictureInPictureElement) return true;

            // 1) 메인 타일의 실제 video로 PiP 시도 (가장 안정적)
            const mainVideo = mainVideoRef.current;
            const mainStream = mainVideo?.srcObject;

            if (mainVideo && mainStream && mainStream.getVideoTracks().length > 0) {
                // play를 await 하지 말고 바로 PiP 요청 (제스처 끊김 방지)
                mainVideo.play?.().catch(() => {});
                await mainVideo.requestPictureInPicture();
                return true;
            }

            // 2) fallback: hidden video + pipTargetStream
            if (pipTargetStream && pipTargetStream.getVideoTracks().length > 0) {
                await enterPipWithStream(pipTargetStream);
                return !!document.pictureInPictureElement;
            }

            console.warn("[PiP] no valid video track for PiP (mainVideo/pipTargetStream)");
            return false;
        } catch (e) {
            console.error("[PiP] enter failed:", e);
            return false;
        }
    };

    // ✅ 강제 PiP: 사이드바 열 때 브라우저 PiP 실행
    const toggleSidebar = async (view) => {
        console.log("[toggleSidebar] clicked:", view);

        if (sidebarOpen && sidebarView === view) {
            setSidebarOpen(false);
            sessionStorage.setItem("sidebarOpen", "false");
            return;
        }

        if (!document.pictureInPictureElement) {
            console.log("[toggleSidebar] try enter PiP");
            await enterPipForCurrentMain();
        }

        setSidebarView(view);
        setSidebarOpen(true);
        sessionStorage.setItem("sidebarOpen", "true");
        sessionStorage.setItem("sidebarView", view);
    };

    const handleHangup = () => {
        // ✅ 통화종료 버튼으로 나가는 것임을 표시 (beforeunload에서 LEAVE 전송하도록)
        isLeavingRef.current = true;

        // ✅ LEAVE를 먼저 보내서 다른 참가자에게 즉시 퇴장 알림
        wsRef.current?.send(
            JSON.stringify({
                type: "LEAVE",
            })
        );

        alert("채팅이 종료되었습니다.");
        
        try {
            // 1) 로컬 미디어 정리
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
            setLocalStream(null);

            // 2) WebSocket 정리
            try { wsRef.current?.close(); } catch {}
            wsRef.current = null;

            try { sfuWsRef.current?.close(); } catch {}
            sfuWsRef.current = null;

            // 3) mediasoup transport/device 정리
            try { sendTransportRef.current?.close(); } catch {}
            sendTransportRef.current = null;

            try { recvTransportRef.current?.close(); } catch {}
            recvTransportRef.current = null;

            try { sfuDeviceRef.current?.close?.(); } catch {}
            sfuDeviceRef.current = null;

            // 4) 오디오 엘리먼트 정리
            audioElsRef.current?.forEach((a) => {
                try { a.srcObject = null; } catch {}
            });
            audioElsRef.current?.clear?.();

            // 5) 상태 초기화(원하면)
            setParticipants([]);
            setMessages([]);
            setActiveSpeakerId(null);
            setRoomReconnecting(false);

            // 6) MeetingContext 회의 종료
            if (endMeeting) endMeeting();
        } finally {
            // 7) 페이지 이동 (브라우저 종료 대신)
            window.location.href = "/LMS"; // 홈으로 보내기
            // 또는: window.location.replace("/ended");
        }
    };

    // ✅ 전체화면 상태 감지(원본 유지)
    useEffect(() => {
        const handleFullscreenChange = () => {
        const fullscreenEl = document.fullscreenElement;
        setIsFullscreen(!!fullscreenEl);
        if (fullscreenEl) document.body.classList.add("fullscreen-active");
        else document.body.classList.remove("fullscreen-active");
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        const onEnter = (e) => {
            setIsBrowserPip(true);

            // ✅ PIP 진입 시 현재 카메라/마이크 상태를 서버에 재전송 (다른 참가자에게 올바른 상태 표시)
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId: userId,
                    changes: {
                        muted: !micOnRef.current,
                        cameraOff: !camOnRef.current,
                    },
                }));
                console.log("[PIP] Sent state sync on PIP enter:", { muted: !micOnRef.current, cameraOff: !camOnRef.current });
            }

            // PIP 윈도우에 컨트롤 추가
            const pipWindow = e.pictureInPictureWindow;
            if (pipWindow && 'navigator' in window && 'mediaSession' in navigator) {
                // Media Session API를 사용하여 컨트롤 추가
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: '화상 회의 중',
                    artist: `방 ${roomId}`,
                });

                // 회의로 돌아가기 액션
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    // 브라우저 PIP 종료하고 회의 페이지로 이동
                    if (document.pictureInPictureElement) {
                        document.exitPictureInPicture().then(() => {
                            sessionStorage.setItem("sidebarOpen", "false");
                            // 이미 회의 페이지에 있으므로 추가 작업 불필요
                        }).catch(() => {});
                    }
                });

                // 마이크 토글
                navigator.mediaSession.setActionHandler('play', () => {
                    if (localStream) {
                        const audioTrack = localStream.getAudioTracks()[0];
                        if (audioTrack) {
                            audioTrack.enabled = true;
                            setMicOn(true);
                        }
                    }
                });

                navigator.mediaSession.setActionHandler('pause', () => {
                    if (localStream) {
                        const audioTrack = localStream.getAudioTracks()[0];
                        if (audioTrack) {
                            audioTrack.enabled = false;
                            setMicOn(false);
                        }
                    }
                });

                // 회의 종료
                navigator.mediaSession.setActionHandler('stop', () => {
                    handleHangup();
                });
            }
        };

        const onLeave = () => {
            setIsBrowserPip(false);

            // PIP 종료 시 사이드바도 닫기
            setSidebarOpen(false);
            sessionStorage.setItem("sidebarOpen", "false");

            // Media Session 액션 핸들러 제거
            if ('navigator' in window && 'mediaSession' in navigator) {
                try {
                    navigator.mediaSession.setActionHandler('previoustrack', null);
                    navigator.mediaSession.setActionHandler('play', null);
                    navigator.mediaSession.setActionHandler('pause', null);
                    navigator.mediaSession.setActionHandler('stop', null);
                } catch (err) {
                    console.error('Failed to clear media session handlers:', err);
                }
            }

            // ✅ 네비게이션은 LMSSubject에서 처리함
        };

        document.addEventListener("enterpictureinpicture", onEnter);
        document.addEventListener("leavepictureinpicture", onLeave);

        return () => {
            document.removeEventListener("enterpictureinpicture", onEnter);
            document.removeEventListener("leavepictureinpicture", onLeave);
        };
    }, [roomId, localStream, handleHangup, setMicOn, setSidebarOpen, userId]);

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
        setShowReactions(false);

        // 1️⃣ 기존 타이머 제거
        const oldTimer = reactionTimersRef.current.myReaction;
        if (oldTimer) {
            clearTimeout(oldTimer);
        }

        // 2️⃣ 이모지 즉시 표시
        setMyReaction(emoji);

        // 3️⃣ 서버에 이모지 전송 (다른 사용자들이 볼 수 있도록)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "REACTION",
                    emoji,
                })
            );
        }

        // 4️⃣ 새 타이머 등록 (2.5초 후 제거)
        const timerId = setTimeout(() => {
            setMyReaction(null);
            delete reactionTimersRef.current.myReaction;
        }, 2500);

        reactionTimersRef.current.myReaction = timerId;
    };

    const isIOSDevice = () => {
        // iPhone/iPad/iPod (구형 UA)
        const ua = navigator.userAgent || "";
        const isAppleMobileUA = /iPhone|iPad|iPod/i.test(ua);

        // iPadOS 13+는 UA가 Macintosh로 나오는 경우가 있어 maxTouchPoints로 보정
        const isIpadOS13Plus = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

        return isAppleMobileUA || isIpadOS13Plus;
    };

    const isIOS = useMemo(() => isIOSDevice(), []);

    const bumpStreamVersion = () => {
        setStreamVersion((v) => v + 1);
    };

    useEffect(() => {
        /* console.log("[PERMISSION]", {
            micPermission,
            camPermission,
            micDisabled,
            camDisabled,
        }); */
    }, [micPermission, camPermission]);

    // --- Local media ---
    const startLocalMedia = async () => {
    // ✅ 1) 이미 로컬 스트림이 있으면 그대로 사용 (중복 getUserMedia 방지)
    if (localStreamRef.current) {
        try {
        const stream = localStreamRef.current;

        // 트랙 enabled 상태를 현재 설정값 기준으로 보정
        const at = stream.getAudioTracks()[0];
        if (at) at.enabled = !!micOnRef.current;

        const vt = stream.getVideoTracks()[0];
        if (vt) vt.enabled = !!camOnRef.current;

        // 상태 동기화
        setLocalStream(stream);

        // 권한은 스트림이 있다는 전제로 granted로 취급
        setMicPermission("granted");
        setCamPermission("granted");

        // MeetingContext 호출은 실패해도 미디어 동작에 영향 없게 격리
        try {
            if (typeof startMeeting === "function" && roomId) {
            startMeeting(roomId, subjectId);
            }
            if (typeof saveMeetingState === "function") {
            saveMeetingState({ localStream: stream });
            }
        } catch (e) {
            // console.warn("[startLocalMedia] meeting context error:", e);
        }

        return stream;
        } finally {
        setIsLocalLoading(false);
        }
    }

    // ✅ 2) 로컬 스트림이 없으면 새로 획득
    try {
        const shouldGetVideo = !!camOnRef.current; // 카메라 OFF면 video:false로 요청
        const shouldGetAudio = true;              // 오디오는 항상 요청 후 enabled로 제어

        /* console.log(
        `[startLocalMedia] getUserMedia video=${shouldGetVideo}, audio=${shouldGetAudio}`
        ); */

        const stream = await navigator.mediaDevices.getUserMedia({
        video: shouldGetVideo,
        audio: shouldGetAudio,
        });

        // ⭐ 트랙 enabled 상태를 현재 설정값 기준으로 맞춤
        const at = stream.getAudioTracks()[0];
        if (at) {
            at.enabled = !!micOnRef.current;
            // console.log(`[startLocalMedia] audio track enabled = ${at.enabled}`);
        }

        const vt = stream.getVideoTracks()[0];
        if (vt) {
            vt.enabled = !!camOnRef.current;
            // console.log(`[startLocalMedia] video track enabled = ${vt.enabled}`);
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        setMicPermission("granted");
        // 카메라를 아예 요청하지 않은 경우에도 "권한"은 granted일 수 있지만,
        // UI 버튼 비활성화 판단은 permission 기반이므로, 여기서는 "granted"로 두는 편이 안전합니다.
        setCamPermission("granted");

        // MeetingContext 호출은 실패해도 미디어 동작에 영향 없게 격리
        try {
        if (typeof startMeeting === "function" && roomId) {
            startMeeting(roomId, subjectId);
        }
        if (typeof saveMeetingState === "function") {
            saveMeetingState({ localStream: stream });
        }
        } catch (e) {
            // console.warn("[startLocalMedia] meeting context error:", e);
        }

        return stream;
    } catch (err) {
        // console.error("[startLocalMedia] Failed to get media:", err);

        // 권한이 실제로 거부된 케이스만 disabled로 처리되도록 하는 게 이상적이지만,
        // 우선은 실패 시 denied로 내려 버튼 비활성화가 맞습니다.
        setMicPermission("denied");
        setCamPermission("denied");

        return null;
    } finally {
        setIsLocalLoading(false);
        // ❌ 여기서 roomReconnecting false 하면 안 됨 (당신 코드 정책 유지)
    }
    };

    const ensureLocalProducers = async () => {
        // 🔒 중복 실행 방지
        if (ensureLocalProducersRunningRef.current) return;
        ensureLocalProducersRunningRef.current = true;

        try {
            const transport = sendTransportRef.current;
            if (!transport || transport.closed) return;

            const stream = localStreamRef.current;
            if (!stream) return;

            /* =========================
            AUDIO PRODUCER
            ========================= */
            const audioTrack = stream
                .getAudioTracks()
                .find((t) => t.readyState === "live");

            if (audioTrack) {
                let audioProducer = producersRef.current.get("audio");

                // ❗ producer가 있는데 닫혀 있으면 제거
                if (audioProducer?.closed) {
                    producersRef.current.delete("audio");
                    audioProducer = null;
                }

                if (!audioProducer) {
                    try {
                        const p = await transport.produce({
                            track: audioTrack,
                            appData: { type: "audio" },
                        });
                        producersRef.current.set("audio", p);
                    } catch (e) {
                        console.warn("[ensureLocalProducers] audio produce failed:", e);
                    }
                }

                // 🔁 enabled 상태만 동기화
                audioTrack.enabled = !!micOnRef.current;
            }

            /* =========================
            CAMERA PRODUCER
            ========================= */

            // 🚫 사용자가 카메라 OFF면 절대 producer 생성하지 않음
            if (!camOnRef.current) return;

            const videoTrack = stream
                .getVideoTracks()
                .find((t) => t.readyState === "live");

            // ⚠️ 여기서는 video track을 새로 만들지 않음
            // (카메라 복구는 AUTO-RESTORE에서 담당)
            if (!videoTrack) return;

            let cameraProducer = producersRef.current.get("camera");

            // ❗ 닫힌 producer면 제거
            if (cameraProducer?.closed) {
                producersRef.current.delete("camera");
                cameraProducer = null;
            }

            if (!cameraProducer) {
                try {
                    const p = await transport.produce({
                        track: videoTrack,
                        appData: { type: "camera" },
                    });
                    producersRef.current.set("camera", p);
                } catch (e) {
                    console.warn("[ensureLocalProducers] camera produce failed:", e);
                    return;
                }
            }

            // 🔁 enabled 상태만 동기화
            videoTrack.enabled = true;
        } finally {
            ensureLocalProducersRunningRef.current = false;
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

    // ✅ [수정] 참가자 생성 시 muted 초기값을 false로 변경 (마이크 꺼짐 아이콘 문제 해결)
    const ensureParticipant = (peerId) => {
        setParticipants((prev) => {
            const existingUser = prev.find((p) => p.id === peerId);
            
            // 🚀 [핵심] 이미 존재하는 유저라면 절대 건드리지 말고 그대로 리턴!
            // (여기서 건드리면 서버에서 받아온 muted: true가 초기화됨)
            if (existingUser) return prev;

            // 없을 때만 새로 생성
            return [
                ...prev,
                {
                    id: peerId,
                    name: `User-${String(peerId).slice(0, 4)}`,
                    isMe: false,
                    muted: true,
                    cameraOff: true,
                    speaking: false,
                    stream: null,
                    isLoading: true,
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

    const clearPeerStreamOnly = (peerId) => {
        peerStreamsRef.current.delete(peerId);

        setParticipants((prev) =>
            prev.map((p) =>
                String(p.id) === String(peerId)
                    ? {
                        ...p,
                        stream: null,
                        // ❗ 상태(cameraOff/muted)는 유지
                    }
                    : p
            )
        );
    };
    
    const startScreenShare = async () => {
        if (isIOS) {
            console.warn("iOS에서는 화면 공유를 지원하지 않습니다.");
            return;
        }
        if (!sendTransportRef.current || sendTransportRef.current.closed) return;
        if (producersRef.current.has("screen")) return;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            const track = stream.getVideoTracks()[0];
            if (!track || track.readyState === "ended") return;

            // ⭐ 화면공유 시작 전 카메라 상태 저장
            cameraWasOnBeforeScreenShareRef.current = camOnRef.current;
            console.log(`[startScreenShare] Saving camera state: ${cameraWasOnBeforeScreenShareRef.current}`);

            // 1) 카메라 producer 닫기 (원격에 camera producerClosed 나가게)
            const cameraProducer = producersRef.current.get("camera");
            if (cameraProducer) {
                const id = cameraProducer.id;
                try { cameraProducer.close(); } catch {}
                producersRef.current.delete("camera");
                safeSfuSend({ action: "closeProducer", data: { producerId: id } });
            }

            // 2) 로컬 카메라 "비디오 트랙만" 정지 (오디오는 유지)
            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => {
                    try { t.stop(); } catch {}
                });

                const audios = localStreamRef.current
                    .getAudioTracks()
                    .filter((t) => t.readyState === "live");

                const audioOnly = new MediaStream([...audios]);
                localStreamRef.current = audioOnly;
                setLocalStream(audioOnly);
            } else {
                // 로컬 스트림이 아직 없으면, 그냥 audioOnly는 빈 스트림으로
                const audioOnly = new MediaStream();
                localStreamRef.current = audioOnly;
                setLocalStream(audioOnly);
            }

            // 3) 화면공유 producer 생성
            const screenProducer = await sendTransportRef.current.produce({
                track,
                appData: { type: "screen" },
            });

            producersRef.current.set("screen", screenProducer);
            screenStreamRef.current = stream;

            setIsScreenSharing(true);

            // UI(내 상태)
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe ? { ...p, screenStream: stream, isScreenSharing: true } : p
                )
            );

            // 브라우저 UI에서 “공유 중지” 눌렀을 때
            track.onended = () => {
                if (isStoppingScreenShareRef.current) return;
                console.log("[screen] track ended by browser");
                stopScreenShare(true); // fromTrackEnded=true
            };
        } catch (e) {
            console.error("[startScreenShare] failed:", e);
        }
    };

    const stopScreenShare = async (fromTrackEnded = false) => {
        if (isStoppingScreenShareRef.current) {
            console.warn("[stopScreenShare] ignored duplicate call");
            return;
        }
        isStoppingScreenShareRef.current = true;

        try {
            console.log("[stopScreenShare] fromTrackEnded =", fromTrackEnded);

            // 1) screen producer 닫기
            const screenProducer = producersRef.current.get("screen");
            if (screenProducer) {
                try { screenProducer.close(); } catch {}
                producersRef.current.delete("screen");
                safeSfuSend({
                    action: "closeProducer",
                    data: { producerId: screenProducer.id },
                });
            }

            // 2) screen stream 정리
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => {
                    t.onended = null; // ⭐️ 중요: onended 재진입 차단
                    if (t.readyState !== "ended") {
                        try { t.stop(); } catch {}
                    }
                });
                screenStreamRef.current = null;
            }

            setIsScreenSharing(false);

            // UI(내 상태) 먼저 화면공유 해제 반영
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe ? { ...p, screenStream: null, isScreenSharing: false } : p
                )
            );

            // 3) 카메라 복구 (현재 카메라 상태 기준으로 복구)
            // ⭐ 중요: 화면공유 시작 전이 아니라, 지금 현재 camOn 상태를 기준으로!
            const shouldRestoreCamera = camOnRef.current;
            console.log(`[restore] shouldRestoreCamera = ${shouldRestoreCamera}, camOnRef.current = ${camOnRef.current}, cameraWasOnBeforeScreenShare = ${cameraWasOnBeforeScreenShareRef.current}`);

            if (!shouldRestoreCamera) {
                console.log(`[restore] Camera is currently OFF, not restoring`);
                // 카메라가 꺼져있었으면 복구하지 않음
                // 로컬 스트림에는 오디오만 남김
                const prevAudioTracks = localStreamRef.current
                    ? localStreamRef.current.getAudioTracks().filter(t => t.readyState !== "ended")
                    : [];

                const audioOnly = new MediaStream([...prevAudioTracks]);
                localStreamRef.current = audioOnly;
                setLocalStream(audioOnly);

                // UI 상태: 카메라 OFF 유지
                setParticipants((prev) =>
                    prev.map((p) =>
                        p.isMe ? { ...p, cameraOff: true, stream: audioOnly } : p
                    )
                );

                // 서버에도 카메라 OFF 상태 전파
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                        JSON.stringify({
                            type: "USER_STATE_CHANGE",
                            userId,
                            changes: { cameraOff: true },
                        })
                    );
                }
                return;
            }

            // 카메라가 켜져있었으면 복구
            if (!sendTransportRef.current || sendTransportRef.current.closed) {
                console.warn("[restore] sendTransport not ready");
                return;
            }

            // (중요) 기존 로컬 오디오 트랙은 살리고, 비디오만 새로 받음
            const prevAudioTracks = localStreamRef.current
                ? localStreamRef.current.getAudioTracks().filter(t => t.readyState !== "ended")
                : [];

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            if (!newVideoTrack || newVideoTrack.readyState !== "live") {
                console.warn("[restore] camera track not live, skip produce");
                return;
            }

            console.log(`[restore] Restoring camera because it was ON before screen share`);

            // 4) camera producer 생성 (enabled=true 명시)
            await produceCamera(newVideoTrack, true);

            // 5) 로컬 스트림 갱신 (오디오 + 새 비디오 병합)
            const merged = new MediaStream([...prevAudioTracks, newVideoTrack]);
            localStreamRef.current = merged;
            setLocalStream(merged);

            console.log(`[restore] camera restored, cameraOff = false`);

            // 6) 내 UI 상태: 카메라 ON으로 반영
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe ? { ...p, cameraOff: false, stream: merged } : p
                )
            );

            // 7) Spring 서버에도 카메라 ON 상태 전파
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: { cameraOff: false },
                    })
                );
            }
        } catch (e) {
            console.error("[stopScreenShare] failed:", e);
        } finally {
            isStoppingScreenShareRef.current = false;
        }
    };

    const produceCamera = async (track, forceEnabled = null) => {
        const t = sendTransportRef.current;
        if (!t || t.closed) {
            console.warn("[produceCamera] transport not ready");
            return;
        }
        if (!track || track.readyState !== "live") {
            console.warn("[produceCamera] track not live");
            return;
        }

        // 기존 camera producer 있으면 닫고 교체하는 게 안전
        const old = producersRef.current.get("camera");
        if (old) {
            console.log(`[produceCamera] closing old producer: ${old.id}`);
            try { old.close(); } catch {}
            producersRef.current.delete("camera");
            safeSfuSend({ action: "closeProducer", data: { producerId: old.id } });
        }

        // 트랙 enabled 상태 설정 (forceEnabled가 있으면 우선, 없으면 camOnRef 사용)
        const enabledState = forceEnabled !== null ? forceEnabled : camOnRef.current;
        track.enabled = enabledState;
        console.log(`[produceCamera] producing with track.enabled=${track.enabled}, forceEnabled=${forceEnabled}, camOnRef.current=${camOnRef.current}`);

        const producer = await t.produce({
            track,
            appData: { type: "camera" },
        });

        console.log(`[produceCamera] new producer created: ${producer.id}`);
        producersRef.current.set("camera", producer);
        return producer;
    };

    const consumeProducer = async (producerId, fallbackPeerId, targetAppData) => {
        if (!producerId) return;
        if (String(fallbackPeerId) === String(userIdRef.current)) return;
        if (consumersRef.current.has(producerId)) return;

        const device = sfuDeviceRef.current;
        const recvTransport = recvTransportRef.current;

        // 아직 준비 안 됐으면 대기열로
        if (!device || !recvTransport) {
            pendingProducersRef.current.push({
                producerId,
                peerId: fallbackPeerId,
                appData: targetAppData,
            });
            return;
        }

        const requestId = safeUUID();

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

            // ✅ 이 요청에 대한 핸들러는 여기서부터 1회성
            sfuWsRef.current?.removeEventListener("message", handler);

            let consumer = null;

            try {
                const {
                    consumerId,
                    kind,
                    rtpParameters,
                    appData: serverAppData,
                    peerId: serverPeerId,
                } = msg.data;

                // 🔐 서버 peerId 최우선
                const peerId = serverPeerId ?? fallbackPeerId;

                // 🔐 appData 결정 (server > target > {})
                const finalAppData = serverAppData ?? targetAppData ?? {};

                /* console.log(
                    "[consume:response]",
                    "peerId =", peerId,
                    "producerId =", producerId,
                    "appData =", finalAppData
                ); */

                consumer = await recvTransport.consume({
                    id: consumerId,
                    producerId,
                    kind,
                    rtpParameters,
                    appData: { ...finalAppData },
                });

                // ✅ producerId 기준으로 consumer 저장(기존 방식 유지)
                consumersRef.current.set(producerId, consumer);

                const isScreen = consumer.appData?.type === "screen";

                /* console.log(
                    "[SFU][consumer created]",
                    "peerId =", peerId,
                    "producerId =", producerId,
                    "kind =", kind,
                    "isScreen =", isScreen,
                    "consumer.appData =", consumer.appData,
                    "track.readyState =", consumer.track?.readyState,
                    "track.enabled =", consumer.track?.enabled
                ); */

                /* -------------------------------------------------
                스트림 생성/병합
                - 카메라: 기존 스트림과 병합
                - 화면공유: 단독 스트림 (매번 새 MediaStream 생성)
                ------------------------------------------------- */

                let mergedCameraStream = null;
                let screenStream = null;

                if (!isScreen) {
                    const prev = peerStreamsRef.current.get(peerId);
                    const next = new MediaStream();

                    if (prev) {
                        prev.getTracks().forEach((t) => {
                            // ⭐ 같은 종류(kind)의 트랙은 새 consumer 트랙으로 교체
                            if (t.readyState !== "ended" && t.kind !== consumer.track.kind) {
                                next.addTrack(t);
                            }
                        });
                    }

                    // 새 consumer 트랙 추가 (오디오 or 비디오)
                    next.addTrack(consumer.track);
                    peerStreamsRef.current.set(peerId, next);
                    mergedCameraStream = next;

                    // console.log(`[consumer] Merged stream for peer ${peerId}: videoTracks=${next.getVideoTracks().length}, audioTracks=${next.getAudioTracks().length}`);
                } else {
                    // ✅ 화면공유는 "항상 새 MediaStream"으로 만들어 리렌더 강제
                    screenStream = new MediaStream([consumer.track]);
                }

                /* -------------------------------------------------
                참가자 상태 업데이트
                ------------------------------------------------- */
                setParticipants((prev) => {
                    const idx = prev.findIndex((p) => String(p.id) === String(peerId));

                    // 신규 참가자
                    if (idx === -1) {
                        return [
                            ...prev,
                            {
                                id: peerId,
                                name: `User-${String(peerId).slice(0, 4)}`,
                                isMe: false,

                                // ⭐ muted/cameraOff는 서버(USERS_UPDATE)가 보내줄 것이므로 기본값만 설정
                                muted: true,
                                cameraOff: true,
                                speaking: false,

                                stream: isScreen ? null : mergedCameraStream,
                                screenStream: isScreen ? screenStream : null,
                                isScreenSharing: isScreen ? true : false,

                                isJoining: false,
                                isReconnecting: false,
                                isLoading: false,
                                lastUpdate: Date.now(),
                            },
                        ];
                    }

                    // 기존 참가자
                    const next = [...prev];
                    const p = next[idx];

                    next[idx] = {
                        ...p,

                        // ✅ screen이면 stream 건드리지 않음, camera면 stream 갱신
                        stream: isScreen ? p.stream : mergedCameraStream,

                        // ✅ screen이면 screenStream 갱신(항상 새 객체), 아니면 유지
                        screenStream: isScreen ? screenStream : p.screenStream,

                        // ✅ screen일 때만 true로 세팅 (종료는 종료 이벤트에서 false)
                        isScreenSharing: isScreen ? true : p.isScreenSharing,

                        // ⭐ muted/cameraOff는 절대 변경하지 않음! 서버 상태만 사용
                        // muted: p.muted,  // 명시적으로 유지 (사실 spread로 이미 유지됨)
                        // cameraOff: p.cameraOff,  // 명시적으로 유지

                        isLoading: false,
                        isJoining: false,
                        isReconnecting: false,
                        lastUpdate: Date.now(),
                    };

                    return next;
                });

                bumpStreamVersion();

                /* -------------------------------------------------
                오디오 처리
                ------------------------------------------------- */
                if (kind === "audio") {
                    const audio = new Audio();
                    audio.srcObject = new MediaStream([consumer.track]);
                    audio.autoplay = true;
                    audio.playsInline = true;
                    audioElsRef.current.set(producerId, audio);
                    audio.play().catch(() => {});
                }

                /* -------------------------------------------------
                consumer resume
                ------------------------------------------------- */
                safeSfuSend({
                    action: "resumeConsumer",
                    requestId: safeUUID(),
                    data: { consumerId },
                });

                /* -------------------------------------------------
                종료 처리(가장 중요)
                - track ended OR producerclose 시:
                1) consumer close + map 정리
                2) screen이면 screenStream/null + isScreenSharing false
                3) camera이면 peerStreams 재구성
                ------------------------------------------------- */
                const cleanupThisConsumer = () => {
                    // ✅ 1) consumer 정리
                    const c = consumersRef.current.get(producerId);
                    if (c) {
                        try { c.close(); } catch {}
                    }
                    consumersRef.current.delete(producerId);

                    // ✅ 2) 오디오 엘리먼트 정리
                    const a = audioElsRef.current.get(producerId);
                    if (a) {
                        try { a.srcObject = null; } catch {}
                        audioElsRef.current.delete(producerId);
                    }

                    // ✅ 3) UI 정리
                    setParticipants((prev) =>
                        prev.map((p) => {
                            if (String(p.id) !== String(peerId)) return p;

                            const isScreen = finalAppData?.type === "screen";

                            if (isScreen) {
                                return {
                                    ...p,
                                    screenStream: null,
                                    isScreenSharing: false,
                                    lastUpdate: Date.now(),
                                };
                            }

                            // 카메라 트랙 종료
                            const cur = peerStreamsRef.current.get(peerId);
                            if (!cur) {
                                return { ...p, stream: null, lastUpdate: Date.now() };
                            }

                            const aliveTracks = cur
                                .getTracks()
                                .filter(
                                    (t) =>
                                        t.readyState !== "ended" &&
                                        t.id !== consumer?.track?.id
                                );

                            const rebuilt = aliveTracks.length ? new MediaStream(aliveTracks) : null;
                            if (rebuilt) peerStreamsRef.current.set(peerId, rebuilt);
                            else peerStreamsRef.current.delete(peerId);

                            return { ...p, stream: rebuilt, lastUpdate: Date.now() };
                        })
                    );

                    bumpStreamVersion();
                };

                // ✅ track ended
                consumer.track.onended = cleanupThisConsumer;

                // ✅ producer close (mediasoup consumer 이벤트)
                consumer.on?.("producerclose", cleanupThisConsumer);
            } catch (e) {
                console.error("consume failed", e);

                // 실패 시도 중간 생성된 consumer 정리
                try {
                    if (consumer) consumer.close();
                } catch {}
                consumersRef.current.delete(producerId);
            }
        };

        sfuWsRef.current.addEventListener("message", handler);
    };

    const hasCameraConsumer = (peerId) => {
        for (const c of consumersRef.current.values()) {
            if (
                c.appData?.type === "camera" &&
                String(c.appData?.peerId) === String(peerId)
            ) {
                return true;
            }
        }
        return false;
    };

    const hasLiveRemoteVideo = (stream) => {
        if (!stream) return false;
        return stream.getVideoTracks().some((t) => t.readyState === "live");
    };

    const toggleMic = async () => {
        const newVal = !micOn;
        setMicOn(newVal);
        localStorage.setItem("micOn", newVal);

        console.log(`[toggleMic] newVal=${newVal}, micOn=${micOn}`);

        // 1. 실제 오디오 트랙 제어
        const audioProducer = producersRef.current.get("audio");
        const at = localStreamRef.current?.getAudioTracks()[0];

        console.log(`[toggleMic] producer exists:`, !!audioProducer, `track:`, audioProducer?.track?.readyState);
        console.log(`[toggleMic] local audio track exists:`, !!at, `readyState:`, at?.readyState);

        // 혹시 producer가 없다면 에러 (audio는 항상 있어야 함)
        if (!audioProducer) {
            console.error(`[toggleMic] No audio producer! This should not happen.`);
        } else {
            if (audioProducer.track) {
                audioProducer.track.enabled = newVal;
                console.log(`[toggleMic] producer track enabled set to:`, newVal);
            }
        }

        // 로컬 스트림 트랙도 동기화
        if (at) {
            at.enabled = newVal;
            console.log(`[toggleMic] local stream track enabled set to:`, newVal);
        }

        // 2. 내 화면 업데이트
        setParticipants((prev) =>
            prev.map((p) => (p.isMe ? { ...p, muted: !newVal } : p))
        );

        // 3. 서버 전송 (이것이 다른 클라이언트에게 알림을 보냄)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId: userId,
                    changes: { muted: !newVal },
                })
            );
            console.log(`[toggleMic] sent USER_STATE_CHANGE to server: muted=${!newVal}`);
        }
    };

    const toggleCam = async () => {
        const newVal = !camOn;
        setCamOn(newVal);
        localStorage.setItem("camOn", newVal);

        console.log(`[toggleCam] newVal=${newVal}, camOn=${camOn}`);

        // 1️⃣ 실제 미디어 트랙 제어
        const producer = producersRef.current.get("camera");
        const vt = localStreamRef.current?.getVideoTracks()[0];

        console.log(`[toggleCam] producer exists:`, !!producer, `track:`, producer?.track?.readyState);
        console.log(`[toggleCam] local video track exists:`, !!vt, `readyState:`, vt?.readyState);

        // 🔥 카메라를 켜는데 producer나 비디오 트랙이 없는 경우
        if (newVal && (!vt || !producer)) {
            console.log(`[toggleCam] No video track or producer, creating new one. vt=${!!vt}, producer=${!!producer}`);

            if (!sendTransportRef.current || sendTransportRef.current.closed) {
                console.warn("[toggleCam] sendTransport not ready");
                return;
            }

            try {
                let newVideoTrack;

                // 비디오 트랙이 없으면 새로 가져오기
                if (!vt) {
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false,
                    });

                    newVideoTrack = newStream.getVideoTracks()[0];
                    if (!newVideoTrack || newVideoTrack.readyState !== "live") {
                        console.warn("[toggleCam] Failed to get new video track");
                        return;
                    }

                    console.log(`[toggleCam] Got new video track:`, {
                        id: newVideoTrack.id,
                        readyState: newVideoTrack.readyState,
                        enabled: newVideoTrack.enabled,
                        muted: newVideoTrack.muted,
                    });

                    // 로컬 스트림 병합 (오디오 + 새 비디오)
                    const prevAudioTracks = localStreamRef.current
                        ? localStreamRef.current.getAudioTracks().filter(t => t.readyState !== "ended")
                        : [];

                    const merged = new MediaStream([...prevAudioTracks, newVideoTrack]);
                    localStreamRef.current = merged;
                    setLocalStream(merged);
                } else {
                    // 비디오 트랙은 있는데 producer가 없는 경우 (새로고침 후 카메라 OFF 상태)
                    newVideoTrack = vt;
                    console.log(`[toggleCam] Using existing video track for producer`);
                }

                // 새 producer 생성
                await produceCamera(newVideoTrack, true);

                console.log(`[toggleCam] Created producer for video track`);
            } catch (e) {
                console.error(`[toggleCam] Failed to create producer:`, e);
                return;
            }
        } else if (newVal) {
            // 카메라를 켜는데 producer와 트랙이 모두 있는 경우 - enabled만 변경
            if (producer?.track) {
                producer.track.enabled = true;
                console.log(`[toggleCam] producer track enabled set to: true`);
            }

            if (vt) {
                vt.enabled = true;
                console.log(`[toggleCam] local stream track enabled set to: true`);
            }
        } else {
            // 카메라를 끄는 경우
            if (producer?.track) {
                producer.track.enabled = false;
                console.log(`[toggleCam] producer track enabled set to: false`);
            }

            if (vt) {
                vt.enabled = false;
                console.log(`[toggleCam] local stream track enabled set to: false`);
            }
        }

        // 2️⃣ UI 즉시 반영
        setParticipants((prev) =>
            prev.map((p) =>
                p.isMe ? { ...p, cameraOff: !newVal } : p
            )
        );

        // 3️⃣ 서버에 상태 전파
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId,
                    changes: { cameraOff: !newVal },
                })
            );
            console.log(`[toggleCam] sent USER_STATE_CHANGE to server: cameraOff=${!newVal}`);
        }
    };

    const startPingLoop = useCallback((ws) => {
        const loop = () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            try {
            ws.send(JSON.stringify({ type: "PING" }));
            } catch {}
            // 25초~30초 권장 (서버 idle 기준에 맞추세요)
            wsPingTimerRef.current = setTimeout(loop, 25000);
        };

        if (wsPingTimerRef.current) clearTimeout(wsPingTimerRef.current);
        wsPingTimerRef.current = setTimeout(loop, 25000);
    }, []);

    const stopPingLoop = useCallback(() => {
        if (wsPingTimerRef.current) {
            clearTimeout(wsPingTimerRef.current);
            wsPingTimerRef.current = null;
        }
    }, []);

    const sendInitialState = useCallback((ws) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const isMuted = !micOnRef.current;
        const isCameraOff = !camOnRef.current;

        ws.send(JSON.stringify({
            type: "USER_STATE_CHANGE",
            userId,
            changes: {
            muted: isMuted,
            cameraOff: isCameraOff,
            },
        }));

        // USERS_UPDATE 타이밍 레이스 보정(기존 유지)
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "USER_STATE_CHANGE",
                userId,
                changes: {
                muted: !micOnRef.current,
                cameraOff: !camOnRef.current,
                },
            }));
            }
        }, 100);
    }, [userId]);
    // --- Hooks ---

    useEffect(() => {
        const init = async () => {
            await startLocalMedia();
        };
        init();
    }, []);

    // 이전에 화면공유 중이었던 사람 추적 (화면공유 종료 감지용)
    const prevScreenSharersRef = useRef(new Set());

    useEffect(() => {
        const screenSharers = participants.filter(p => p.isScreenSharing);
        const screenSharerIds = new Set(screenSharers.map(p => p.id));
        const hasScreenSharer = screenSharers.length > 0;

        // 현재 선택된 사람이 "이전에 화면공유 중이었는데 지금은 아님" = 화면공유 종료함
        const wasScreenSharing = prevScreenSharersRef.current.has(activeSpeakerId);
        const isNowScreenSharing = screenSharerIds.has(activeSpeakerId);
        const selectedPersonStoppedSharing = wasScreenSharing && !isNowScreenSharing;

        // 1. 누군가(나 포함) 화면 공유 중일 때
        if (hasScreenSharer) {
            // ✅ 사용자가 수동 선택하지 않은 경우에만 자동 전환
            if (!manuallySelectedRef.current) {
                const firstScreenSharer = screenSharers[0];

                // 현재 선택된 사람이 화면공유자가 아닐 때 → 화면공유자로 전환
                if (!isNowScreenSharing) {
                    // 최초 저장 (아직 저장 안 됐을 때만)
                    if (!lastActiveSpeakerRef.current) {
                        lastActiveSpeakerRef.current = activeSpeakerId;
                    }
                    setActiveSpeakerId(firstScreenSharer.id);
                    setLayoutMode("speaker");
                }
            }
            // ✅ 수동 선택한 사람이 "화면공유를 종료"한 경우에만 다른 화면공유자로 전환
            else if (selectedPersonStoppedSharing) {
                const firstScreenSharer = screenSharers[0];
                setActiveSpeakerId(firstScreenSharer.id);
            }
            // ✅ 그 외 (B처럼 원래 화면공유 안 하던 사람 선택) → 그대로 유지
        }
        // 2. 화면 공유가 모두 끝났을 때 → 마지막 활성 사용자 유지 + 수동 선택 리셋
        else {
            manuallySelectedRef.current = false;
            lastActiveSpeakerRef.current = null;
        }

        // 현재 화면공유자 목록 저장 (다음 비교용)
        prevScreenSharersRef.current = screenSharerIds;
    }, [participants, activeSpeakerId]);

    useEffect(() => {
        // iOS Safari 레이아웃 깨짐 방지
        const el = document.querySelector(".bottom-strip");
        if (el) {
            el.style.display = "none";
            // eslint-disable-next-line no-unused-expressions
            el.offsetHeight;
            el.style.display = "";
        }
    }, [participants.some(p => p.isScreenSharing)]);

    useEffect(() => {
        return () => {
            joiningTimeoutRef.current.forEach((t) => clearTimeout(t));
            joiningTimeoutRef.current.clear();
        };
    }, []);

    useEffect(() => {
        const handleBeforeUnload = () => {
            // ✅ 통화종료 버튼으로 나가는 경우 이미 LEAVE를 보냈으므로 아무것도 하지 않음
            if (isLeavingRef.current) {
                return;
            }

            // ✅ 탭 닫기/브라우저 종료/새로고침 모두 LEAVE 전송
            //    → 다른 참가자에게 즉시 타일 제거됨
            //    → 새로고침 시에는 같은 userId로 빠르게 재접속하여 복원됨
            try {
                wsRef.current?.send(
                    JSON.stringify({
                        type: "LEAVE",
                    })
                );
            } catch {}

            // WebSocket을 즉시 닫아 서버가 afterConnectionClosed 실행하게 함
            try {
                wsRef.current?.close();
            } catch {}
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        // 이미 해제됐으면 아무것도 안 함
        if (!roomReconnecting) return;

        // 내 로컬 미디어 준비 + recvTransport 준비 + 초기 sync 완료
        if (!isLocalLoading && recvTransportRef.current && hasFinishedInitialSyncRef.current) {
            setRoomReconnecting(false);
        }
    }, [isLocalLoading, streamVersion, roomReconnecting]);

    useEffect(() => {
        const meP = participants.find((p) => p.isMe);
        if (!meP) return;

        // 재접속/접속중엔 복구하지 않음
        if (meP.isReconnecting || meP.isJoining) return;

        // 사용자가 카메라 OFF면 절대 복구하지 않음
        if (!camOnRef.current) return;

        const transport = sendTransportRef.current;
        if (!transport || transport.closed) return;

        // 이미 camera producer가 있으면 끝
        const camProducer = producersRef.current.get("camera");
        if (camProducer && !camProducer.closed) return;

        // 🔒 재진입 방지
        if (autoRestoringCameraRef.current) return;
        autoRestoringCameraRef.current = true;

        const timer = setTimeout(async () => {
            try {
            // 다시 한 번 상태 재확인(디바운스 동안 바뀌었을 수 있음)
            if (!camOnRef.current) return;
            const t2 = sendTransportRef.current;
            if (!t2 || t2.closed) return;

            const camProducer2 = producersRef.current.get("camera");
            if (camProducer2 && !camProducer2.closed) return;

            let stream = localStreamRef.current;
            let vt = stream?.getVideoTracks()?.find((x) => x.readyState === "live");

            // ✅ 비디오 트랙이 없으면 새로 획득해서 병합
            if (!vt) {
                const newStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
                });

                vt = newStream.getVideoTracks()[0];
                if (!vt || vt.readyState !== "live") return;

                const prevAudioTracks = stream
                ? stream.getAudioTracks().filter((x) => x.readyState !== "ended")
                : [];

                const merged = new MediaStream([...prevAudioTracks, vt]);
                localStreamRef.current = merged;
                setLocalStream(merged);
            }

            // 🔁 producer 생성
            await produceCamera(vt, true);

            // UI/서버 상태도 확실히 ON으로 고정
            setParticipants((prev) =>
                prev.map((p) => (p.isMe ? { ...p, cameraOff: false } : p))
            );

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId,
                    changes: { cameraOff: false },
                })
                );
            }
            } catch (e) {
            console.warn("[AUTO-RESTORE] failed:", e);
            } finally {
            autoRestoringCameraRef.current = false;
            }
        }, 250); // ✅ 200~400ms 권장 (너무 짧으면 재진입, 너무 길면 복구 체감이 늦음)

        return () => {
            clearTimeout(timer);
            autoRestoringCameraRef.current = false;
        };
    }, [participants, userId]);

    useEffect(() => {
        const interval = setInterval(() => {
            setParticipants(prev =>
                prev.map(p => {
                    if (!p.isReconnecting) return p;

                    const elapsed = Date.now() - (p.reconnectStartedAt ?? 0);

                    // 최소 800ms는 보여주기
                    if (elapsed < 800) return p;

                    // ✅ 800ms 이상 경과했으면 재접속 상태 종료
                    const peerId = String(p.id);
                    if (reconnectHistoryRef.current.has(peerId)) {
                        console.log(`✅ [RECONNECT COMPLETED] ${p.name} (${peerId}) - elapsed=${elapsed}ms`);
                        reconnectHistoryRef.current.delete(peerId);
                        reconnectCompletedTimeRef.current.set(peerId, Date.now());  // ✅ 완료 시간 기록
                    }

                    // 스트림이 생겼거나, 카메라 OFF면 종료
                    const isMe = !!p.isMe;

                    const userIntendsCameraOff = isMe
                        ? !camOnRef.current
                        : !!p.cameraOff;

                        // ✅ 재접속 종료 조건
                        // 1) 스트림이 실제로 복구됨 (camera stream 또는 screen stream)
                        // 2) 사용자 의도로 카메라 OFF인 상태
                        //   - 내 경우: camOnRef.current가 false일 때만 인정
                        //   - 상대: p.cameraOff가 true면 인정
                        const shouldEndReconnect =
                        !!p.stream ||
                        userIntendsCameraOff;

                        if (shouldEndReconnect) {
                        // 사용자가 다시 접속하고 스트림이 복구되면 reconnectHistoryRef에서도 제거
                        const peerId = String(p.id);
                        if (reconnectHistoryRef.current.has(peerId)) {
                            reconnectHistoryRef.current.delete(peerId);
                            reconnectCompletedTimeRef.current.set(peerId, Date.now());
                        }

                        return {
                            ...p,
                            isReconnecting: false,
                            isLoading: false,
                            reconnectStartedAt: undefined,
                        };
                    }

                    return p;
                })
            );
        }, 100);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isGridFullscreen && gridFullscreenStageRef.current) {
            gridFullscreenStageRef.current
                .requestFullscreen()
                .catch((err) => {
                    console.error("전체화면 전환 실패:", err);
                });
        }
    }, [isGridFullscreen]);

    useEffect(() => {
        if (!localStreamRef.current) return;
        const vt = localStreamRef.current.getVideoTracks()[0];
        if (vt) vt.enabled = camOn;

        const at = localStreamRef.current.getAudioTracks()[0];
        if (at) at.enabled = micOn;
    }, [camOn, micOn]);

    // ✅ [수정] 여기 있던 로컬 스트림 분석 로직은 VideoTile 내부로 이동했거나,
    // isSpeaking 상태를 서버로 보내는 용도로만 남겨둡니다.
    useEffect(() => {
        if (!localStream) return;
        ensureLocalProducers();

        // 오디오 트랙이 없으면 볼륨 분석을 건너뜀 (화면 공유 시 오디오 트랙이 없을 수 있음)
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) return;

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

    useEffect(() => {
        if (!localStream) return;

        // 비디오 트랙 제어
        const vt = localStream.getVideoTracks()[0];
        if (vt) {
            // 이미 트랙 상태가 설정값과 다르다면 변경
            if (vt.enabled !== camOn) vt.enabled = camOn;
        }

        // 오디오 트랙 제어
        const at = localStream.getAudioTracks()[0];
        if (at) {
            // 이미 트랙 상태가 설정값과 다르다면 변경
            if (at.enabled !== micOn) at.enabled = micOn;
        }
    }, [camOn, micOn, localStream]);

    // 1️⃣ Signaling WebSocket (8080)
    useEffect(() => {
        if (!roomId) return;

        wsAliveRef.current = true;

        const connect = () => {
            // 이미 종료 플로우면 재연결 금지
            if (isLeavingRef.current) return;
            if (!wsAliveRef.current) return;

            try { wsRef.current?.close(); } catch {}
            wsRef.current = null;

            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl =
                `${protocol}//${window.location.host}/ws/room/${roomId}` +
                `?userId=${encodeURIComponent(userId)}` +
                `&userName=${encodeURIComponent(userName)}` +
                `&muted=${!micOnRef.current}` +
                `&cameraOff=${!camOnRef.current}`;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!wsAliveRef.current) return;

                console.log("✅ SPRING WS CONNECTED");
                setChatConnected(true);

                // 재연결 성공 → backoff 리셋
                wsReconnectAttemptRef.current = 0;
                if (wsReconnectTimerRef.current) {
                    clearTimeout(wsReconnectTimerRef.current);
                    wsReconnectTimerRef.current = null;
                }

                // 상태 동기화 + ping 시작
                sendInitialState(ws);
                startPingLoop(ws);
            };

            ws.onclose = () => {
                if (wsRef.current !== ws ) return;
                console.log("❌ WS CLOSED");
                setChatConnected(false);
                stopPingLoop();

                // 의도된 종료면 끝
                if (isLeavingRef.current) return;
                if (!wsAliveRef.current) return;

                // PiP이든 아니든, 끊기면 다시 붙어야 B에서 사라졌다가 복구됩니다.
                const attempt = (wsReconnectAttemptRef.current || 0) + 1;
                wsReconnectAttemptRef.current = attempt;

                // 지수 backoff (최대 10초)
                const delay = Math.min(10000, 500 * Math.pow(2, attempt - 1));
                console.log(`[WS] reconnect attempt #${attempt} in ${delay}ms`);

                if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
                wsReconnectTimerRef.current = setTimeout(() => {
                    connect();
                }, delay);
            };

            ws.onerror = (error) => {
                console.error("❌ WS ERROR", error);
                // onerror만으로는 재연결을 걸지 말고 onclose에서 처리(중복 방지)
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === "PONG") return;

                // 🔍 모든 메시지 로깅 (디버깅용)
                if (data.type !== "USERS_UPDATE") {
                    // console.log(`[WS] Received message type: ${data.type}`, data);
                }

                if (data.type === "REACTION") {
                    const { userId: fromUserId, emoji } = data;

                    // 1️⃣ 다른 사용자의 reaction 즉시 반영
                    setParticipants((prev) =>
                        prev.map((p) =>
                            String(p.id) === String(fromUserId)
                                ? { ...p, reaction: emoji }
                                : p
                        )
                    );

                    // 2️⃣ 기존 타이머 제거 (있다면)
                    const oldTimer = reactionTimersRef.current[fromUserId];
                    if (oldTimer) {
                        clearTimeout(oldTimer);
                    }

                    // 3️⃣ 새 타이머 등록 (2.5초 후 reaction 제거)
                    const timerId = setTimeout(() => {
                        setParticipants((prev) =>
                            prev.map((p) =>
                                String(p.id) === String(fromUserId)
                                    ? { ...p, reaction: null }
                                    : p
                            )
                        );
                        delete reactionTimersRef.current[fromUserId];
                    }, 2500);

                    reactionTimersRef.current[fromUserId] = timerId;
                    return;
                }

                if (data.type === "USERS_UPDATE" && Array.isArray(data.users)) {
                    /* console.log(`📨 [USERS_UPDATE] Received users:`, data.users.map(u => ({
                        userId: u.userId,
                        userName: u.userName,
                        online: u.online
                    }))); */

                    setParticipants((prev) => {
                        const prevMap = new Map(prev.map((p) => [String(p.id), p]));
                        const newServerIds = new Set(data.users.map((u) => String(u.userId)));

                        // 1. 서버에서 온 최신 정보로 업데이트
                        const updatedUsers = data.users.map((u) => {
                            const peerId = String(u.userId);
                            const old = prevMap.get(peerId);

                            /* -------------------------------------------------
                            재접속 이력 정리
                            ------------------------------------------------- */
                            if (!old && reconnectHistoryRef.current.has(peerId)) {
                                reconnectHistoryRef.current.delete(peerId);
                            }

                            if (reconnectTimeoutRef.current.has(peerId)) {
                                clearTimeout(reconnectTimeoutRef.current.get(peerId));
                                reconnectTimeoutRef.current.delete(peerId);
                            }

                            const isMe = peerId === String(userId);

                            const remoteHasVideo = hasLiveRemoteVideo(old?.stream);

                            // ✅ 서버에서 online=false면 재접속 중 (새로고침 등)
                            const isOffline = u.online === false;

                            // ✅ 최근 완료 시간 체크 (1초 이내면 재접속 상태 무시)
                            const completedTime = reconnectCompletedTimeRef.current.get(peerId);
                            const now = Date.now();
                            const recentlyCompleted = completedTime && (now - completedTime) < 1000;

                            if (isOffline && !recentlyCompleted) {
                                console.log(`🔴 [RECONNECTING] ${u.userName} (${peerId}) is offline, online=${u.online}, isMe=${isMe}`);
                                // ✅ 재접속 시작 시간 기록
                                if (!reconnectHistoryRef.current.has(peerId)) {
                                    reconnectHistoryRef.current.add(peerId);
                                    console.log(`➕ [ADD RECONNECT] ${u.userName} (${peerId})`);
                                }
                            } else if (isOffline && recentlyCompleted) {
                                console.log(`⏭️ [SKIP RECONNECT] ${u.userName} (${peerId}) - recently completed, treating as online`);
                            }

                            // ✅ 재접속 중인지 판단: offline이고 최근에 완료되지 않았거나, reconnectHistory에 있으면
                            const hasReconnectHistory = reconnectHistoryRef.current.has(peerId);

                            // ✅ online=true면 절대로 reconnecting 상태가 아님 (서버가 확인한 상태)
                            const isOnline = u.online === true;
                            const shouldShowReconnecting = !isOnline && ((isOffline && !recentlyCompleted) || hasReconnectHistory);

                            // ✅ online=true이고 reconnectHistory에 있으면 정리
                            if (isOnline && hasReconnectHistory) {
                                console.log(`✅ [CLEANUP] ${u.userName} (${peerId}) is online, removing from reconnectHistory`);
                                reconnectHistoryRef.current.delete(peerId);
                            }

                            const hasLiveVideo =
                                old?.stream?.getVideoTracks?.().some(
                                    (t) => t.readyState === "live"
                                );

                                const baseUser = {
                                id: peerId,
                                name: u.userName,
                                joinAt: u.joinAt,
                                isMe,

                                muted: isMe
                                    ? !micOnRef.current
                                    : (u.muted ?? false),

                                // ✅ 핵심 수정
                                cameraOff: isMe
                                    ? !camOnRef.current
                                    : (
                                        hasLiveVideo
                                        ? false
                                        : (u.cameraOff ?? true)
                                    ),

                                stream: shouldShowReconnecting ? null : old?.stream ?? null,
                                screenStream: shouldShowReconnecting ? null : old?.screenStream ?? null,
                                isScreenSharing: shouldShowReconnecting
                                    ? false
                                    : (old?.isScreenSharing ?? false),

                                reaction: old?.reaction ?? null,
                                speaking: old?.speaking ?? false,

                                isJoining: false,
                                isReconnecting: shouldShowReconnecting,
                                isLoading: false,

                                lastUpdate: Date.now(),
                            };

                            // 신규 유저(재접속 아님)인 경우 로딩 표시
                            if (!old && !hasReconnectHistory) {
                                // 내 로컬 스트림이 있거나, 이미 로드된 경우 스킵
                                const shouldStopLoading = isMe && localStreamRef.current;
                                // console.log(`[NEW USER] ${u.userName} - isJoining=true, isReconnecting=${baseUser.isReconnecting}`);

                                // ✅ 신규 유저도 재접속 중이면 reconnectStartedAt 설정
                                const reconnectStartedAt = shouldShowReconnecting
                                    ? (old?.reconnectStartedAt ?? Date.now())
                                    : undefined;

                                return {
                                    ...baseUser,
                                    isJoining: true,
                                    isLoading: !shouldStopLoading,
                                    reconnectStartedAt  // ✅ reconnectStartedAt 추가
                                };
                            }

                            // 기존 유저(재접속 포함)
                            const shouldStopLoading = isMe && localStreamRef.current;
                            // console.log(`[EXISTING USER] ${u.userName} - isReconnecting=${baseUser.isReconnecting}, hasReconnectHistory=${hasReconnectHistory}`);

                            // ✅ 재접속 중이면 reconnectStartedAt 설정 (없으면 지금 시간, 있으면 기존 시간 유지)
                            const reconnectStartedAt = shouldShowReconnecting
                                ? (old?.reconnectStartedAt ?? Date.now())
                                : undefined;

                            return {
                                ...baseUser,
                                isLoading: !shouldStopLoading && baseUser.isLoading,
                                reconnectStartedAt  // ✅ reconnectStartedAt 추가
                            };
                        });

                        // 2. [Ghost Retention 비활성화] 서버 목록에 없는 유저는 즉시 제거
                        //    LEAVE로 나간 유저가 스피너 없이 바로 사라지도록 함
                        const ghostUsers = [];

                        // 3. 신규 유저 joining 타이머 설정 (무한 스피너 방지)
                        for (const u of data.users) {
                            const peerId = String(u.userId);
                            if (!prevMap.has(peerId) && !joiningTimeoutRef.current.has(peerId)) {
                                const t = setTimeout(() => {
                                    setParticipants((curr) =>
                                        curr.map((p) =>
                                            String(p.id) === peerId ? { ...p, isJoining: false } : p
                                        )
                                    );
                                    joiningTimeoutRef.current.delete(peerId);
                                }, 1500);
                                joiningTimeoutRef.current.set(peerId, t);
                            }
                        }

                        // 4. Active Speaker 보정 (현재 발표자가 사라졌는지 확인)
                        setActiveSpeakerId((currentSpeakerId) => {
                            const allUsers = [...updatedUsers, ...ghostUsers];
                            const exists = allUsers.some((u) => String(u.id) === String(currentSpeakerId));
                            return exists ? currentSpeakerId : String(allUsers[0]?.id ?? "") || null;
                        });

                        return [...updatedUsers, ...ghostUsers];
                    });
                    return;
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
                            isMe: String(data.userId) === String(userId),
                        },
                    ]);
                    return;
                }

                if (data.type === "USER_STATE_CHANGE") {
                    const changedUserId = String(data.userId);

                    setParticipants((prev) =>
                        prev.map((p) => {
                        if (String(p.id) !== changedUserId) return p;

                        // ✅ 스트림 관련 필드는 절대 덮어쓰지 않음
                        const safeChanges = { ...data.changes };
                        delete safeChanges.stream;
                        delete safeChanges.screenStream;
                        delete safeChanges.isScreenSharing;
                        delete safeChanges.reaction;

                        // ✅ 내 상태는 서버값으로 덮지 말고, 로컬 ref 기준으로 고정
                        if (changedUserId === String(userIdRef.current)) {
                            return {
                            ...p,
                            ...safeChanges, // muted/cameraOff가 들어와도 아래에서 다시 고정
                            muted: !micOnRef.current,
                            cameraOff: !camOnRef.current,
                            };
                        }

                        return { ...p, ...safeChanges };
                        })
                    );

                    return;
                }

                if (data.type === "USER_RECONNECTING") {
                    const peerId = String(data.userId);

                    setParticipants(prev =>
                        prev.map(p =>
                            String(p.id) === peerId
                                ? {
                                    ...p,
                                    isReconnecting: true,
                                    isLoading: true,
                                    reconnectStartedAt: Date.now(),
                                }
                                : p
                        )
                    );
                    return;
                }
            };
        };
        wsConnectRef.current = connect;
        connect();

        return () => {
            wsAliveRef.current = false;

            if (wsReconnectTimerRef.current) {
            clearTimeout(wsReconnectTimerRef.current);
            wsReconnectTimerRef.current = null;
            }

            stopPingLoop();

            // PiP 모드일 때는 연결 유지
            if (document.pictureInPictureElement) {
                console.log("[Signaling] Browser PiP active, keeping connection alive");
                return;
            }

            try { wsRef.current?.close(); } catch {}
            wsRef.current = null;
        };
    }, [roomId, userId, userName, sendInitialState, startPingLoop, stopPingLoop]);

    useEffect(() => {
        const onVis = () => {
            if (document.hidden) return;

            const ws = wsRef.current;

            // ✅ 끊겼으면 즉시 재연결 트리거
            const needsReconnect =
                !ws ||
                ws.readyState === WebSocket.CLOSED ||
                ws.readyState === WebSocket.CLOSING;

                // ❗ CONNECTING(0) 상태면 재연결 금지
                if (needsReconnect && ws?.readyState !== WebSocket.CONNECTING) {
                wsReconnectAttemptRef.current = 0;

                if (wsReconnectTimerRef.current) {
                    clearTimeout(wsReconnectTimerRef.current);
                    wsReconnectTimerRef.current = null;
                }

                wsConnectRef.current?.();
                return;
            }

            // ✅ 살아있으면 상태 재동기화
            if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ type: "PING" }));
                ws.send(JSON.stringify({
                type: "USER_STATE_CHANGE",
                userId,
                changes: { muted: !micOnRef.current, cameraOff: !camOnRef.current },
                }));
            } catch {}
            }
        };

        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [userId]);


    useEffect(() => {
        setParticipants((prev) =>
            prev.map((p) => (p.isMe ? { ...p, speaking: isSpeaking } : p))
        );
    }, [isSpeaking]);

    // 2️⃣ SFU WebSocket (4000)
    useEffect(() => {
        effectAliveRef.current = true;
        if (!roomId) return;

        const resetSfuLocalState = () => {
            consumersRef.current.clear();
            producersRef.current.clear();
            peerStreamsRef.current.clear();
            pendingProducersRef.current = [];

            audioElsRef.current.forEach((a) => {
                try { a.srcObject = null; } catch {}
            });
            audioElsRef.current.clear();

            sendTransportRef.current = null;
            recvTransportRef.current = null;
            sfuDeviceRef.current = null;
        };
        
        resetSfuLocalState();

        hasFinishedInitialSyncRef.current = false;
        setRoomReconnecting(true);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const sfuWs = new WebSocket(`${protocol}//${window.location.host}/sfu/`);
        sfuWsRef.current = sfuWs;

        const drainPending = async () => {
            if (!recvTransportRef.current || !sfuDeviceRef.current) return;
            const pending = pendingProducersRef.current;
            if (!pending.length) return;

            const uniq = new Map();
            for (const p of pending) uniq.set(p.producerId, p);
            pendingProducersRef.current = [];

            for (const p of uniq.values()) {
                await consumeProducer(p.producerId, p.peerId, p.appData);
            }
        };

        sfuWs.onopen = () => {
            safeSfuSend({
                action: "join",
                requestId: safeUUID(),
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

                safeSfuSend({ action: "createTransport", requestId: safeUUID(), data: { direction: "send" } });
                safeSfuSend({ action: "createTransport", requestId: safeUUID(), data: { direction: "recv" } });
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
                        const reqId = safeUUID();
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

                    sendTransport.on("produce", ({ kind, rtpParameters, appData }, cb, errback) => {
                        const reqId = safeUUID();
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
                        safeSfuSend({ action: "produce", requestId: reqId, data: { transportId, kind, rtpParameters, appData } });
                    });

                    /* const streamToProduce = localStreamRef.current;

                    if (streamToProduce) {
                        for (const track of streamToProduce.getTracks()) {
                            // ✅ ended 트랙 produce 방지
                            if (!track || track.readyState !== "live") {
                                console.warn("[produce-skip] track not live:", track?.kind, track?.readyState);
                                continue;
                            }

                            // ✅ enabled false 트랙도 스킵(원하면)
                            if (track.enabled === false) {
                                console.warn("[produce-skip] track disabled:", track.kind);
                                continue;
                            }

                            const type = track.kind === "video" ? "camera" : "audio";

                            // ✅ 이미 같은 타입 producer가 있으면 중복 produce 방지
                            if (producersRef.current.has(type)) continue;

                            try {
                                const producer = await sendTransport.produce({
                                    track,
                                    appData: { type },
                                });
                                producersRef.current.set(type, producer);
                                console.log("[produce-ok]", type, producer.id);
                            } catch (e) {
                                console.error("[produce-failed]", type, e);
                            }
                        }
                    } else {
                        console.log("[produce] no local stream yet");
                    } */

                    sendTransportRef.current = sendTransport;
                    setTimeout(() => {
                        ensureLocalProducers();
                    }, 0);
                }

                if (direction === "recv") {
                    const recvTransport = device.createRecvTransport({
                        id: transportId,
                        iceParameters,
                        iceCandidates,
                        dtlsParameters,
                    });

                    recvTransport.on("connect", ({ dtlsParameters }, cb) => {
                        const reqId = safeUUID();
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
                        await consumeProducer(p.producerId, p.peerId, p.appData);
                    }

                    await drainPending();
                    hasFinishedInitialSyncRef.current = true;
                    bumpStreamVersion();
                }
                return;
            }

            if (msg.action === "newProducer") {
                // 🚀 [핵심 수정] 새 프로듀서 알림에서 appData를 꺼내서 전달!
                const { producerId, peerId, appData } = msg.data; 

                console.log(
                    "[SFU][newProducer]",
                    "producerId =", producerId,
                    "peerId =", peerId,
                    "appData =", appData
                );
                
                if (!recvTransportRef.current || !sfuDeviceRef.current) {
                    // 준비 안 됐으면 appData까지 같이 저장
                    pendingProducersRef.current.push({ producerId, peerId, appData });
                    return;
                }
                // 준비 됐으면 appData와 함께 소비 시작
                await consumeProducer(producerId, peerId, appData);
                return;
            }
            
            // ... (producerClosed, peerLeft 로직 동일) ...
            if (msg.action === "producerClosed") {
                const { producerId, peerId, appData } = msg.data || {};
                const isScreen = appData?.type === "screen";

                setParticipants((prev) =>
                    prev.map((p) => {
                        if (String(p.id) !== String(peerId)) return p;

                        if (isScreen) {
                            return {
                                ...p,
                                screenStream: null,
                                isScreenSharing: false,
                                lastUpdate: Date.now(),
                            };
                        }

                        // ✅ camera producer 종료 = stream만 null로 설정
                        // ⚠️ cameraOff 상태는 변경하지 않음! (서버 USER_STATE_CHANGE로만 변경)
                        // 화면공유 시작으로 producer가 닫혀도, 실제 카메라 상태(cameraOff)는 유지되어야 함
                        return {
                            ...p,
                            stream: null,
                            // cameraOff는 유지 (p.cameraOff 그대로)
                            lastUpdate: Date.now(),
                        };
                    })
                );

                // consumer 정리
                const c = consumersRef.current.get(producerId);
                if (c) {
                    try { c.close(); } catch {}
                }
                consumersRef.current.delete(producerId);

                const a = audioElsRef.current.get(producerId);
                if (a) {
                    try { a.srcObject = null; } catch {}
                    audioElsRef.current.delete(producerId);
                }

                bumpStreamVersion();
                return;
            }

            if (msg.action === "peerLeft") {
                const { peerId } = msg.data || {};
                if (!peerId) return;

                // ✅ 1. 재접속 이력만 기록 (UI는 건드리지 않음)
                reconnectHistoryRef.current.add(peerId);

                // ✅ 2. 스트림 정리 (메모리 누수 방지)
                clearPeerStreamOnly(peerId);
                bumpStreamVersion();

                // ✅ 3. 기존 삭제 타이머 있으면 제거
                if (reconnectTimeoutRef.current.has(peerId)) {
                    clearTimeout(reconnectTimeoutRef.current.get(peerId));
                }

                // ✅ 4. 10초 후에도 복귀 없으면 완전 제거
                const timer = setTimeout(() => {
                    // 🔑 아직 USERS_UPDATE에 존재하면 제거 금지
                    setParticipants(prev => {
                        const stillExists = prev.some(p => String(p.id) === String(peerId));
                        if (stillExists) {
                            // 아직 signaling 기준으로는 살아 있음
                            return prev;
                        }
                        return prev;
                    });
                }, 10000);

                reconnectTimeoutRef.current.set(peerId, timer);
                return;
            }
        };

        sfuWs.onclose = () => {
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
            // cleanup 함수 정의 (SFU + 시그널링)
            const cleanup = () => {
                console.log("[Cleanup] Cleaning up all connections");

                // SFU cleanup
                effectAliveRef.current = false;
                try {
                    safeSfuSend({ action: "leave", requestId: safeUUID(), data: { roomId, peerId: userId } });
                } catch {}

                producersRef.current.forEach((p) => safeClose(p));
                producersRef.current.clear();
                consumersRef.current.forEach((c) => safeClose(c));
                consumersRef.current.clear();
                safeClose(sendTransportRef.current);
                safeClose(recvTransportRef.current);
                sendTransportRef.current = null;
                recvTransportRef.current = null;
                safeClose(sfuDeviceRef.current);
                sfuDeviceRef.current = null;

                audioElsRef.current.forEach((a) => {
                    try { a.srcObject = null; } catch {}
                });
                audioElsRef.current.clear();

                try { sfuWsRef.current?.close(); } catch {}
                sfuWsRef.current = null;
                peerStreamsRef.current.clear();
                pendingProducersRef.current = [];

                // 시그널링 WebSocket cleanup
                try {
                    if (wsRef.current) {
                        wsRef.current.close();
                        wsRef.current = null;
                    }
                } catch {}
            };

            // PiP 모드일 때는 연결 유지하고 cleanup 함수를 저장
            if (document.pictureInPictureElement) {
                console.log("[Cleanup] Browser PiP active, saving cleanup function for later");
                saveCleanupFunction(cleanup);
                return;
            }

            // 일반적인 경우 바로 cleanup 실행
            cleanup();
        };
    }, [roomId, userId]); // isPipMode를 의존성에서 제거하여 재연결 방지

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
        sessionStorage.setItem(`chat_${roomId}`, JSON.stringify(messages));
    }, [messages, roomId]);

    useEffect(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (lastSpeakingRef.current === isSpeaking) return;
        lastSpeakingRef.current = isSpeaking;
        wsRef.current.send(
            JSON.stringify({
                type: "SPEAKING",
                speaking: isSpeaking,
            })
        );
    }, [isSpeaking]);

    // activeSpeaker 정보를 MeetingContext에 저장 (PIP에서 사용)
    useEffect(() => {
        if (typeof saveMeetingState !== "function") return;

        const activeSpeaker = participants.find((p) => String(p.id) === String(activeSpeakerId));
        const pipTargetUser = activeSpeaker || {
            id: userId,
            name: userName,
            isMe: true,
            stream: localStream,
            screenStream: screenStreamRef.current,
            isScreenSharing: isScreenSharing,
        };

        saveMeetingState({
            localStream,
            participants,
            pipTargetUser,
        });
    }, [participants, activeSpeakerId, localStream, isScreenSharing, userId, userName, saveMeetingState]);

    //전체화면 참가자 토글
    useEffect(() => {
        if (!isFullscreen) {
            setShowStripToggle(false);
            return;
        }

        const handleMouseMove = (e) => {
            const threshold = window.innerHeight - 120;
            setShowStripToggle(e.clientY > threshold);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isFullscreen]);

    // 그리드 전체화면 참가자 토글
    useEffect(() => {
        if (!isGridFullscreen) {
            setShowGridStripToggle(false);
            return;
        }

        const handleMouseMove = (e) => {
            const threshold = window.innerHeight - 120;
            setShowGridStripToggle(e.clientY > threshold);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isGridFullscreen]);

    // localStorage에서 참가 순서 불러오기/저장하기
    const getStoredOrder = () => {
        try {
            const stored = localStorage.getItem(`participant_order_${roomId}`);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };

    const saveOrder = (orderMap) => {
        try {
            localStorage.setItem(`participant_order_${roomId}`, JSON.stringify(orderMap));
        } catch {}
    };

    const orderedParticipants = useMemo(() => {
        const storedOrder = getStoredOrder();
        let orderChanged = false;
        let maxOrder = Math.max(0, ...Object.values(storedOrder));

        // 새 참가자에게 순서 부여
        participants.forEach((p) => {
            const idStr = String(p.id);
            if (storedOrder[idStr] === undefined) {
                maxOrder += 1;
                storedOrder[idStr] = maxOrder;
                orderChanged = true;
            }
        });

        if (orderChanged) {
            saveOrder(storedOrder);
        }

        // isMe는 항상 맨 앞, 나머지는 저장된 순서대로
        return [...participants].sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            const orderA = storedOrder[String(a.id)] ?? Infinity;
            const orderB = storedOrder[String(b.id)] ?? Infinity;
            return orderA - orderB;
        });
    }, [participants, roomId]);

    // 그리드 전체화면 대상 사용자 계산 (orderedParticipants 정의 후에 위치해야 함)
    const gridFullscreenUser = orderedParticipants.find((p) => p.id === gridFullscreenId) || orderedParticipants[0];
    const gridFullscreenStream =
        gridFullscreenUser?.isScreenSharing && gridFullscreenUser?.screenStream
            ? gridFullscreenUser.screenStream
            : gridFullscreenUser?.isMe
                ? localStream
                : gridFullscreenUser?.stream;
    const isGridScreenShare = !!gridFullscreenUser?.isScreenSharing;

    const _sv = streamVersion;

    return (
        <>
            <div className="meet-layout">
                <main className="meet-main">
                    {/* 플로팅 정보 배지 - 메인 스테이지 왼쪽 상단에 표시 */}
                    <div className="floating-info-badge">
                        <Users size={14} />
                        <span>{participants.length}명 접속 중</span>
                        <span className="badge-dot" />
                        <span>00:24:15</span>
                    </div>

                    {/* 레이아웃 전환 버튼 - 우측 상단 */}
                    <div className="floating-layout-toggle">
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

                    <div className="meet-stage">
                        {layoutMode === "speaker" ? (
                            <div className="layout-speaker">
                                <div className={`main-stage`} ref={mainStageRef}>
                                    {isBrowserPip && (
                                    <div className="pip-mode-banner">
                                        PiP 모드 이용중
                                    </div>
                                    )}

                                    <div className="main-video-area">
                                        <VideoTile
                                            user={mainUser}
                                            isMain
                                            stream={mainStream}
                                            roomReconnecting={roomReconnecting}
                                            isScreen={isMainScreenShare}
                                            reaction={mainUser?.reaction}
                                            videoRef={mainVideoRef}
                                            streamVersion={streamVersion}
                                        />

                                        <button className="pip-btn" onClick={enterPipForCurrentMain} title="PiP 모드">
                                            <PictureInPicture2 size={20} />
                                        </button>

                                        <button className="fullscreen-btn" onClick={handleFullscreen} title={isFullscreen ? "전체화면 종료" : "전체화면"}>
                                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                        </button>
                                    </div>

                                    {/* ===============================
                                        ✅ 전체화면 전용 UI
                                    =============================== */}
                                    {isFullscreen && (
                                    <>
                                            {/* 🎭 전체화면 이모지 팝업 */}
                                        {showReactions && (
                                        <div className="fullscreen-reaction-popup">
                                            {reactionEmojis.map((emoji) => (
                                            <button
                                                key={emoji}
                                                onClick={() => handleReaction(emoji)}
                                                className="reaction-btn"
                                                disabled={!!myReaction}
                                                style={myReaction ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                            >
                                                {emoji}
                                            </button>
                                            ))}
                                        </div>
                                        )}

                                        {/* 💬 전체화면 사이드바 (채팅/참여자) */}
                                        <div className={`fullscreen-sidebar ${sidebarOpen ? "open" : ""}`}>
                                        <div className="fullscreen-sidebar-inner">
                                            <div className="fullscreen-sidebar-header">
                                            <h2 className="sidebar-title">
                                                {sidebarView === "chat" ? "회의 채팅" : "참여자 목록"}
                                            </h2>
                                            <button onClick={() => setSidebarOpen(false)} className="close-btn">
                                                <X size={20} />
                                            </button>
                                            </div>

                                            {sidebarView === "chat" && (
                                            <>
                                                <div className="fullscreen-chat-area custom-scrollbar">
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
                                                <div className="fullscreen-chat-input-area">
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
                                            <div className="fullscreen-participants-area custom-scrollbar">
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
                                                    {p.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} />}
                                                    {p.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} />}
                                                    </div>
                                                </div>
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                        </div>

                                        {/* 🎛 전체화면 미디어 컨트롤 (7개 버튼 - 스트립과 함께 움직임) */}
                                        <div
                                        className={`fullscreen-media-controls ${
                                            isStripVisible ? "visible" : "hidden"
                                        }`}
                                        >
                                        <ButtonControl
                                            label={micOn ? "마이크 끄기" : "마이크 켜기"}
                                            icon={Mic}
                                            active={!micOn}
                                            disabled={micDisabled}
                                            onClick={toggleMic}
                                        />
                                        <ButtonControl
                                            label={camOn ? "카메라 끄기" : "카메라 켜기"}
                                            icon={Video}
                                            active={!camOn}
                                            disabled={camDisabled}
                                            onClick={toggleCam}
                                        />
                                        <div className="divider" />
                                        {!isIOS && (
                                            <ButtonControl
                                                label={isScreenSharing ? "화면 공유 중지" : "화면 공유"}
                                                icon={Monitor}
                                                active={isScreenSharing}
                                                onClick={() => {
                                                if (isScreenSharing) {
                                                    stopScreenShare();
                                                } else {
                                                    startScreenShare();
                                                }
                                                }}
                                            />
                                        )}
                                        <ButtonControl
                                            label="반응"
                                            icon={Smile}
                                            active={showReactions}
                                            onClick={() => setShowReactions(!showReactions)}
                                        />
                                        <ButtonControl
                                            label="채팅"
                                            icon={MessageSquare}
                                            active={sidebarOpen && sidebarView === "chat"}
                                            onClick={() => toggleSidebar("chat")}
                                        />
                                        <ButtonControl
                                            label="참여자"
                                            icon={Users}
                                            active={sidebarOpen && sidebarView === "participants"}
                                            onClick={() => toggleSidebar("participants")}
                                        />
                                        <div className="divider" />
                                        <ButtonControl
                                            label="통화 종료"
                                            danger
                                            icon={Phone}
                                            onClick={handleHangup}
                                        />
                                        </div>

                                        {/* 👥 참가자 스트립 */}
                                        <div
                                        className={`fullscreen-strip-wrapper ${
                                            isStripVisible ? "visible" : "hidden"
                                        }`}
                                        >
                                        <div className="fullscreen-strip custom-scrollbar">
                                            {orderedParticipants.map((p) => (
                                            <div
                                                key={p.id}
                                                className={`strip-item ${
                                                activeSpeakerId === p.id ? "active-strip" : ""
                                                } ${p.isScreenSharing ? "screen-sharing" : ""}`}
                                                onClick={() => {
                                                manuallySelectedRef.current = true;
                                                setActiveSpeakerId(p.id);
                                                }}
                                            >
                                                <VideoTile
                                                user={p}
                                                stream={
                                                    p.isScreenSharing
                                                    ? p.screenStream
                                                    : p.isMe
                                                    ? localStream
                                                    : p.stream
                                                }
                                                roomReconnecting={roomReconnecting}
                                                isScreen={p.isScreenSharing}
                                                reaction={p.reaction}
                                                streamVersion={streamVersion}
                                                />
                                                <span className="strip-name">
                                                {p.isMe ? "(나)" : p.name}
                                                </span>
                                            </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 🔼 스트립 토글 버튼 */}
                                    {showStripToggle && (
                                    <button
                                        className={`fullscreen-strip-toggle-btn show ${
                                        isStripVisible ? "down" : "up"
                                        }`}
                                        onClick={() => setIsStripVisible((v) => !v)}
                                        title={isStripVisible ? "참가자 숨기기" : "참가자 보기"}
                                    >
                                        {isStripVisible ? <ChevronDown /> : <ChevronUp />}
                                    </button>
                                    )}
                                </>
                                )}
                            </div>

                            {/* 일반 모드 하단 스트립 (전체화면 아님) */}
                            <div className="bottom-strip custom-scrollbar">
                                {orderedParticipants.map((p) => (
                                <div
                                    key={`participant-${String(p.id)}`}
                                    className={`strip-item ${
                                    activeSpeakerId === p.id ? "active-strip" : ""
                                    } ${p.isScreenSharing ? "screen-sharing" : ""}`}
                                    onClick={() => {
                                    manuallySelectedRef.current = true;
                                    setActiveSpeakerId(p.id);
                                    }}
                                >
                                    <VideoTile
                                        user={p}
                                        stream={
                                            p.isScreenSharing
                                            ? p.screenStream
                                            : p.isMe
                                            ? localStream
                                            : p.stream
                                        }
                                        roomReconnecting={roomReconnecting}
                                        isScreen={p.isScreenSharing}
                                        reaction={p.reaction}
                                        />
                                        <span className="strip-name">
                                        {p.isMe ? "(나)" : p.name}
                                        </span>
                                    </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Grid 모드 */
                            <div className={`layout-grid custom-scrollbar ${isGridFullscreen ? "fullscreen-active" : ""}`}>

                                {/* ✅ 그리드 전체화면 컨테이너 (전체화면일 때만 렌더링) */}
                                {isGridFullscreen && (
                                    <div
                                        ref={gridFullscreenStageRef}
                                        className={`grid-fullscreen-container active ${isGridScreenShare ? "screen-share-active" : ""} ${sidebarOpen ? "sidebar-open" : ""}`}
                                    >
                                        {/* 메인 비디오 영역 */}
                                        <div className="grid-fullscreen-video-area">
                                            <VideoTile
                                                user={gridFullscreenUser}
                                                isMain
                                                stream={gridFullscreenStream}
                                                roomReconnecting={roomReconnecting}
                                                isScreen={isGridScreenShare}
                                                reaction={gridFullscreenUser?.isMe ? myReaction : gridFullscreenUser?.reaction}
                                            />

                                            {/* 전체화면 토글 버튼 */}
                                            <button
                                                className="grid-fullscreen-btn"
                                                onClick={() => {
                                                    if (document.fullscreenElement) {
                                                        document.exitFullscreen();
                                                    } else {
                                                        gridFullscreenStageRef.current?.requestFullscreen().catch((err) => {
                                                            console.error("전체화면 전환 실패:", err);
                                                        });
                                                    }
                                                }}
                                                title="전체화면 종료"
                                            >
                                                <Minimize size={18} />
                                            </button>
                                        </div>

                                        {/* 전체화면 전용 UI */}
                                        <>
                                            {/* 이모지 팝업 */}
                                            {showReactions && (
                                                <div className="grid-fullscreen-reaction-popup">
                                                    {reactionEmojis.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleReaction(emoji)}
                                                            className="reaction-btn"
                                                            disabled={!!myReaction}
                                                            style={myReaction ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 사이드바 */}
                                            <div className={`grid-fullscreen-sidebar ${sidebarOpen ? "open" : ""}`}>
                                                <div className="grid-fullscreen-sidebar-inner">
                                                    <div className="grid-fullscreen-sidebar-header">
                                                        <h2 className="sidebar-title">
                                                            {sidebarView === "chat" ? "회의 채팅" : "참여자 목록"}
                                                        </h2>
                                                        <button onClick={() => setSidebarOpen(false)} className="close-btn">
                                                            <X size={20} />
                                                        </button>
                                                    </div>

                                                    {sidebarView === "chat" && (
                                                        <>
                                                            <div className="grid-fullscreen-chat-area custom-scrollbar">
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

                                                            <div className="grid-fullscreen-chat-input-area">
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
                                                        <div className="grid-fullscreen-participants-area custom-scrollbar">
                                                            <div className="section-label">참여 중 ({participants.length})</div>
                                                            {participants.map((part) => (
                                                                <div key={`participant-${String(part.id)}`} 
                                                                    className={`participant-card ${part.isMe ? "me" : ""}`}>
                                                                    <div className="p-info">
                                                                        <UserAvatar name={part.name} />
                                                                        <div>
                                                                            <div className={`p-name ${part.isMe ? "me" : ""}`}>
                                                                                {part.name} {part.isMe ? "(나)" : ""}
                                                                            </div>
                                                                            <div className="p-role">{part.isMe ? "나" : "팀원"}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-status">
                                                                        {part.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} />}
                                                                        {part.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} />}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 미디어 컨트롤 */}
                                            <div className={`grid-fullscreen-media-controls ${gridStripVisible ? "visible" : "hidden"}`}>
                                                <ButtonControl label={micOn ? "마이크 끄기" : "마이크 켜기"} icon={Mic} active={!micOn} disabled={micDisabled} onClick={toggleMic} />
                                                <ButtonControl label={camOn ? "카메라 끄기" : "카메라 켜기"} icon={Video} active={!camOn} disabled={camDisabled} onClick={toggleCam} />
                                                <div className="divider" />
                                                {!isIOS && (
                                                    <ButtonControl
                                                        label={isScreenSharing ? "화면 공유 중지" : "화면 공유"}
                                                        icon={Monitor}
                                                        active={isScreenSharing}
                                                        onClick={() => (isScreenSharing ? stopScreenShare() : startScreenShare())}
                                                    />
                                                )}
                                                <ButtonControl label="반응" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
                                                <ButtonControl label="채팅" icon={MessageSquare} active={sidebarOpen && sidebarView === "chat"} onClick={() => toggleSidebar("chat")} />
                                                <ButtonControl label="참여자" icon={Users} active={sidebarOpen && sidebarView === "participants"} onClick={() => toggleSidebar("participants")} />
                                                <div className="divider" />
                                                <ButtonControl label="통화 종료" danger icon={Phone} onClick={handleHangup} />
                                            </div>

                                            {/* 참가자 스트립 */}
                                            <div className={`grid-fullscreen-strip-wrapper ${gridStripVisible ? "visible" : "hidden"}`}>
                                                <div className="grid-fullscreen-strip custom-scrollbar">
                                                    {orderedParticipants.map((part) => (
                                                        <div
                                                            key={`participant-${String(part.id)}`}
                                                            className={`strip-item ${gridFullscreenId === part.id ? "active-strip" : ""} ${part.isScreenSharing ? "screen-sharing" : ""}`}
                                                            onClick={() => setGridFullscreenId(part.id)}
                                                        >
                                                            <VideoTile
                                                                user={part}
                                                                stream={
                                                                    part.isScreenSharing
                                                                        ? part.screenStream
                                                                        : part.isMe
                                                                        ? localStream
                                                                        : part.stream
                                                                }
                                                                roomReconnecting={roomReconnecting}
                                                                isScreen={part.isScreenSharing}
                                                                reaction={part.reaction}
                                                            />
                                                            <span className="strip-name">{part.isMe ? "(나)" : part.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 스트립 토글 버튼 */}
                                            {showGridStripToggle && (
                                                <button
                                                    className={`grid-fullscreen-strip-toggle-btn show ${gridStripVisible ? "down" : "up"}`}
                                                    onClick={() => setGridStripVisible((v) => !v)}
                                                    title={gridStripVisible ? "참가자 숨기기" : "참가자 보기"}
                                                >
                                                    {gridStripVisible ? <ChevronDown /> : <ChevronUp />}
                                                </button>
                                            )}
                                        </>
                                    </div>
                                )}

                                {/* 그리드 타일들 (전체화면이 아닐 때만 표시) */}
                                {!isGridFullscreen &&
                                    orderedParticipants.map((p) => (
                                        <div key={`participant-${String(p.id)}`} className="grid-tile">
                                            <div className="grid-video-area">
                                                <VideoTile
                                                    user={p}
                                                    stream={
                                                        p.isScreenSharing
                                                            ? p.screenStream
                                                            : p.isMe
                                                            ? localStream
                                                            : p.stream
                                                    }
                                                    roomReconnecting={roomReconnecting}
                                                    isScreen={p.isScreenSharing}
                                                    reaction={p.isMe ? myReaction : null}
                                                />

                                                <button
                                                    className="grid-fullscreen-btn"
                                                    onClick={() => {
                                                        setGridFullscreenId(p.id);
                                                        setIsGridFullscreen(true);
                                                    }}
                                                    title="전체화면"
                                                >
                                                    <Maximize size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                    <div className="meet-controls-container">
                        {showReactions && (
                            <div className="reaction-popup glass-panel">
                                {reactionEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReaction(emoji)}
                                        className="reaction-btn"
                                        disabled={!!myReaction}
                                        style={myReaction ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
                                onClick={toggleMic}
                            />
                            <ButtonControl
                                label={camOn ? "카메라 끄기" : "카메라 켜기"}
                                icon={Video}
                                active={!camOn}
                                disabled={camDisabled}
                                onClick={toggleCam}
                            />
                            <div className="divider"></div>
                            {!isIOS && (
                                <ButtonControl 
                                label={isScreenSharing ? "화면 공유 중지" : "화면 공유"}
                                icon={Monitor}
                                active={isScreenSharing}
                                onClick={() => {
                                    if (isScreenSharing) {
                                        stopScreenShare();
                                    } else {
                                        startScreenShare();
                                    }
                                }} />
                            )}
                            <ButtonControl label="반응" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
                            <ButtonControl label="채팅" active={sidebarOpen && sidebarView === "chat"} icon={MessageSquare} onClick={() => toggleSidebar("chat")} />
                            <ButtonControl label="참여자" active={sidebarOpen && sidebarView === "participants"} icon={Users} onClick={() => toggleSidebar("participants")} />
                            <div className="divider"></div>
                            <ButtonControl label="통화 종료" danger icon={Phone} onClick={handleHangup} />
                        </div>
                    </div>
                </main>

                <aside className={`meet-sidebar ${sidebarOpen && !isGridFullscreen && !isFullscreen ? "open" : ""}`}>
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