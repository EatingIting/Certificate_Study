import {
    LayoutGrid,
    Loader2,
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

// VideoTile 내부에서 오디오 레벨을 직접 감지
const VideoTile = ({ user, isMain = false, stream, isScreen }) => {
    const videoEl = useRef(null);
    const [isSpeakingLocally, setIsSpeakingLocally] = useState(false);
    
    // 트랙 상태를 별도로 관리 (검은 화면 방지용)
    const [isVideoTrackMuted, setIsVideoTrackMuted] = useState(true);

    const safeUser = user ?? {
        name: "대기 중",
        isMe: false,
        muted: false,
        cameraOff: true,
        speaking: false,
        isLoading: false,
    };

    
    
    const hasLiveVideoTrack = useMemo(() => {
        return (
            stream?.getVideoTracks().some(
                (t) => t.readyState === "live" && t.enabled !== false
            ) ?? false
        );
    }, [stream]);

    const canShowVideo = !!stream && hasLiveVideoTrack && (!safeUser.cameraOff || isScreen);

    // 1. 오디오 레벨 감지 (말할 때 초록 테두리)
    useEffect(() => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        let audioContext;
        let analyser;
        let animationId;

        try {
            const AudioContext =
                window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(
                analyser.frequencyBinCount
            );

            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg =
                    dataArray.reduce((a, b) => a + b, 0) /
                    dataArray.length;
                setIsSpeakingLocally(avg > 15);
                animationId = requestAnimationFrame(checkVolume);
            };

            checkVolume();
        } catch {
            /* ignore */
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (audioContext?.state !== "closed") audioContext.close();
        };
    }, [stream]);

    // 2. [핵심 수정] 비디오 트랙 상태 '초'강력 감지
    useEffect(() => {
        const videoTrack = stream?.getVideoTracks()[0];

        // 트랙이 없으면 무조건 아바타
        if (!videoTrack) {
            setIsVideoTrackMuted(true);
            return;
        }

        // 트랙 상태 확인 함수
        const checkState = () => {
            const isMuted = !videoTrack.enabled || videoTrack.muted || videoTrack.readyState === 'ended';
            setIsVideoTrackMuted(isMuted);
        };

        // 1. 즉시 실행
        checkState();

        // 2. 이벤트 리스너 등록
        videoTrack.addEventListener("mute", checkState);
        videoTrack.addEventListener("unmute", checkState);
        videoTrack.addEventListener("ended", checkState);

        // 3. [안전장치] 1초마다 강제로 다시 확인 (리액트 상태 엇갈림 방지)
        const interval = setInterval(checkState, 1000);

        return () => {
            videoTrack.removeEventListener("mute", checkState);
            videoTrack.removeEventListener("unmute", checkState);
            videoTrack.removeEventListener("ended", checkState);
            clearInterval(interval);
        };
    }, [stream, safeUser.cameraOff]); // safeUser.cameraOff가 변할 때도 재검사

    // 3. 비디오 재생
    useEffect(() => {
        const v = videoEl.current;
        if (!v || !canShowVideo || !stream) return;

        v.srcObject = stream;
        v.playsInline = true;
        v.muted = true; // 하울링 방지

        v.play().catch(() => {});
    }, [stream, canShowVideo]);

    const isSpeaking = safeUser.speaking || isSpeakingLocally;

    const isJoining = safeUser.isJoining;
    const isReconnecting = safeUser.isReconnecting;

    return (
        <div
            className={`video-tile ${
                isMain ? "main" : ""
            } ${isSpeaking ? "speaking" : ""}`}
        >
            {isJoining && (
                <div className="reconnecting-overlay">
                    <Loader2 className="spinner" />
                    <p>접속 중...</p>
                </div>
            )}

            {isReconnecting && (
                <div className="reconnecting-overlay">
                    <Loader2 className="spinner" />
                    <p>재접속 중...</p>
                </div>
            )}

            <div className="video-content">
                {canShowVideo ? (
                    <video
                        ref={videoEl}
                        autoPlay
                        playsInline
                        muted
                        className={`video-element ${isScreen ? "screen" : ""}`}
                    />
                ) : (
                    <div className="camera-off-placeholder">
                        <UserAvatar
                            name={safeUser.name}
                            size={isMain ? "lg" : "md"}
                        />
                        <p className="stream-label">{safeUser.name}</p>
                    </div>
                )}
            </div>

            {/* ✅ 상태 아이콘 (무조건 트랙 기준) */}
            {!isReconnecting && (
                <div className="video-overlay">
                    {safeUser.muted && (
                        <MicOff size={16} className="icon-red" />
                    )}
                    {safeUser.cameraOff && (
                        <VideoOff size={16} className="icon-red" />
                    )}
                </div>
            )}
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

    const [isSpeaking, setIsSpeaking] = useState(false);

    const [participants, setParticipants] = useState([]);
    const [activeSpeakerId, setActiveSpeakerId] = useState(null);

    const [streamVersion, setStreamVersion] = useState(0);

    const [isLoading, setIsLoading] = useState(false);

    const [isLocalLoading, setIsLocalLoading] = useState(true);

    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(`chat_${roomId}`);
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

    const micOnRef = useRef(micOn);
    const camOnRef = useRef(camOn);

    const reconnectTimeoutRef = useRef(new Map());

    const reconnectHistoryRef = useRef(new Set());

    const joiningTimeoutRef = useRef(new Map());

    const hasFinishedInitialSyncRef = useRef(false); // 초기 동기화 완료 플래그

    const lastActiveSpeakerRef = useRef(null);

    const screenStreamRef = useRef(null);
    const screenProducerRef = useRef(null);
    const cameraWasOnBeforeScreenShareRef = useRef(false); // 화면공유 시작 전 카메라 상태
    const isStoppingScreenShareRef = useRef(false); // stopScreenShare 중복 실행 방지
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    useEffect(() => { micOnRef.current = micOn; }, [micOn]);
    useEffect(() => { camOnRef.current = camOn; }, [camOn]);

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
        isScreenSharing: isScreenSharing,
        isLoading: isLocalLoading,
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

    const handleHangup = () => {
        alert("채팅이 종료되었습니다.");

        wsRef.current?.send(
            JSON.stringify({
                type: "LEAVE",
            })
        );
        
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
        } finally {
            // 6) 페이지 이동 (브라우저 종료 대신)
            window.location.href = "/LMS"; // 홈으로 보내기
            // 또는: window.location.replace("/ended");
        }
    };

    const getMainUser = () => {
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
            setIsLocalLoading(false);
            return localStreamRef.current;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            localStreamRef.current = stream;
            setLocalStream(stream);

            setMicPermission("granted");
            setCamPermission("granted");

            return stream;
        } catch (err) {
            setMicPermission("denied");
            setCamPermission("denied");
            return null;
        } finally {
            setIsLocalLoading(false);
            // ❌ 여기서 아직 roomReconnecting false 하면 안 됨
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
        // SFU 스트림만 제거
        peerStreamsRef.current.delete(peerId);

        setParticipants((prev) =>
            prev.map((p) =>
                p.id === peerId
                    ? {
                        ...p,
                        stream: null,
                        // ❗ cameraOff / muted는 서버 상태 유지
                    }
                    : p
            )
        );
    };
    
    const startScreenShare = async () => {
        if (!sendTransportRef.current || sendTransportRef.current.closed) {
            console.error("[startScreenShare] sendTransport not ready/closed");
            return;
        }

        if (producersRef.current.has("screen")) {
            console.warn("[startScreenShare] screen producer already exists");
            return;
        }

        try {
            console.log("[startScreenShare] requesting display media...");

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });

            const track = stream.getVideoTracks()[0];
            if (!track) return;

            // ❗ 이미 종료된 트랙 방어
            if (track.readyState === "ended") {
                return;
            }

            // 1️⃣ [수정] 기존 카메라가 켜져 있었다면 끄고, **서버에도 알림**
            const cameraProducer = producersRef.current.get("camera");
            if (cameraProducer) {
                const id = cameraProducer.id;
                cameraProducer.close();
                producersRef.current.delete("camera");

                // 🚀 [추가됨] 서버에 "나 카메라 껐어"라고 알려야 B가 A의 카메라 화면을 지웁니다.
                safeSfuSend({ 
                    action: "closeProducer", 
                    data: { producerId: id } 
                });
            }

            // 2️⃣ screen producer 생성
            console.log("[startScreenShare] producing screen...");
            const screenProducer = await sendTransportRef.current.produce({
                track,
                appData: { type: "screen" },
            });

            producersRef.current.set("screen", screenProducer);
            screenStreamRef.current = stream;

            setIsScreenSharing(true);
            
            // 내 UI 즉시 반영
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe
                        ? { ...p, screenStream: stream, isScreenSharing: true }
                        : p
                )
            );

            track.onended = () => {
                console.log("[startScreenShare] screen track ended by browser");
                stopScreenShare(true);
            };
        } catch (e) {
            console.error("[startScreenShare] failed:", e);

            // 혹시 stream이 남아있으면 정리
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => {
                    try { t.stop(); } catch {}
                });
                screenStreamRef.current = null;
            }

            // producer 남아있으면 정리
            const sp = producersRef.current.get("screen");
                if (sp) {
                    try { sp.close(); } catch {}
                producersRef.current.delete("screen");
            }

            setIsScreenSharing(false);
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe ? { ...p, screenStream: null, isScreenSharing: false } : p
                )
            );
        }
    };

    const stopScreenShare = async (fromTrackEnded = false) => { // async 키워드 추가 권장
        // 중복 실행 방지
        if (isStoppingScreenShareRef.current) return;
        isStoppingScreenShareRef.current = true;

        try {
            console.log(
                "[stopScreenShare]",
                fromTrackEnded ? "from track.onended" : "from button"
            );

            // 1️⃣ [수정] screen producer 닫기 및 **서버 알림**
            const screenProducer = producersRef.current.get("screen");
            if (screenProducer) {
                const id = screenProducer.id; // ID 미리 저장
                try {
                    if (!screenProducer.closed) screenProducer.close();
                } catch (e) {
                    console.warn("[stopScreenShare] error closing:", e);
                }
                producersRef.current.delete("screen");

                // 🚀 [추가됨] 서버에 "나 화면 공유 껐어"라고 알려야 B가 화면 공유 모드를 해제합니다.
                safeSfuSend({ 
                    action: "closeProducer", 
                    data: { producerId: id } 
                });
            }

            // 2) screen stream 트랙 stop (로컬 정리)
            if (screenStreamRef.current) {
                const tracks = screenStreamRef.current.getTracks();
                tracks.forEach((t) => {
                    try { t.stop(); } catch { }
                });
                screenStreamRef.current = null;
            }

            // 3) 로컬 UI 복구
            setIsScreenSharing(false);
            
            // 4️⃣ [중요] 카메라 다시 켜기 (A의 원래 스트림 복구)
            // 화면 공유를 끄면 자동으로 카메라를 다시 켜서 송출해야 B도 A의 얼굴을 다시 볼 수 있습니다.
            try {
                if (camOn && sendTransportRef.current) {
                    console.log("[stopScreenShare] restarting camera...");
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: true, 
                        audio: false 
                    });
                    const videoTrack = stream.getVideoTracks()[0];
                    
                    const cameraProducer = await sendTransportRef.current.produce({
                        track: videoTrack,
                        appData: { type: "camera" },
                    });
                    
                    producersRef.current.set("camera", cameraProducer);
                    
                    // 내 로컬 스트림 업데이트 (그래야 내 화면에 내 얼굴이 보임)
                    setLocalStream((prev) => {
                         // 기존 오디오 트랙이 있다면 합치기
                         const newStream = new MediaStream([videoTrack]);
                         if (prev) {
                             prev.getAudioTracks().forEach(t => newStream.addTrack(t));
                         }
                         localStreamRef.current = newStream;
                         return newStream;
                    });
                }
            } catch (err) {
                console.error("Failed to restart camera:", err);
            }

            // UI 업데이트
            setParticipants((prev) =>
                prev.map((p) =>
                    p.isMe 
                    ? { 
                        ...p, 
                        screenStream: null, 
                        isScreenSharing: false,
                        // 카메라 재시작 후 stream이 업데이트 되는 것은 useEffect(localStream)이 처리하거나
                        // 위 setLocalStream에 의해 리렌더링되며 반영됨.
                      } 
                    : p
                )
            );

        } finally {
            isStoppingScreenShareRef.current = false;
        }
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

                console.log(
                    "[consume:response]",
                    "peerId =", peerId,
                    "producerId =", producerId,
                    "appData =", finalAppData
                );

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

                console.log(
                    "[SFU][consumer created]",
                    "peerId =", peerId,
                    "producerId =", producerId,
                    "isScreen =", isScreen,
                    "consumer.appData =", consumer.appData
                );

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
                            if (t.readyState !== "ended") {
                                next.addTrack(t);
                            }
                        });
                    }

                    next.addTrack(consumer.track);
                    peerStreamsRef.current.set(peerId, next);
                    mergedCameraStream = next;
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

                                // ✅ 오디오 consumer면 muted=false가 자연스럽습니다.
                                muted: kind === "audio" ? false : true,
                                cameraOff: false,
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

                        // ✅ 오디오 consumer가 붙으면 muted 해제 (video consumer는 건드리지 않음)
                        muted: kind === "audio" ? false : p.muted,

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

    const toggleMic = () => {
        const newVal = !micOn;
        setMicOn(newVal);
        localStorage.setItem("micOn", newVal); // ✅ 상태 저장

        // 1. 실제 오디오 트랙 제어
        if (localStreamRef.current) {
            const at = localStreamRef.current.getAudioTracks()[0];
            if (at) at.enabled = newVal;
        }

        // 2. 내 화면 업데이트
        setParticipants((prev) =>
            prev.map((p) => (p.isMe ? { ...p, muted: !newVal } : p))
        );

        // 3. 서버 전송
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId: userId,
                    changes: { muted: !newVal },
                })
            );
        }
    };

    const toggleCam = () => {
        const newVal = !camOn;
        setCamOn(newVal);
        localStorage.setItem("camOn", newVal);

        // 1. 실제 비디오 트랙 제어
        if (localStreamRef.current) {
            const vt = localStreamRef.current.getVideoTracks()[0];
            if (vt) vt.enabled = newVal;
        }

        // 2. 내 화면 업데이트
        setParticipants((prev) =>
            prev.map((p) => (p.isMe ? { ...p, cameraOff: !newVal } : p))
        );

        // 3. 서버 전송
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId: userId,
                    changes: { cameraOff: !newVal },
                })
            );
        }
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
        const screenSharer = participants.find(p => p.isScreenSharing);

        // 1. 누군가(나 포함) 화면 공유 중일 때
        if (screenSharer) {
            // 현재 발표자가 그 사람이 아닐 때만 변경 (무한 루프 방지)
            if (activeSpeakerId !== screenSharer.id) {
                lastActiveSpeakerRef.current = activeSpeakerId; 
                setActiveSpeakerId(screenSharer.id);
                setLayoutMode("speaker"); // 화면 공유 시작 시 스피커 모드로 자동 전환
            }
        }
        // 2. 화면 공유가 끝났을 때 원래 발표자로 복귀
        else if (lastActiveSpeakerRef.current) {
            setActiveSpeakerId(lastActiveSpeakerRef.current);
            lastActiveSpeakerRef.current = null;
        }
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
            try {
                wsRef.current?.send(
                    JSON.stringify({
                        type: "RECONNECTING",
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

/*     useEffect(() => {
        if (!userId) return;

        if (!joinOrderRef.current.includes(userId)) {
            joinOrderRef.current.push(userId);
        }
    }, [userId]); */

    useEffect(() => {
        const interval = setInterval(() => {
            setParticipants(prev =>
                prev.map(p => {
                    if (!p.isReconnecting) return p;

                    const elapsed = Date.now() - (p.reconnectStartedAt ?? 0);

                    // 최소 800ms는 보여주기
                    if (elapsed < 800) return p;

                    // 스트림이 생겼거나, 카메라 OFF면 종료
                    if (p.stream || p.cameraOff) {
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

        let ws = null;
        let pingInterval = null; // 💓 핑 타이머 변수

        const connect = () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl = `${protocol}//${window.location.host}/ws/room/${roomId}` +
                          `?userId=${encodeURIComponent(userId)}` +
                          `&userName=${encodeURIComponent(userName)}` +
                          `&muted=${!micOnRef.current}` +  
                          `&cameraOff=${!camOnRef.current}`; 

            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ SPRING WS CONNECTED");
                setChatConnected(true);

                ws.send(JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId: userId,
                    changes: {
                    muted: !micOnRef.current,
                    cameraOff: !camOnRef.current,
                    },
                }));
                
                pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "PING" }));
                    }
                }, 30000);
            };

            ws.onclose = () => {
                console.log("❌ WS CLOSED");
                setChatConnected(false);
                if (pingInterval) clearInterval(pingInterval); // 타이머 정리
            };

            ws.onerror = (error) => {
                console.error("❌ WS ERROR", error);
                setChatConnected(false);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === "PONG") return;

                if (data.type === "USERS_UPDATE" && Array.isArray(data.users)) {
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
                            const hasReconnectHistory = reconnectHistoryRef.current.has(peerId);

                            /* -------------------------------------------------
                            [핵심] 기존 로컬 상태(스트림, 화면공유) 보존하며 병합
                            ------------------------------------------------- */
                            const baseUser = {
                                id: peerId,
                                name: u.userName,
                                joinAt: u.joinAt,
                                isMe,

                                // 내 상태는 로컬(micOnRef) 기준, 타인은 서버 혹은 기존 상태 기준
                                muted: isMe ? !micOnRef.current : (u.muted ?? old?.muted ?? true),
                                cameraOff: isMe ? !camOnRef.current : (u.cameraOff ?? old?.cameraOff ?? true),

                                // 🚀 [중요] 스트림 정보는 서버가 모르므로, 기존(old) 것을 유지해야 함
                                stream: old?.stream ?? null,
                                speaking: old?.speaking ?? false,

                                // 🚀 [중요] 화면 공유 정보도 기존(old) 것을 반드시 유지
                                screenStream: old?.screenStream ?? null,
                                isScreenSharing: old?.isScreenSharing ?? false,

                                // 접속 상태
                                isJoining: false,
                                isReconnecting: old?.isReconnecting ?? false,
                                isLoading: false, 

                                lastUpdate: Date.now(),
                            };

                            // 신규 유저(재접속 아님)인 경우 로딩 표시
                            if (!old && !hasReconnectHistory) {
                                // 내 로컬 스트림이 있거나, 이미 로드된 경우 스킵
                                const shouldStopLoading = isMe && localStreamRef.current;
                                return { 
                                    ...baseUser, 
                                    isJoining: true, 
                                    isLoading: !shouldStopLoading 
                                };
                            }

                            // 기존 유저(재접속 포함)
                            const shouldStopLoading = isMe && localStreamRef.current;
                            return {
                                ...baseUser,
                                isReconnecting: hasReconnectHistory && !shouldStopLoading && (baseUser.isReconnecting),
                                isLoading: !shouldStopLoading && baseUser.isLoading
                            };
                        });

                        // 2. [Ghost Retention] 서버 목록엔 없지만, 스트림이 살아있는 유저 유지
                        //    (서버가 잠시 유저를 누락해도 클라이언트에서 타일을 지우지 않음)
                        const ghostUsers = prev.filter((p) => {
                            const pid = String(p.id);
                            if (p.isMe) return false; // 나는 위에서 처리됨
                            if (newServerIds.has(pid)) return false; // 이미 업데이트됨

                            // 💡 스트림이나 화면 공유가 살아있다면 강제로 유지
                            if (p.stream || p.screenStream) {
                                // console.warn(`[Ghost] ${p.name} maintained locally (has stream)`);
                                return true;
                            }
                            return false;
                        });

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
                    setParticipants((prev) =>
                        prev.map((p) => {
                            if (String(p.id) === String(data.userId)) {
                                return { ...p, ...data.changes };
                            }
                            return p;
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

        connect();

        return () => {
            if (pingInterval) clearInterval(pingInterval);
            if (wsRef.current) wsRef.current.close();
        };
    }, [roomId, userId, userName]); // 의존성 배열 유지

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

                    if (localStream) {
                        for (const track of localStream.getTracks()) {
                            const type =
                                track.kind === "video" ? "camera" : "audio";

                            const producer = await sendTransport.produce({
                                track,
                                appData: { type },
                            });

                            producersRef.current.set(type, producer);
                        }
                    } else {
                        console.log("카메라가 없어서 영상 송출이 제한됩니다.");
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

                console.log("[producerClosed]", {
                    producerId,
                    peerId,
                    isScreen,
                    appData
                });

                // 1. UI 상태 업데이트
                setParticipants(prev =>
                    prev.map(p => {
                        // 해당 peer의 producer가 닫힌 경우
                        if (String(p.id) === String(peerId)) {
                            if (isScreen) {
                                console.log(`[producerClosed] clearing screen for peer ${peerId}`);
                                return {
                                    ...p,
                                    screenStream: null,
                                    isScreenSharing: false,
                                    lastUpdate: Date.now()
                                };
                            } else {
                                console.log(`[producerClosed] clearing camera stream for peer ${peerId}`);
                                return {
                                    ...p,
                                    stream: null,
                                    lastUpdate: Date.now()
                                };
                            }
                        }
                        return p;
                    })
                );

                // 2. 리소스 정리
                if (producerId) {
                    const c = consumersRef.current.get(producerId);
                    if (c) {
                        try {
                            c.close();
                            console.log(`[producerClosed] consumer closed: ${producerId}`);
                        } catch {}
                    }
                    consumersRef.current.delete(producerId);

                    const a = audioElsRef.current.get(producerId);
                    if (a) {
                        try { a.srcObject = null; } catch {}
                        audioElsRef.current.delete(producerId);
                    }
                    bumpStreamVersion();
                }
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
        if (lastSpeakingRef.current === isSpeaking) return;
        lastSpeakingRef.current = isSpeaking;
        wsRef.current.send(
            JSON.stringify({
                type: "SPEAKING",
                speaking: isSpeaking,
            })
        );
    }, [isSpeaking]);

    const mainUser = getMainUser();

    const mainStream =
    mainUser?.isScreenSharing && mainUser?.screenStream
        ? mainUser.screenStream
        : mainUser?.isMe
            ? localStream
            : mainUser?.stream;

    const isMainScreenShare = !!mainUser?.isScreenSharing;

    const orderedParticipants = useMemo(() => {
        return [...participants].sort(
            (a, b) => (a.joinAt ?? 0) - (b.joinAt ?? 0)
        );
    }, [participants]);

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

                    <div className="meet-stage">
                        {layoutMode === "speaker" ? (
                            <div className="layout-speaker">
                                <div className={`main-stage ${isMainScreenShare ? "screen-share-active" : ""}`}>
                                    <VideoTile
                                        user={mainUser}
                                        isMain
                                        stream={mainStream}
                                        roomReconnecting={roomReconnecting}
                                        isScreen={isMainScreenShare}
                                    />
                                </div>
                                <div className="bottom-strip custom-scrollbar">
                                    {orderedParticipants.map((p) => (
                                        <div
                                            key={p.id}
                                            className={`strip-item ${
                                                activeSpeakerId === p.id ? "active-strip" : ""
                                            } ${p.isScreenSharing ? "screen-sharing" : ""}`}  // 🔴 테두리용
                                            onClick={() => setActiveSpeakerId(p.id)}
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
                                                isScreen={p.isScreenSharing}
                                            />
                                            <span className="strip-name">
                                                {p.isMe ? "(나)" : p.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="layout-grid custom-scrollbar">
                                {orderedParticipants.map((p) => (
                                    <div key={p.id} className="video-tile-wrapper">
                                        <VideoTile
                                            user={p}
                                            stream={
                                                p.isScreenSharing
                                                    ? p.screenStream
                                                    : p.isMe
                                                        ? localStream
                                                        : p.stream
                                            }
                                            isScreen={p.isScreenSharing}
                                        />
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
                            <ButtonControl label="반응" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
                            <ButtonControl label="채팅" active={sidebarOpen && sidebarView === "chat"} icon={MessageSquare} onClick={() => toggleSidebar("chat")} />
                            <ButtonControl label="참여자" active={sidebarOpen && sidebarView === "participants"} icon={Users} onClick={() => toggleSidebar("participants")} />
                            <div className="divider"></div>
                            <ButtonControl label="통화 종료" danger icon={Phone} onClick={handleHangup} />
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