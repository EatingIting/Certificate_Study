import {
    ChevronDown, ChevronUp, LayoutGrid, Loader2, Maximize, Minimize, MessageSquare, Mic, MicOff,
    Monitor, MoreHorizontal, Phone, PictureInPicture2, Send, Share, Smile, Users, Video, VideoOff, X,
} from "lucide-react";
import "pretendard/dist/web/static/pretendard.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";
import "./MeetingPage.css";
import { useMeeting } from "./MeetingContext";
import Toast from "../toast/Toast";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    VRMHumanBoneName,
    VRMLoaderPlugin,
    VRMUtils,
} from "@pixiv/three-vrm";

// --- Components ---

const ButtonControl = ({ active, danger, disabled, icon: Icon, onClick, label }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`btn-control ${danger ? "danger" : ""} ${active ? "active" : ""} ${disabled ? "disabled" : ""
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
const VideoTile = ({ user, isMain = false, stream, isScreen, reaction, roomReconnecting = false, videoRef }) => {
    const internalVideoRef = useRef(null);
    const videoEl = internalVideoRef;

    const setVideoRef = (el) => {
        internalVideoRef.current = el;
        if (videoRef) videoRef.current = el;
    };

    const [isSpeakingLocally, setIsSpeakingLocally] = useState(false);
    const [isVideoTrackMuted, setIsVideoTrackMuted] = useState(true);

    const safeUser = user ?? {
        name: "대기 중",
        isMe: false,
        muted: true,
        cameraOff: true,
        speaking: false,
        isLoading: false,
    };

    const showVideoOffIcon = safeUser.cameraOff;

    const hasLiveVideoTrack = useMemo(() => {
        return stream?.getVideoTracks().some((t) => t.readyState === "live") ?? false;
    }, [stream]);

    const canShowVideo = useMemo(() => {
        if (!stream) return false;

        // 화면공유는 videoTrack이 있으면 보여줌
        if (isScreen) return stream.getVideoTracks().length > 0;

        // ✅ 로컬(나) 영상은 canvas capture 등 synthetic track에서 muted 플래그가
        // 오래 유지될 수 있어 muted 여부로 숨기지 않는다.
        if (safeUser.isMe) return hasLiveVideoTrack;

        // 원격 카메라 영상은 트랙 상태 기반
        if (isVideoTrackMuted) return false;
        return hasLiveVideoTrack;
    }, [stream, isScreen, hasLiveVideoTrack, isVideoTrackMuted, safeUser.isMe]);

    // ✅ 핵심: "실제로 video를 렌더링할지"를 별도로 결정
    // - 카메라OFF면 절대 video 렌더링하지 않음 (상대방 흰타일 방지)
    // - 화면공유는 cameraOff와 무관하게 렌더링
    const shouldRenderVideo = useMemo(() => {
        if (!stream) return false;
        if (isScreen) return stream.getVideoTracks().length > 0;
        if (safeUser.cameraOff) return false;
        return canShowVideo;
    }, [stream, isScreen, safeUser.cameraOff, canShowVideo]);

    // 오디오 레벨 감지
    /* useEffect(() => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        let audioContext;
        let analyser;
        let animationId;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setIsSpeakingLocally(avg > 15);
                animationId = requestAnimationFrame(checkVolume);
            };

            checkVolume();
        } catch {
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (audioContext?.state !== "closed") audioContext.close();
        };
    }, [stream]); */

    // 비디오 트랙 상태 감지
    useEffect(() => {
        const videoTrack = stream?.getVideoTracks()[0];
        if (!videoTrack) {
            setIsVideoTrackMuted(true);
            return;
        }

        const checkState = () => {
            const muted = !videoTrack.enabled || videoTrack.muted || videoTrack.readyState === "ended";
            setIsVideoTrackMuted(muted);
        };

        // 🔥 stream이 변경되면 즉시 상태 체크 (초기화)
        checkState();

        videoTrack.addEventListener("mute", checkState);
        videoTrack.addEventListener("unmute", checkState);
        videoTrack.addEventListener("ended", checkState);

        // 🔥 트랙이 live 상태가 될 때까지 짧은 간격으로 체크
        const quickCheck = setInterval(checkState, 100);
        setTimeout(() => clearInterval(quickCheck), 2000); // 2초 후 빠른 체크 중지

        const interval = setInterval(checkState, 1000);

        return () => {
            videoTrack.removeEventListener("mute", checkState);
            videoTrack.removeEventListener("unmute", checkState);
            videoTrack.removeEventListener("ended", checkState);
            clearInterval(quickCheck);
            clearInterval(interval);
        };
    }, [stream, safeUser.cameraOff, isScreen]);

    // 🔥 stream 참조를 추적하여 변경 감지 강화
    const streamIdRef = useRef(null);
    const currentStreamId = stream?.id ?? null;

    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        if (!shouldRenderVideo) {
            try {
                v.pause();
            } catch {

            }
            if (v.srcObject) v.srcObject = null;
            streamIdRef.current = null;
            return;
        }

        // 🔥 stream id가 변경되었거나 srcObject가 없으면 강제로 다시 설정
        const needsUpdate = streamIdRef.current !== currentStreamId || v.srcObject !== stream;

        if (stream && needsUpdate) {
            console.log("[VideoTile] updating srcObject, streamId:", currentStreamId);
            v.srcObject = stream;
            streamIdRef.current = currentStreamId;
        }

        v.muted = true;
        v.play().catch(() => { });
    }, [stream, shouldRenderVideo, currentStreamId])

    const isSpeaking = safeUser.speaking || isSpeakingLocally;
    const isJoining = safeUser.isJoining;
    const isReconnecting = safeUser.isReconnecting;

    const showRoomReconnecting = roomReconnecting && !safeUser.isMe;

    // pip 모드 여부 확인 (렌더링 시점)
    // const isCurrentlyInPip = document.pictureInPictureElement === videoEl.current;

    return (
        <div className={`video-tile ${isMain ? "main" : ""} ${isSpeaking ? "speaking" : ""}`}>
            {/* ✅ roomReconnecting이 false면 접속 중 스피너도 표시 안 함 */}
            {roomReconnecting && (isJoining && !safeUser.isMe) && (
                <div className="reconnecting-overlay">
                    <Loader2 className="spinner" />
                    <p>접속 중...</p>
                </div>
            )}

            {/* ✅ roomReconnecting이 false면 개별 isReconnecting도 무시 (PIP 복귀 후 스피너 강제 해제) */}
            {roomReconnecting && ((isReconnecting && !safeUser.isMe) || showRoomReconnecting) && (
                <div className="reconnecting-overlay">
                    <Loader2 className="spinner" />
                    <p>재접속 중...</p>
                </div>
            )}

            <div className="video-content">
                <video
                    ref={setVideoRef}
                    autoPlay
                    playsInline
                    muted
                    data-main-video
                    className={`video-element ${isScreen ? "screen" : ""}`}
                    style={{
                        display: shouldRenderVideo ? "block" : "none"
                    }}
                />

                {!shouldRenderVideo && (
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

function MeetingPage() {
    const { subjectId, roomId } = useParams();
    const navigate = useNavigate();
    const loggedRef = useRef(false);

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
        requestBrowserPip,
    } = useMeeting();

    useEffect(() => {
        if (!roomId || !subjectId) return;

        console.log("[MeetingPage] startMeeting", { roomId, subjectId });
        startMeeting(roomId, subjectId);
    }, [roomId, subjectId, startMeeting]);

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

    const [isLocalLoading, setIsLocalLoading] = useState(true);
    const [recvTransportReady, setRecvTransportReady] = useState(false);

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

    // 🔥 토스트 메시지 상태
    const [toastMessage, setToastMessage] = useState("");
    const [showToast, setShowToast] = useState(false);

    // 🔥 얼굴 이모지 필터
    const [faceEmoji, setFaceEmoji] = useState(() => {
        try {
            return sessionStorage.getItem("faceEmoji") || "";
        } catch {
            return "";
        }
    });

    // 🔥 얼굴 필터 모드: "", "emoji", "avatar"
    const [faceMode, setFaceMode] = useState(() => {
        try {
            return sessionStorage.getItem("faceMode") || "";
        } catch {
            return "";
        }
    });

    // 🔥 (emoji쪽) 배경 지우기 토글
    const [bgRemove, setBgRemove] = useState(() => {
        try {
            return sessionStorage.getItem("faceBgRemove") === "true";
        } catch {
            return false;
        }
    });

    // 이전 버전(emoji만 저장)과의 호환: faceEmoji만 있고 mode가 없으면 emoji로 간주
    useEffect(() => {
        if (!faceMode && (faceEmoji || bgRemove)) {
            setFaceMode("emoji");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* const [pipClosedByCameraOff, setPipClosedByCameraOff] = useState(false);
    const [showPipReopenButton, setShowPipReopenButton] = useState(false); */

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
    const isInitialMountRef = useRef(true);

    const reactionTimersRef = useRef({});

    const micOnRef = useRef(micOn);
    const camOnRef = useRef(camOn);
    const micPermissionRef = useRef(micPermission);
    const camPermissionRef = useRef(camPermission);
    // ✅ 필터 적용/해제 시 재사용할 "실제 카메라" 트랙(중복 getUserMedia로 검은화면 나는 것 방지)
    const lastCameraTrackRef = useRef(null);

    // 🔥 얼굴 필터 파이프라인 refs
    const faceEmojiRef = useRef(faceEmoji);
    const faceModeRef = useRef(faceMode);
    const bgRemoveRef = useRef(bgRemove);
    const faceFilterActiveRef = useRef(false);
    const faceFilterRafRef = useRef(null);
    const faceFilterVideoElRef = useRef(null);
    const faceFilterCanvasRef = useRef(null);
    const faceBgFrameCanvasRef = useRef(null);       // 배경 제거용 프레임 캔버스(비디오 프레임)
    const faceBgMaskCanvasRef = useRef(null);        // 배경 제거용 마스크 캔버스
    const faceBgSegmenterRef = useRef(null);         // MediaPipe ImageSegmenter
    const faceBgLastInferAtRef = useRef(0);
    const faceFilterOutStreamRef = useRef(null);
    const faceFilterOutTrackRef = useRef(null);
    const faceFilterRawTrackRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const lastFaceBoxRef = useRef(null);
    const lastDetectAtRef = useRef(0);
    // ✅ 얼굴 이모지 필터 start/stop 레이스 방지용 오퍼레이션 큐
    const faceEmojiOpRef = useRef(Promise.resolve());

    // 🔥 항상 canvas 파이프라인 사용 (처음부터 producer는 canvas track을 사용)
    const canvasPipelineActiveRef = useRef(false);
    const canvasPipelineRafRef = useRef(null);
    const canvasPipelineVideoElRef = useRef(null);   // 카메라 원본 재생용 hidden video
    const canvasPipelineCanvasRef = useRef(null);    // 항상 사용하는 출력 canvas
    const canvasPipelineOutTrackRef = useRef(null);  // producer에 연결된 canvas track
    const canvasPipelineRawTrackRef = useRef(null);  // 카메라 원본 track

    // 🔥 3D 아바타 필터 파이프라인 refs
    const avatarFilterActiveRef = useRef(false);
    const avatarFilterRafRef = useRef(null);
    const avatarVideoElRef = useRef(null);          // 원본 트랙 재생용 video
    const avatarOutCanvasRef = useRef(null);        // 최종 합성 canvas
    const avatarOutTrackRef = useRef(null);         // 송출용 video track
    const avatarRawTrackRef = useRef(null);         // 원본 video track
    const faceLandmarkerRef = useRef(null);         // MediaPipe FaceLandmarker
    const avatarThreeRef = useRef(null);            // { renderer, scene, camera, vrm, clock }
    const lastAvatarFaceRef = useRef({              // 최신 추론 결과
        bbox: null,
        videoW: 0,
        videoH: 0,
    });

    const reconnectTimeoutRef = useRef(new Map());

    const reconnectHistoryRef = useRef(new Set());

    const reconnectCompletedTimeRef = useRef(new Map());  // ✅ 재접속 완료 시간 기록 (1초 동안 다시 추가 방지)

    const joiningTimeoutRef = useRef(new Map());

    const everOnlineRef = useRef(new Set());

    const hasFinishedInitialSyncRef = useRef(false); // 초기 동기화 완료 플래그

    const lastActiveSpeakerRef = useRef(null);
    const manuallySelectedRef = useRef(false);  // 사용자가 수동으로 타일을 선택했는지 여부

    const screenStreamRef = useRef(null);

    const roomSyncHandlerRef = useRef(null); // room:sync response handler 추적
    const roomSyncRequestedRef = useRef(false); // room:sync 요청 중복 방지
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

    /* 브라우저 pip 관련 로직 */
    const mainVideoRef = useRef(null);

    const userId = userIdRef.current;
    const userName = userNameRef.current;

    const hasAudioTrack = localStream?.getAudioTracks().length > 0;
    // const hasVideoTrack = localStream?.getVideoTracks().length > 0;

    const micMuted = !hasAudioTrack || !micOn;
    const camMuted = !camOn;

    const micDisabled = micPermission !== "granted";
    const camDisabled = camPermission !== "granted";

    const faceEmojis = useMemo(
        () => ["🤖", "👽", "👻", "😺", "😸", "😹", "🙈", "🙉", "🙊", "🐵"],
        []
    );

    const me = {
        id: userId,
        name: userName,
        muted: micMuted,
        cameraOff: !camOn,
        speaking: isSpeaking,
        isMe: true,
        stream: localStream,
        screenStream: isScreenSharing ? screenStreamRef.current : null,
        isScreenSharing,
        isLoading: isLocalLoading,
    };

    const getMainUser = useCallback(() => {
        const found = participants.find(
            (p) => String(p.id) === String(activeSpeakerId)
        );
        return found || me;
    }, [participants, activeSpeakerId, me]);

    const mainUser = getMainUser();

    // ✅ mainStream 계산은 기존 로직(화면공유 포함)을 그대로 쓰시면 됩니다.
    // 여기서는 단순화해두었으니, 당신 원본의 mainStream 계산식으로 교체하세요.
    const mainStream =
        mainUser?.isScreenSharing && mainUser?.screenStream
            ? mainUser.screenStream
            : mainUser?.isMe
                ? localStream
                : mainUser?.stream;

    const isMainScreenShare = !!mainUser?.isScreenSharing; // 원본 유지 시 사용

    // 전체화면 핸들러 (원본 유지)
    const handleFullscreen = () => {
        if (!mainStageRef.current) return;
        if (!document.fullscreenElement) {
            mainStageRef.current.requestFullscreen().catch((err) => console.error("전체화면 전환 실패:", err));
        } else {
            document.exitFullscreen();
        }
    };

    // ✅ 강제 PiP: 사이드바 열 때 브라우저 PiP 실행
    const toggleSidebar = (view) => {
        if (sidebarOpen && sidebarView === view) {
            setSidebarOpen(false);
        } else {
            setSidebarView(view);
            setSidebarOpen(true);
        }
    };

    // 🔥 초대 링크 복사
    const handleInvite = async () => {
        const inviteUrl = window.location.href;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setToastMessage("링크가 복사되었습니다.");
            setShowToast(true);
        } catch (err) {
            console.error("클립보드 복사 실패:", err);
            // fallback
            const textArea = document.createElement("textarea");
            textArea.value = inviteUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setToastMessage("링크가 복사되었습니다.");
            setShowToast(true);
        }
    };

    const turnOffCamera = async () => {
        // 1) Canvas 파이프라인 정리
        canvasPipelineActiveRef.current = false;
        if (canvasPipelineRafRef.current) {
            cancelAnimationFrame(canvasPipelineRafRef.current);
            canvasPipelineRafRef.current = null;
        }
        if (canvasPipelineVideoElRef.current) {
            try { canvasPipelineVideoElRef.current.pause(); } catch { }
            try { canvasPipelineVideoElRef.current.srcObject = null; } catch { }
            try { canvasPipelineVideoElRef.current.remove(); } catch { }
            canvasPipelineVideoElRef.current = null;
        }
        try { canvasPipelineOutTrackRef.current?.stop?.(); } catch { }
        canvasPipelineOutTrackRef.current = null;
        try { canvasPipelineRawTrackRef.current?.stop?.(); } catch { }
        canvasPipelineRawTrackRef.current = null;
        canvasPipelineCanvasRef.current = null;

        // 2) 기존 필터 정리 (호환성)
        if (faceModeRef.current === "avatar" || avatarFilterActiveRef.current) {
            await stopAvatarFilter();
        }
        if (faceModeRef.current === "emoji" || faceEmojiRef.current || faceFilterActiveRef.current) {
            await stopFaceEmojiFilter();
        }

        // 3) Producer close (새 아키텍처에서는 매번 새로 생성하므로 close)
        const producer = producersRef.current.get("camera");
        if (producer) {
            try { producer.close(); } catch { }
            producersRef.current.delete("camera");
            console.log("[turnOffCamera] producer closed");
        }

        // 4) 로컬 스트림에서 비디오 트랙 제거
        const prevAudio = localStreamRef.current
            ?.getAudioTracks()
            .filter((t) => t.readyState === "live") ?? [];

        try {
            localStreamRef.current?.getVideoTracks?.()?.forEach((t) => {
                try { t.stop(); } catch { }
            });
        } catch { }

        const audioOnly = new MediaStream([...prevAudio]);
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);

        setCamOn(false);
        localStorage.setItem("camOn", "false");

        // ⭐ 서버에 상태 전파
        wsRef.current?.send(JSON.stringify({
            type: "USER_STATE_CHANGE",
            userId,
            changes: { cameraOff: true },
        }));

        console.log("[turnOffCamera] camera and canvas pipeline stopped");
    };

    const turnOnCamera = async () => {
        if (!sendTransportRef.current || sendTransportRef.current.closed) {
            console.warn("[turnOnCamera] sendTransport not ready");
            return;
        }

        // 1) 카메라 트랙 획득
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const rawTrack = stream.getVideoTracks()[0];
        console.log("[turnOnCamera] got camera track:", rawTrack.id, rawTrack.readyState);
        if (isLikelyCameraTrack(rawTrack)) lastCameraTrackRef.current = rawTrack;
        canvasPipelineRawTrackRef.current = rawTrack;

        // 2) 기존 canvas 파이프라인 정리
        if (canvasPipelineRafRef.current) {
            cancelAnimationFrame(canvasPipelineRafRef.current);
            canvasPipelineRafRef.current = null;
        }
        if (canvasPipelineVideoElRef.current) {
            try { canvasPipelineVideoElRef.current.pause(); } catch { }
            try { canvasPipelineVideoElRef.current.srcObject = null; } catch { }
            try { canvasPipelineVideoElRef.current.remove(); } catch { }
            canvasPipelineVideoElRef.current = null;
        }

        // 3) Hidden video element 생성 (raw 카메라 재생용)
        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        v.style.cssText = "position:fixed; bottom:0; right:0; width:640px; height:480px; opacity:0; pointer-events:none; z-index:-999;";
        document.body.appendChild(v);
        canvasPipelineVideoElRef.current = v;
        v.srcObject = new MediaStream([rawTrack]);
        try { await v.play(); } catch { }

        // 메타데이터 로드 대기
        await new Promise((resolve) => {
            if (v.videoWidth > 0 && v.videoHeight > 0) return resolve();
            const onLoaded = () => {
                v.removeEventListener("loadedmetadata", onLoaded);
                resolve();
            };
            v.addEventListener("loadedmetadata", onLoaded);
            setTimeout(resolve, 1500);
        });

        const videoW = v.videoWidth || 640;
        const videoH = v.videoHeight || 480;

        // 4) Canvas 생성 (항상 사용)
        const canvas = document.createElement("canvas");
        canvas.width = videoW;
        canvas.height = videoH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasPipelineCanvasRef.current = canvas;

        // 5) Canvas에서 track 캡처 (이것이 producer에 연결될 track)
        const outStream = canvas.captureStream(30);
        const outTrack = outStream.getVideoTracks()[0];
        canvasPipelineOutTrackRef.current = outTrack;

        // 6) 🔥 핵심: producer를 canvas track으로 처음부터 생성
        //    (이미 캔버스에 프레임이 그려진 상태에서 producer 생성 → keyframe 보장)
        let producer = producersRef.current.get("camera");
        if (producer) {
            // 기존 producer가 있으면 close
            try { producer.close(); } catch { }
            producersRef.current.delete("camera");
            producer = null;
        }

        // 7) 🔥 FaceDetector 초기화 (draw 루프 시작 BEFORE!)
        //    카메라 켜진 상태에서 이모지 클릭 시 즉시 얼굴 감지가 되도록
        if (!faceDetectorRef.current) {
            if (typeof window !== "undefined" && "FaceDetector" in window) {
                try {
                    const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                    faceDetectorRef.current = { kind: "native", detector: native };
                    console.log("[turnOnCamera] Native FaceDetector initialized");
                } catch { }
            }
            if (!faceDetectorRef.current) {
                try {
                    const { FaceDetector: MpFaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                    );
                    const mp = await MpFaceDetector.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                            delegate: "CPU",
                        },
                        runningMode: "VIDEO",
                        minDetectionConfidence: 0.5,
                    });
                    faceDetectorRef.current = { kind: "mediapipe", detector: mp };
                    console.log("[turnOnCamera] MediaPipe FaceDetector initialized");
                } catch (e) {
                    console.warn("[turnOnCamera] face detector init failed:", e);
                }
            }
        }

        // 8) Draw 루프 시작 (producer 생성 전에 캔버스에 프레임 그리기)
        canvasPipelineActiveRef.current = true;
        let frameCount = 0;
        let producerCreated = false;

        // 🔥 배경 제거용 캔버스 및 세그멘터 초기화
        let bgFrameCanvas = null;
        let bgFrameCtx = null;

        const ensureBgSegmenterForPipeline = () => {
            const cur = faceBgSegmenterRef.current;
            if (cur?.segmenter || cur?.loading) return;
            const loading = (async () => {
                try {
                    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                    );
                    const segmenter = await ImageSegmenter.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
                            delegate: "CPU",
                        },
                        runningMode: "VIDEO",
                        outputCategoryMask: true,
                    });
                    return segmenter;
                } catch (e) {
                    console.warn("[turnOnCamera bg-remove] segmenter init failed:", e);
                    return null;
                }
            })();
            faceBgSegmenterRef.current = { loading };
            loading.then((seg) => {
                if (!seg) {
                    faceBgSegmenterRef.current = null;
                    return;
                }
                faceBgSegmenterRef.current = { segmenter: seg };
                console.log("[turnOnCamera] bg segmenter loaded");
            });
        };

        const drawLoop = async () => {
            if (!canvasPipelineActiveRef.current) return;

            // 🔥 배경 제거 모드 체크
            const wantBgRemove = !!bgRemoveRef.current;
            if (wantBgRemove) ensureBgSegmenterForPipeline();

            // 비디오 프레임을 캔버스에 그리기
            try {
                if (!wantBgRemove) {
                    // 기본: 원본 비디오 그대로
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                } else {
                    // 🔥 배경 제거 모드
                    // 1) 프레임 캔버스 준비
                    if (!bgFrameCanvas) {
                        bgFrameCanvas = document.createElement("canvas");
                        bgFrameCanvas.width = canvas.width;
                        bgFrameCanvas.height = canvas.height;
                        bgFrameCtx = bgFrameCanvas.getContext("2d");
                    }

                    // 2) 프레임 캔버스에 비디오 그리기
                    if (bgFrameCtx) {
                        bgFrameCtx.globalCompositeOperation = "source-over";
                        bgFrameCtx.clearRect(0, 0, bgFrameCanvas.width, bgFrameCanvas.height);
                        bgFrameCtx.drawImage(v, 0, 0, bgFrameCanvas.width, bgFrameCanvas.height);
                    }

                    // 3) 세그멘테이션 마스크 업데이트 (90ms 쓰로틀)
                    const seg = faceBgSegmenterRef.current?.segmenter;
                    const nowMs = performance.now();
                    if (seg && nowMs - faceBgLastInferAtRef.current > 90) {
                        faceBgLastInferAtRef.current = nowMs;
                        try {
                            const res = seg.segmentForVideo(v, nowMs);
                            const mask = res?.categoryMask;
                            if (mask) {
                                const maskW = mask.width ?? 0;
                                const maskH = mask.height ?? 0;
                                const dataU8 = mask.getAsUint8Array?.();
                                if (dataU8 && maskW && maskH && dataU8.length >= maskW * maskH) {
                                    let maskCanvas = faceBgMaskCanvasRef.current;
                                    if (!maskCanvas) {
                                        maskCanvas = document.createElement("canvas");
                                        faceBgMaskCanvasRef.current = maskCanvas;
                                    }
                                    if (maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
                                        maskCanvas.width = maskW;
                                        maskCanvas.height = maskH;
                                    }
                                    const mctx = maskCanvas.getContext("2d");
                                    if (mctx) {
                                        const img = mctx.createImageData(maskW, maskH);
                                        // selfie_segmenter: 0=person(사람), 1+=background(배경)
                                        for (let i = 0; i < maskW * maskH; i++) {
                                            const isPerson = dataU8[i] === 0;
                                            const o = i * 4;
                                            img.data[o] = 255;
                                            img.data[o + 1] = 255;
                                            img.data[o + 2] = 255;
                                            img.data[o + 3] = isPerson ? 255 : 0;
                                        }
                                        mctx.putImageData(img, 0, 0);
                                    }
                                }
                            }
                        } catch { }
                    }

                    // 4) 마스크 적용 및 최종 출력
                    const maskCanvas = faceBgMaskCanvasRef.current;
                    if (maskCanvas && bgFrameCtx) {
                        bgFrameCtx.globalCompositeOperation = "destination-in";
                        bgFrameCtx.drawImage(maskCanvas, 0, 0, bgFrameCanvas.width, bgFrameCanvas.height);
                        bgFrameCtx.globalCompositeOperation = "source-over";

                        // 흰색 배경 + 사람만
                        ctx.save();
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(bgFrameCanvas, 0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        // 마스크 로딩 중: 원본 비디오 표시
                        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    }
                }
            } catch {
                canvasPipelineRafRef.current = requestAnimationFrame(drawLoop);
                return;
            }

            // 🔥 이모지 오버레이 (faceEmoji가 설정되어 있으면)
            const emoji = faceEmojiRef.current;
            const box = lastFaceBoxRef.current;
            if (emoji && faceModeRef.current === "emoji") {
                let cx, cy, size;
                
                if (box) {
                    // 얼굴이 감지된 경우: 얼굴 위치에 이모지 그리기
                    const scaleX = canvas.width / (v.videoWidth || canvas.width);
                    const scaleY = canvas.height / (v.videoHeight || canvas.height);
                    cx = (box.x + box.width / 2) * scaleX;
                    cy = (box.y + box.height / 2) * scaleY;
                    const scaledW = box.width * scaleX;
                    const scaledH = box.height * scaleY;
                    const base = Math.max(scaledW, scaledH);
                    const maxSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.98);
                    size = Math.max(120, Math.min(maxSize, Math.floor(base * 2.8)));
                    cy = cy - scaledH * 0.25; // 머리까지 덮도록 위로
                } else {
                    // 🔥 얼굴 미감지 시: 화면 중앙 상단에 기본 크기로 이모지 그리기
                    cx = canvas.width / 2;
                    cy = canvas.height * 0.35;
                    size = Math.floor(Math.min(canvas.width, canvas.height) * 0.5);
                }

                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
                ctx.fillText(emoji, cx, cy);
                ctx.restore();
            }

            // 얼굴 감지 (150ms throttle)
            if (faceDetectorRef.current && Date.now() - lastDetectAtRef.current > 150) {
                lastDetectAtRef.current = Date.now();
                const det = faceDetectorRef.current;
                if (det.kind === "native") {
                    det.detector.detect(v)
                        .then((faces) => {
                            const bb = faces?.[0]?.boundingBox;
                            lastFaceBoxRef.current = bb ? { x: bb.x, y: bb.y, width: bb.width, height: bb.height } : null;
                        })
                        .catch(() => { });
                } else if (det.kind === "mediapipe") {
                    try {
                        const res = det.detector.detectForVideo(v, performance.now());
                        const bb = res?.detections?.[0]?.boundingBox;
                        lastFaceBoxRef.current = bb ? { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height } : null;
                    } catch { }
                }
            }

            frameCount++;

            // 🔥 충분한 프레임이 그려진 후 producer 생성 (keyframe 보장)
            if (!producerCreated && frameCount >= 5) {
                producerCreated = true;
                try {
                    const transport = sendTransportRef.current;
                    if (transport && !transport.closed) {
                        const newProducer = await transport.produce({
                            track: outTrack,
                            appData: { type: "camera" },
                        });
                        producersRef.current.set("camera", newProducer);
                        console.log("[turnOnCamera] producer created with canvas track (keyframe guaranteed)");
                    }
                } catch (e) {
                    console.error("[turnOnCamera] producer creation failed:", e);
                }
            }

            canvasPipelineRafRef.current = requestAnimationFrame(drawLoop);
        };

        // Draw 루프 시작
        drawLoop();

        // 8) 로컬 스트림 설정 (로컬 미리보기용)
        const prevAudio = localStreamRef.current
            ?.getAudioTracks()
            .filter((t) => t.readyState !== "ended") ?? [];
        const merged = new MediaStream([...prevAudio, outTrack]);
        localStreamRef.current = merged;
        setLocalStream(merged);
        bumpStreamVersion();

        setCamOn(true);
        localStorage.setItem("camOn", "true");

        // 9) FaceDetector 초기화 (이모지용)
        if (!faceDetectorRef.current) {
            if (typeof window !== "undefined" && "FaceDetector" in window) {
                try {
                    const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                    faceDetectorRef.current = { kind: "native", detector: native };
                } catch { }
            }
            if (!faceDetectorRef.current) {
                try {
                    const { FaceDetector: MpFaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                    );
                    const mp = await MpFaceDetector.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                            delegate: "CPU",
                        },
                        runningMode: "VIDEO",
                        minDetectionConfidence: 0.5,
                    });
                    faceDetectorRef.current = { kind: "mediapipe", detector: mp };
                } catch (e) {
                    console.warn("[turnOnCamera] face detector init failed:", e);
                }
            }
        }

        // ⭐ 서버에 상태 전파
        wsRef.current?.send(JSON.stringify({
            type: "USER_STATE_CHANGE",
            userId,
            changes: { cameraOff: false },
        }));

        console.log("[turnOnCamera] canvas pipeline started, emoji mode:", faceModeRef.current, "emoji:", faceEmojiRef.current);
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
            // 0) 얼굴 필터 정리
            stopFaceEmojiFilter().catch(() => { });
            stopAvatarFilter().catch(() => { });

            // 1) 로컬 미디어 정리
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
            setLocalStream(null);

            // 2) WebSocket 정리
            try { wsRef.current?.close(); } catch { }
            wsRef.current = null;

            try { sfuWsRef.current?.close(); } catch { }
            sfuWsRef.current = null;

            // 3) mediasoup transport/device 정리
            try { sendTransportRef.current?.close(); } catch { }
            sendTransportRef.current = null;

            try { recvTransportRef.current?.close(); } catch { }
            recvTransportRef.current = null;
            setRecvTransportReady(false);

            try { sfuDeviceRef.current?.close?.(); } catch { }
            sfuDeviceRef.current = null;

            // 4) 오디오 엘리먼트 정리
            audioElsRef.current?.forEach((a) => {
                try { a.srcObject = null; } catch { }
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
            if (subjectId) {
                navigate(`/lms/${subjectId}/dashboard`, { replace: true });
            } else {
                navigate("/lmsMain", { replace: true });
            }
        }
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

    const isCanvasLikeTrack = (t) => {
        try {
            const label = (t?.label || "").toLowerCase();
            return label.includes("canvas");
        } catch {
            return false;
        }
    };

    const isLikelyCameraTrack = (t) => {
        if (!t) return false;
        if (t.kind !== "video") return false;
        if (t.readyState !== "live") return false;
        // 현재 필터 출력 트랙(outTrack)은 카메라 트랙으로 취급하지 않음
        try {
            const out1 = faceFilterOutTrackRef.current;
            const out2 = avatarOutTrackRef.current;
            if (out1 && t.id === out1.id) return false;
            if (out2 && t.id === out2.id) return false;
        } catch { }
        if (isCanvasLikeTrack(t)) return false;
        try {
            const s = t.getSettings?.();
            if (s && typeof s.deviceId === "string" && s.deviceId.length > 0) return true;
        } catch { }
        return true;
    };

    useEffect(() => {
        faceEmojiRef.current = faceEmoji;
        faceModeRef.current = faceMode;
        bgRemoveRef.current = bgRemove;
        try {
            if (faceEmoji) sessionStorage.setItem("faceEmoji", faceEmoji);
            else sessionStorage.removeItem("faceEmoji");

            if (faceMode) sessionStorage.setItem("faceMode", faceMode);
            else sessionStorage.removeItem("faceMode");

            sessionStorage.setItem("faceBgRemove", String(bgRemove));
        } catch { }
    }, [faceEmoji, faceMode, bgRemove]);

    // 🔥 F5 새로고침 후 저장된 이모지/배경제거 상태 자동 복원
    const hasMountedRef = useRef(false);
    useEffect(() => {
        if (hasMountedRef.current) return;
        hasMountedRef.current = true;

        // 저장된 이모지 또는 배경제거 상태가 있으면 자동 적용
        const savedEmoji = faceEmojiRef.current;
        const savedBgRemove = bgRemoveRef.current;

        if (savedEmoji || savedBgRemove) {
            // 로컬 스트림이 준비될 때까지 대기 후 canvasPipeline 시작
            const checkAndApply = async () => {
                // 로컬 스트림이 준비될 때까지 대기 (최대 15초)
                let waited = 0;
                while (!localStreamRef.current && waited < 15000) {
                    await new Promise(r => setTimeout(r, 300));
                    waited += 300;
                }

                // 추가 대기 (producer 생성 등)
                await new Promise(r => setTimeout(r, 1000));

                // canvasPipeline이 활성화되어 있지 않으면 turnOnCamera 호출
                if (!canvasPipelineActiveRef.current) {
                    console.log("[Auto-restore] Applying saved emoji/bgRemove state:", { savedEmoji, savedBgRemove });
                    try {
                        await turnOnCamera();
                    } catch (e) {
                        console.warn("[Auto-restore] turnOnCamera failed:", e);
                    }
                }
            };
            checkAndApply().catch((e) => console.warn("[Auto-restore] error:", e));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const enqueueFaceEmojiOp = useCallback((op) => {
        const next = faceEmojiOpRef.current.then(op, op);
        // queue가 에러로 끊기지 않게 swallow
        faceEmojiOpRef.current = next.catch(() => { });
        return next;
    }, []);

    const stopFaceEmojiFilterCore = useCallback(async () => {
        faceFilterActiveRef.current = false;

        if (faceFilterRafRef.current) {
            cancelAnimationFrame(faceFilterRafRef.current);
            faceFilterRafRef.current = null;
        }

        const producer = producersRef.current.get("camera");
        let rawTrack = faceFilterRawTrackRef.current;
        const outTrack = faceFilterOutTrackRef.current;

        // rawTrack이 없거나 stale이면 lastCameraTrackRef로 복구 시도
        const lastTrack = lastCameraTrackRef.current;
        if ((!rawTrack || rawTrack.readyState !== "live") && isLikelyCameraTrack(lastTrack) && lastTrack.readyState === "live") {
            rawTrack = lastTrack;
        }

        // producer track 원복
        // ⚠️ 카메라 OFF/ON 이후 stale(ended) rawTrack로 원복하면 검은화면/레이스가 날 수 있어
        // rawTrack이 live일 때만 원복한다.
        if (
            producer?.replaceTrack &&
            rawTrack &&
            rawTrack.readyState === "live" &&
            producer.track?.id !== rawTrack.id
        ) {
            try {
                await producer.replaceTrack({ track: rawTrack });
                try { producer.resume?.(); } catch { }
            } catch { }
        }

        // 로컬 스트림 원복(오디오 + rawTrack)
        if (rawTrack && rawTrack.readyState === "live") {
            const prevAudio = localStreamRef.current
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
            const merged = new MediaStream([...prevAudio, rawTrack]);
            localStreamRef.current = merged;
            setLocalStream(merged);
            bumpStreamVersion();
        }

        // 리소스 정리
        try { outTrack?.stop?.(); } catch { }
        faceFilterOutTrackRef.current = null;
        faceFilterOutStreamRef.current = null;
        faceFilterCanvasRef.current = null;
        faceBgFrameCanvasRef.current = null;
        faceBgMaskCanvasRef.current = null;
        faceBgLastInferAtRef.current = 0;
        // ImageSegmenter 정리
        try { faceBgSegmenterRef.current?.segmenter?.close?.(); } catch { }
        faceBgSegmenterRef.current = null;
        try { faceDetectorRef.current?.detector?.close?.(); } catch { }
        faceDetectorRef.current = null;
        lastFaceBoxRef.current = null;
        lastDetectAtRef.current = 0;

        if (faceFilterVideoElRef.current) {
            try { faceFilterVideoElRef.current.srcObject = null; } catch { }
            try { faceFilterVideoElRef.current.remove(); } catch { }
            faceFilterVideoElRef.current = null;
        }

        // stale rawTrack 참조 제거(카메라 재시작 시 잘못된 원복 방지)
        faceFilterRawTrackRef.current = null;
    }, []);

    const stopFaceEmojiFilter = useCallback(() => {
        return enqueueFaceEmojiOp(() => stopFaceEmojiFilterCore());
    }, [enqueueFaceEmojiOp, stopFaceEmojiFilterCore]);

    const stopAvatarFilter = useCallback(async () => {
        avatarFilterActiveRef.current = false;

        if (avatarFilterRafRef.current) {
            cancelAnimationFrame(avatarFilterRafRef.current);
            avatarFilterRafRef.current = null;
        }

        const producer = producersRef.current.get("camera");
        const rawTrack = avatarRawTrackRef.current;
        const outTrack = avatarOutTrackRef.current;

        // producer track 원복
        if (
            producer?.replaceTrack &&
            rawTrack &&
            rawTrack.readyState === "live" &&
            producer.track?.id !== rawTrack.id
        ) {
            try {
                await producer.replaceTrack({ track: rawTrack });
            } catch { }
        }

        // 로컬 스트림 원복(오디오 + rawTrack)
        if (rawTrack && rawTrack.readyState === "live") {
            const prevAudio = localStreamRef.current
                ?.getAudioTracks()
                .filter((t) => t.readyState === "live") ?? [];
            const merged = new MediaStream([...prevAudio, rawTrack]);
            localStreamRef.current = merged;
            setLocalStream(merged);
        }

        // 트랙/요소 정리
        try { outTrack?.stop?.(); } catch { }
        avatarOutTrackRef.current = null;
        avatarOutCanvasRef.current = null;
        avatarRawTrackRef.current = null;

        if (avatarVideoElRef.current) {
            try { avatarVideoElRef.current.srcObject = null; } catch { }
            try { avatarVideoElRef.current.remove(); } catch { }
            avatarVideoElRef.current = null;
        }

        // FaceLandmarker 정리
        try { faceLandmarkerRef.current?.close?.(); } catch { }
        faceLandmarkerRef.current = null;

        // Three/VRM 정리
        if (avatarThreeRef.current) {
            const { renderer, vrm } = avatarThreeRef.current;
            try {
                if (vrm?.scene) VRMUtils.deepDispose(vrm.scene);
            } catch { }
            try { renderer?.dispose?.(); } catch { }
            try { renderer?.domElement?.remove?.(); } catch { }
            avatarThreeRef.current = null;
        }

        lastAvatarFaceRef.current = { bbox: null, videoW: 0, videoH: 0 };
    }, []);

    const startAvatarFilter = useCallback(async () => {
        // 기존 2D 이모지 필터가 켜져있으면 종료
        await stopFaceEmojiFilter();

        // 기존 아바타 필터가 있으면 재시작
        await stopAvatarFilter();

        const cameraProducer = producersRef.current.get("camera");
        if (!cameraProducer?.replaceTrack) return;

        // 원본(로컬) 비디오 트랙 확보
        const rawTrack =
            localStreamRef.current?.getVideoTracks?.()?.find((t) => t.readyState === "live") ||
            cameraProducer.track;

        if (!rawTrack) return;
        avatarRawTrackRef.current = rawTrack;

        // hidden video element (raw track 재생)
        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        v.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:640px;height:480px;opacity:0;pointer-events:none;";
        document.body.appendChild(v);
        avatarVideoElRef.current = v;
        v.srcObject = new MediaStream([rawTrack]);
        try { await v.play(); } catch { }

        // 메타데이터(실제 해상도) 로드 대기
        await new Promise((resolve) => {
            if (v.videoWidth > 0 && v.videoHeight > 0) return resolve();
            const onLoaded = () => {
                v.removeEventListener("loadedmetadata", onLoaded);
                resolve();
            };
            v.addEventListener("loadedmetadata", onLoaded);
            setTimeout(resolve, 1500);
        });

        const videoW = v.videoWidth || 640;
        const videoH = v.videoHeight || 480;

        // 최종 합성 canvas (배경: 원본 비디오 + 오버레이: 아바타)
        const outCanvas = document.createElement("canvas");
        outCanvas.width = videoW;
        outCanvas.height = videoH;
        const outCtx = outCanvas.getContext("2d");
        avatarOutCanvasRef.current = outCanvas;

        const outStream = outCanvas.captureStream(15);
        const outTrack = outStream.getVideoTracks()[0];
        try { outTrack.requestFrame?.(); } catch { }
        avatarOutTrackRef.current = outTrack;

        await new Promise((resolve) => {
            if (typeof outTrack.requestFrame === "function") {
                outTrack.requestFrame();
            }

            if (typeof v.requestVideoFrameCallback === "function") {
                v.requestVideoFrameCallback(() => resolve());
            } else {
                setTimeout(resolve, 120);
            }
        });

        // 송출 트랙 교체 (상대도 아바타 오버레이가 보임)
        try {
            await cameraProducer.replaceTrack({ track: outTrack });
        } catch {
            try { outTrack?.stop?.(); } catch { }
            return;
        }

        // 내 화면도 동일하게 보이도록 로컬 스트림을 (오디오 + outTrack)으로 변경
        const prevAudio = localStreamRef.current
            ?.getAudioTracks()
            .filter((t) => t.readyState === "live") ?? [];
        const merged = new MediaStream([...prevAudio, outTrack]);
        localStreamRef.current = merged;
        setLocalStream(merged);

        // FaceLandmarker 준비 (로컬 모델 사용)
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/mediapipe/face_landmarker.task",
                delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            // ✅ 표정/회전 트래킹(블렌드쉐이프/매트릭스)은 사용하지 않음
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
        });
        faceLandmarkerRef.current = landmarker;

        // Three/VRM 준비
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
        });
        renderer.setSize(512, 512, false);
        renderer.setClearColor(0x000000, 0);
        try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch { }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
        camera.position.set(0, 1.45, 1.2);
        camera.lookAt(0, 1.45, 0);

        scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(1, 1.5, 1);
        scene.add(dir);

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync("/avatars/default.vrm");
        const vrm = gltf.userData?.vrm;
        if (!vrm) return;

        // VRM 장면 최적화/정리
        try { VRMUtils.rotateVRM0(vrm); } catch { }
        // 카메라를 바라보도록 회전(모델마다 다를 수 있음)
        try { vrm.scene.rotation.y = Math.PI; } catch { }

        scene.add(vrm.scene);
        const clock = new THREE.Clock();

        avatarThreeRef.current = { renderer, scene, camera, vrm, clock };

        avatarFilterActiveRef.current = true;

        let lastInferAt = 0;

        const tick = () => {
            if (!avatarFilterActiveRef.current) return;

            // 1) 원본 비디오 프레임
            try {
                outCtx.drawImage(v, 0, 0, outCanvas.width, outCanvas.height);
            } catch {
                avatarFilterRafRef.current = requestAnimationFrame(tick);
                return;
            }

            // 2) 추론(스로틀)
            const now = performance.now();
            if (now - lastInferAt > 120) {
                lastInferAt = now;
                try {
                    const res = landmarker.detectForVideo(v, now);
                    const lm = res?.faceLandmarks?.[0];

                    // bbox 계산 (landmarks normalized → px)
                    if (lm?.length) {
                        let minX = 1, minY = 1, maxX = 0, maxY = 0;
                        for (const p of lm) {
                            if (p.x < minX) minX = p.x;
                            if (p.y < minY) minY = p.y;
                            if (p.x > maxX) maxX = p.x;
                            if (p.y > maxY) maxY = p.y;
                        }
                        const x = minX * videoW;
                        const y = minY * videoH;
                        const w = (maxX - minX) * videoW;
                        const h = (maxY - minY) * videoH;
                        lastAvatarFaceRef.current.bbox = { x, y, width: w, height: h };
                    } else {
                        lastAvatarFaceRef.current.bbox = null;
                    }

                    lastAvatarFaceRef.current.videoW = videoW;
                    lastAvatarFaceRef.current.videoH = videoH;
                } catch { }
            }

            // 3) VRM 업데이트(표정/회전 트래킹 제거: 기본 애니메이션만)
            const t = avatarThreeRef.current;
            const dt = t?.clock?.getDelta?.() ?? 0.016;
            if (t?.vrm) {
                try { t.vrm.update(dt); } catch { }
                try { t.renderer.render(t.scene, t.camera); } catch { }
            }

            // 4) 오버레이 합성 (얼굴 bbox가 있을 때만)
            const bbox = lastAvatarFaceRef.current.bbox;
            if (bbox && t?.renderer?.domElement) {
                const cx = bbox.x + bbox.width / 2;
                const cy = bbox.y + bbox.height / 2;

                // 얼굴 bbox보다 조금 크게(머리+상반신 느낌)
                const dw = Math.max(120, bbox.width * 2.0);
                const dh = Math.max(120, bbox.height * 2.2);
                const dx = cx - dw / 2;
                const dy = cy - dh * 0.60; // 위로 올려서 얼굴 중심 맞춤

                outCtx.save();
                // 얼굴 주변만 자연스럽게 보이도록 타원 클리핑
                outCtx.beginPath();
                outCtx.ellipse(cx, cy, dw * 0.42, dh * 0.42, 0, 0, Math.PI * 2);
                outCtx.clip();
                outCtx.drawImage(t.renderer.domElement, dx, dy, dw, dh);
                outCtx.restore();
            }

            avatarFilterRafRef.current = requestAnimationFrame(tick);
        };

        tick();
    }, [stopFaceEmojiFilter, stopAvatarFilter]);

    const startFaceEmojiFilterCore = useCallback(async (emoji) => {
        // emoji가 없어도 "배경 지우기" 모드거나, 이미 필터 파이프라인이 켜져있으면(패스스루) 유지한다.
        const allowPassthrough = !!faceFilterActiveRef.current && !!faceFilterOutTrackRef.current;
        if (!emoji && !bgRemoveRef.current && !allowPassthrough) return;

        // 🔥 즉시 반영(렌더 루프는 faceEmojiRef.current를 매 프레임 읽음)
        faceEmojiRef.current = emoji || "";

        // 아바타 필터가 켜져있으면 종료
        await stopAvatarFilter();

        // 🔥 canvasPipeline이 활성화되어 있으면 먼저 정리 (충돌 방지)
        if (canvasPipelineActiveRef.current) {
            console.log("[startFaceEmojiFilter] cleaning up canvasPipeline first");
            canvasPipelineActiveRef.current = false;
            if (canvasPipelineRafRef.current) {
                cancelAnimationFrame(canvasPipelineRafRef.current);
                canvasPipelineRafRef.current = null;
            }
            if (canvasPipelineVideoElRef.current) {
                try { canvasPipelineVideoElRef.current.pause(); } catch { }
                // 🔥 srcObject는 null로 설정하지 않음 (rawTrack 유지, faceFilter에서 재사용)
                try { canvasPipelineVideoElRef.current.remove(); } catch { }
                canvasPipelineVideoElRef.current = null;
            }
            // outTrack과 rawTrack은 정리하지 않음 (재사용 가능)
            canvasPipelineCanvasRef.current = null;
        }

        // ✅ 이미 필터가 실행 중이면 "이모지 변경"만 하고 그대로 유지
        // (트랙 재교체/재시작을 하면 레이스로 검은 화면이 뜰 수 있음)
        const cameraProducer = producersRef.current.get("camera");
        const existingOutTrack = faceFilterOutTrackRef.current;
        const rawTrackAlive = faceFilterRawTrackRef.current?.readyState === "live";
        const outTrackAlive = existingOutTrack?.readyState === "live";
        const producerUsingOutTrack = !!(cameraProducer?.track && existingOutTrack && cameraProducer.track.id === existingOutTrack.id);

        if (
            faceFilterActiveRef.current &&
            rawTrackAlive &&
            outTrackAlive &&
            producerUsingOutTrack &&
            faceFilterVideoElRef.current &&
            faceFilterCanvasRef.current
        ) {
            return;
        }

        // 기존 필터가 있으면 정리 후 재시작
        // (start/stop을 같은 큐에서 직렬화하므로 내부 core를 직접 호출해 데드락을 피한다)
        await stopFaceEmojiFilterCore();

        const freshProducer = producersRef.current.get("camera");
        if (!freshProducer?.replaceTrack) return;

        console.log("[startFaceEmojiFilter] preparing tracks...");

        // 1) 원본(카메라) 비디오 트랙 확보
        let rawTrack = null;
        const lastTrack = lastCameraTrackRef.current;
        const canvasPipelineRaw = canvasPipelineRawTrackRef.current;
        const localTracks = localStreamRef.current?.getVideoTracks?.() ?? [];
        const freshTrack = freshProducer.track;

        // 우선순위 1: lastCameraTrackRef (가장 신뢰)
        if (isLikelyCameraTrack(lastTrack) && lastTrack.readyState === "live") {
            console.log("[startFaceEmojiFilter] using lastCameraTrackRef:", lastTrack.id);
            rawTrack = lastTrack;
        }
        // 🔥 우선순위 1.5: canvasPipelineRawTrackRef (canvasPipeline에서 전환 시)
        else if (isLikelyCameraTrack(canvasPipelineRaw) && canvasPipelineRaw.readyState === "live") {
            console.log("[startFaceEmojiFilter] using canvasPipelineRawTrackRef:", canvasPipelineRaw.id);
            rawTrack = canvasPipelineRaw;
            lastCameraTrackRef.current = canvasPipelineRaw; // 이후 재사용 위해 저장
        }
        // 우선순위 2: localStreamRef에서 찾기
        else {
            const found = localTracks.find((t) => isLikelyCameraTrack(t) && t.readyState === "live");
            if (found) {
                console.log("[startFaceEmojiFilter] found track in localStream:", found.id);
                rawTrack = found;
            }
            // 우선순위 3: freshProducer에서 찾기
            else if (isLikelyCameraTrack(freshTrack) && freshTrack.readyState === "live") {
                console.log("[startFaceEmojiFilter] using freshProducer.track:", freshTrack.id);
                rawTrack = freshTrack;
            }
        }

        // 정말 없으면(카메라 ON인데 트랙이 없는 경우)만 새로 요청
        if (!rawTrack && camOnRef.current) {
            console.log("[startFaceEmojiFilter] no reusable camera track, getting new camera track");
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true });
                rawTrack = s.getVideoTracks()[0];
                if (isLikelyCameraTrack(rawTrack)) lastCameraTrackRef.current = rawTrack;
            } catch (e) {
                console.error("[startFaceEmojiFilter] failed to get camera track:", e);
                return;
            }
        }

        if (!rawTrack) {
            console.warn("[startFaceEmojiFilter] aborted: no raw track found");
            return;
        }

        try { rawTrack.enabled = true; } catch { }
        faceFilterRawTrackRef.current = rawTrack;
        if (isLikelyCameraTrack(rawTrack)) lastCameraTrackRef.current = rawTrack;

        // 2) Hidden video element 생성 및 재생
        // 🔥 기존 엘리먼트 있으면 확실히 제거
        if (faceFilterVideoElRef.current) {
            try { faceFilterVideoElRef.current.pause(); } catch { }
            try { faceFilterVideoElRef.current.srcObject = null; } catch { }
            try { faceFilterVideoElRef.current.remove(); } catch { }
            faceFilterVideoElRef.current = null;
        }

        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        // ⚠️ visibility:hidden은 일부 환경에서 렌더링 중단을 유발할 수 있어 opacity:0 사용
        // ✅ 비디오 크기를 너무 작게(1px 등) 하면 브라우저가 디코딩을 최적화(중단)해버려서 첫 프레임이 안 나올 수 있음.
        //    그래서 정상 해상도를 유지하되 투명하게 숨긴다.
        v.style.cssText = "position:fixed; bottom:0; right:0; width:640px; height:480px; opacity:0; pointer-events:none; z-index:-999;";
        document.body.appendChild(v);
        faceFilterVideoElRef.current = v;

        v.srcObject = new MediaStream([rawTrack]);

        // 🔥 Play를 명시적으로 수행하고 대기
        try {
            await v.play();
        } catch (e) {
            console.warn("[startFaceEmojiFilter] v.play() failed, retrying on interaction or continuing:", e);
        }

        // 메타데이터(실제 해상도) 로드 대기 - 타임아웃을 늘려 안정화
        await new Promise((resolve) => {
            const checkReady = () => {
                if (v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2) {
                    resolve();
                    return true;
                }
                return false;
            };

            if (checkReady()) return;

            const onLoaded = () => {
                v.removeEventListener("loadedmetadata", onLoaded);
                v.removeEventListener("canplay", onLoaded);
                // 메타데이터 로드 후에도 한번 더 체크
                if (!checkReady()) {
                    setTimeout(resolve, 100); // 짧은 대기 후 진행
                }
            };
            v.addEventListener("loadedmetadata", onLoaded);
            v.addEventListener("canplay", onLoaded);
            setTimeout(resolve, 2000); // 타임아웃 2초로 증가
        });

        // 캔버스 준비
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            console.warn("[startFaceEmojiFilter] canvas 2d context unavailable");
            try { v.pause(); } catch { }
            try { v.srcObject = null; } catch { }
            try { v.remove(); } catch { }
            faceFilterVideoElRef.current = null;
            return;
        }
        const w = v.videoWidth || 640;
        const h = v.videoHeight || 480;
        canvas.width = w;
        canvas.height = h;
        faceFilterCanvasRef.current = canvas;

        // 배경 제거용 프레임 캔버스(마스킹 적용 대상)
        const frameCanvas = document.createElement("canvas");
        frameCanvas.width = w;
        frameCanvas.height = h;
        const frameCtx = frameCanvas.getContext("2d");
        faceBgFrameCanvasRef.current = frameCanvas;

        // 🔥 [핵심] 렌더 루프를 모델 로딩 전에 미리 활성화
        //    모델이 로드되는 동안에도 원본 비디오를 캔버스에 계속 그려줘서
        //    replaceTrack 시점에 검은 화면이 나오지 않게 한다.
        faceFilterActiveRef.current = true;

        // FaceDetector(브라우저 지원 시) 또는 MediaPipe(tasks-vision) 준비
        let detectorState = null;
        if (typeof window !== "undefined" && "FaceDetector" in window) {
            try {
                const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                detectorState = { kind: "native", detector: native };
            } catch { }
        }

        // 🔥 Chrome 데스크탑 등에서 FaceDetector 미지원인 경우 MediaPipe로 폴백
        if (!detectorState) {
            try {
                const { FaceDetector: MpFaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                );

                const mp = await MpFaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        // 모델은 CDN에서 로드 (네트워크 필요)
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                        delegate: "CPU",
                    },
                    runningMode: "VIDEO",
                    minDetectionConfidence: 0.5,
                });

                detectorState = { kind: "mediapipe", detector: mp };
            } catch (e) {
                console.warn("[face-emoji] detector init failed:", e);
            }
        }

        faceDetectorRef.current = detectorState;

        const outStream = canvas.captureStream(15);
        const outTrack = outStream.getVideoTracks()[0];
        faceFilterOutStreamRef.current = outStream;
        faceFilterOutTrackRef.current = outTrack;

        // 배경 제거(ImageSegmenter) lazy init
        const ensureBgSegmenter = () => {
            const cur = faceBgSegmenterRef.current;
            if (cur?.segmenter || cur?.loading) return;
            const loading = (async () => {
                try {
                    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                    );
                    // Selfie(사람) 세그멘테이션 모델
                    const segmenter = await ImageSegmenter.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
                            delegate: "CPU",
                        },
                        runningMode: "VIDEO",
                        outputCategoryMask: true,
                    });
                    return segmenter;
                } catch (e) {
                    console.warn("[bg-remove] segmenter init failed:", e);
                    return null;
                }
            })();
            faceBgSegmenterRef.current = { loading };
            loading.then((seg) => {
                if (!seg) {
                    faceBgSegmenterRef.current = null;
                    return;
                }
                faceBgSegmenterRef.current = { segmenter: seg };
            });
        };

        // 🔥 첫 프레임이 그려진 후 트랙 교체용 플래그
        let hasReplacedTrack = false;
        let frameCount = 0;

        // 렌더 루프
        const draw = async () => {
            if (!faceFilterActiveRef.current) return;

            // 비디오 프레임 (+ 배경 제거 옵션)
            const wantBgRemove = !!bgRemoveRef.current;
            if (wantBgRemove) ensureBgSegmenter();

            try {
                if (!wantBgRemove || !frameCtx) {
                    // 기본: 원본 그대로
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                } else {
                    // 1) frameCanvas에 비디오 프레임
                    frameCtx.globalCompositeOperation = "source-over";
                    frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
                    frameCtx.drawImage(v, 0, 0, frameCanvas.width, frameCanvas.height);

                    // 2) 세그멘테이션 마스크 업데이트(쓰로틀)
                    const seg = faceBgSegmenterRef.current?.segmenter;
                    const nowMs = performance.now();
                    if (seg && nowMs - faceBgLastInferAtRef.current > 90) {
                        faceBgLastInferAtRef.current = nowMs;
                        try {
                            const res = seg.segmentForVideo(v, nowMs);
                            const mask = res?.categoryMask;
                            if (mask) {
                                const maskW = mask.width ?? mask?.getAsUint8Array?.()?.length; // fallback
                                const maskH = mask.height ?? 0;
                                const dataU8 = mask.getAsUint8Array?.();
                                if (dataU8 && maskW && maskH && dataU8.length >= maskW * maskH) {
                                    let maskCanvas = faceBgMaskCanvasRef.current;
                                    if (!maskCanvas) {
                                        maskCanvas = document.createElement("canvas");
                                        faceBgMaskCanvasRef.current = maskCanvas;
                                    }
                                    if (maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
                                        maskCanvas.width = maskW;
                                        maskCanvas.height = maskH;
                                    }
                                    const mctx = maskCanvas.getContext("2d");
                                    if (mctx) {
                                        const img = mctx.createImageData(maskW, maskH);
                                        // selfie_segmenter: 0=person(사람), 1+=background(배경)
                                        for (let i = 0; i < maskW * maskH; i++) {
                                            const isPerson = dataU8[i] === 0;
                                            const o = i * 4;
                                            img.data[o] = 255;
                                            img.data[o + 1] = 255;
                                            img.data[o + 2] = 255;
                                            img.data[o + 3] = isPerson ? 255 : 0;
                                        }
                                        mctx.putImageData(img, 0, 0);
                                    }
                                }
                            }
                        } catch { }
                    }

                    // 3) frameCanvas에 마스크 적용(destination-in)
                    const maskCanvas = faceBgMaskCanvasRef.current;
                    if (maskCanvas) {
                        frameCtx.globalCompositeOperation = "destination-in";
                        frameCtx.drawImage(maskCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
                        frameCtx.globalCompositeOperation = "source-over";

                        // 4) 최종 출력: 배경 흰색 + 사람만
                        ctx.save();
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);
                        ctx.restore();
                    } else {
                        // 🔥 마스크가 아직 로드되지 않았으면 원본 비디오 그대로 표시
                        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    }
                }
            } catch {
                faceFilterRafRef.current = requestAnimationFrame(draw);
                return;
            }

            // 얼굴 감지(지원 시) - 150ms throttle
            const now = Date.now();
            const det = faceDetectorRef.current;
            if (det && now - lastDetectAtRef.current > 150) {
                lastDetectAtRef.current = now;
                if (det.kind === "native") {
                    det.detector.detect(v)
                        .then((faces) => {
                            const f = faces?.[0];
                            const bb = f?.boundingBox;
                            if (bb) {
                                // DOMRectReadOnly → plain object로 저장
                                lastFaceBoxRef.current = { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
                            } else {
                                lastFaceBoxRef.current = null;
                            }
                        })
                        .catch(() => { });
                } else if (det.kind === "mediapipe") {
                    try {
                        const res = det.detector.detectForVideo(v, performance.now());
                        const first = res?.detections?.[0];
                        const bb = first?.boundingBox;
                        if (bb) {
                            lastFaceBoxRef.current = {
                                x: bb.originX,
                                y: bb.originY,
                                width: bb.width,
                                height: bb.height,
                            };
                        } else {
                            lastFaceBoxRef.current = null;
                        }
                    } catch { }
                }
            }

            // 이모지 오버레이
            const currentEmoji = faceEmojiRef.current;
            const box = lastFaceBoxRef.current;
            if (currentEmoji) {
                let cx, cy, size;
                
                if (box) {
                    // 얼굴이 감지된 경우: 얼굴 위치에 이모지 그리기
                    const scaleX = canvas.width / (v.videoWidth || canvas.width);
                    const scaleY = canvas.height / (v.videoHeight || canvas.height);
                    cx = (box.x + box.width / 2) * scaleX;
                    cy = (box.y + box.height / 2) * scaleY;
                    const scaledW = box.width * scaleX;
                    const scaledH = box.height * scaleY;
                    const base = Math.max(scaledW, scaledH);
                    const maxSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.98);
                    size = Math.max(120, Math.min(maxSize, Math.floor(base * 2.8)));
                    cy = cy - scaledH * 0.25; // 머리까지 덮도록 위로
                } else {
                    // 🔥 얼굴 미감지 시: 화면 중앙 상단에 기본 크기로 이모지 그리기
                    cx = canvas.width / 2;
                    cy = canvas.height * 0.35;
                    size = Math.floor(Math.min(canvas.width, canvas.height) * 0.5);
                }

                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
                ctx.fillText(currentEmoji, cx, cy);
                ctx.restore();
            }

            // 🔥 첫 프레임이 그려진 후 새 producer 생성 (keyframe 보장, 검은 화면 방지)
            frameCount++;
            if (!hasReplacedTrack && frameCount >= 3) {
                hasReplacedTrack = true;
                try {
                    // outTrack 활성화
                    try { outTrack.enabled = true; } catch { }

                    // 🔥 핵심: replaceTrack 대신 producer를 close하고 새로 produce
                    // 새 producer 생성 시 자연스럽게 keyframe이 전송됨
                    const oldProducer = producersRef.current.get("camera");
                    if (oldProducer) {
                        try { oldProducer.close(); } catch { }
                        producersRef.current.delete("camera");
                    }

                    // 새 producer 생성 (keyframe 자동 전송)
                    const transport = sendTransportRef.current;
                    if (transport && !transport.closed) {
                        const newProducer = await transport.produce({
                            track: outTrack,
                            appData: { type: "camera" },
                        });
                        producersRef.current.set("camera", newProducer);
                        console.log("[FaceEmoji] new producer created with canvas track (keyframe guaranteed)");
                    }

                    // 로컬 스트림도 outTrack으로 전환
                    const prevAudio = localStreamRef.current
                        ?.getAudioTracks()
                        .filter((t) => t.readyState === "live") ?? [];
                    const merged = new MediaStream([...prevAudio, outTrack]);
                    localStreamRef.current = merged;
                    setLocalStream(merged);
                    bumpStreamVersion();
                } catch (e) {
                    console.error("[FaceEmoji] new producer creation failed:", e);
                }
            }

            faceFilterRafRef.current = requestAnimationFrame(draw);
        };

        draw();
    }, [stopAvatarFilter, stopFaceEmojiFilterCore]);

    const startFaceEmojiFilter = useCallback((emoji) => {
        // UI 연타(해제→재적용 등)에도 start/stop이 섞이지 않게 직렬화
        return enqueueFaceEmojiOp(() => startFaceEmojiFilterCore(emoji));
    }, [enqueueFaceEmojiOp, startFaceEmojiFilterCore]);

    useEffect(() => {
        console.log("[PERMISSION]", {
            micPermission,
            camPermission,
            micDisabled,
            camDisabled,
        });
    }, [micPermission, camPermission]);

    const handleBrowserPip = useCallback(() => {
        const video = mainVideoRef.current;
        if (!video) return;

        if (!document.pictureInPictureElement) {
            video.requestPictureInPicture().catch(() => { });
        }

    }, []);

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
                if (isLikelyCameraTrack(vt)) lastCameraTrackRef.current = vt;

                // 상태 동기화
                setLocalStream(stream);

                // 권한은 스트림이 있다는 전제로 granted로 취급
                setMicPermission("granted");
                setCamPermission("granted");

                // MeetingContext 호출은 실패해도 미디어 동작에 영향 없게 격리
                try {
                    if (typeof saveMeetingState === "function") {
                        saveMeetingState({ localStream: stream });
                    }
                } catch (e) {
                    console.warn("[startLocalMedia] meeting context error:", e);
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
            if (isLikelyCameraTrack(vt)) lastCameraTrackRef.current = vt;

            localStreamRef.current = stream;
            setLocalStream(stream);

            setMicPermission("granted");
            // 카메라를 아예 요청하지 않은 경우에도 "권한"은 granted일 수 있지만,
            // UI 버튼 비활성화 판단은 permission 기반이므로, 여기서는 "granted"로 두는 편이 안전합니다.
            setCamPermission("granted");

            // MeetingContext 호출은 실패해도 미디어 동작에 영향 없게 격리
            try {
                if (typeof saveMeetingState === "function") {
                    saveMeetingState({ localStream: stream });
                }
            } catch (e) {
                console.warn("[startLocalMedia] meeting context error:", e);
            }

            return stream;
        } catch (err) {
            console.error("[startLocalMedia] Failed to get media:", err);

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
        const t = sendTransportRef.current;
        if (!t || t.closed) return;

        const stream = localStreamRef.current;
        if (!stream) return;

        // --- AUDIO ---
        const audioTrack = stream.getAudioTracks().find((x) => x.readyState === "live");
        if (audioTrack) {
            const hasAudioProducer = producersRef.current.has("audio");
            if (!hasAudioProducer) {
                try {
                    const p = await t.produce({
                        track: audioTrack,
                        appData: { type: "audio" },
                    });
                    producersRef.current.set("audio", p);
                    // console.log(`[ensureLocalProducers] Audio producer created`);
                } catch (e) {
                    // console.error("[ensureLocalProducers] audio produce failed:", e);
                }
            }
            // 마이크 enabled 상태를 현재 설정 기준으로 동기화
            audioTrack.enabled = !!micOnRef.current;
            // console.log(`[ensureLocalProducers] Audio track enabled set to ${micOnRef.current}`);
        }

        // --- CAMERA ---
        // camOn이 false면 카메라 producer는 만들지 않음 (상대가 아바타로 보는 게 맞음)
        if (!camOnRef.current) {
            // console.log(`[ensureLocalProducers] Camera is OFF, skipping camera producer`);
            return;
        }

        const videoTrack = stream.getVideoTracks().find((x) => x.readyState === "live");
        if (!videoTrack) {
            // console.log(`[ensureLocalProducers] No live video track found`);
            return;
        }

        const hasCameraProducer = producersRef.current.has("camera");
        if (!hasCameraProducer) {
            try {
                const p = await t.produce({
                    track: videoTrack,
                    appData: { type: "camera" },
                });
                producersRef.current.set("camera", p);
                // console.log(`[ensureLocalProducers] Camera producer created`);
            } catch (e) {
                // console.error("[ensureLocalProducers] camera produce failed:", e);
            }
        }

        // camOn 상태 반영
        videoTrack.enabled = !!camOnRef.current;
        // console.log(`[ensureLocalProducers] Video track enabled set to ${camOnRef.current}`);
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
            // console.log(`[startScreenShare] Saving camera state: ${cameraWasOnBeforeScreenShareRef.current}`);

            // 1) 카메라 producer 닫기 (원격에 camera producerClosed 나가게)
            const cameraProducer = producersRef.current.get("camera");
            if (cameraProducer) {
                const id = cameraProducer.id;
                try { cameraProducer.close(); } catch { }
                producersRef.current.delete("camera");
                safeSfuSend({ action: "closeProducer", data: { producerId: id } });
            }

            // 2) 로컬 카메라 "비디오 트랙만" 정지 (오디오는 유지)
            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => {
                    try { t.stop(); } catch { }
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
                // console.log("[screen] track ended by browser");
                stopScreenShare(true); // fromTrackEnded=true
            };
        } catch (e) {
            // console.error("[startScreenShare] failed:", e);
        }
    };

    const stopScreenShare = async (fromTrackEnded = false) => {
        if (isStoppingScreenShareRef.current) {
            // console.warn("[stopScreenShare] ignored duplicate call");
            return;
        }
        isStoppingScreenShareRef.current = true;

        try {
            // console.log("[stopScreenShare] fromTrackEnded =", fromTrackEnded);

            // 1) screen producer 닫기
            const screenProducer = producersRef.current.get("screen");
            if (screenProducer) {
                try { screenProducer.close(); } catch { }
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
                        try { t.stop(); } catch { }
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
            // console.log(`[restore] shouldRestoreCamera = ${shouldRestoreCamera}, camOnRef.current = ${camOnRef.current}, cameraWasOnBeforeScreenShare = ${cameraWasOnBeforeScreenShareRef.current}`);

            if (!shouldRestoreCamera) {
                // console.log(`[restore] Camera is currently OFF, not restoring`);
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

            // console.log(`[restore] Restoring camera because it was ON before screen share`);

            // 4) camera producer 생성 (enabled=true 명시)
            await produceCamera(newVideoTrack, true);

            // 5) 로컬 스트림 갱신 (오디오 + 새 비디오 병합)
            const merged = new MediaStream([...prevAudioTracks, newVideoTrack]);
            localStreamRef.current = merged;
            setLocalStream(merged);

            // console.log(`[restore] camera restored, cameraOff = false`);

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

        const old = producersRef.current.get("camera");
        if (old) {
            // console.log(`[produceCamera] closing old producer: ${old.id}`);
            try { old.close(); } catch { }
            producersRef.current.delete("camera");
            safeSfuSend({ action: "closeProducer", data: { producerId: old.id } });
        }

        // 트랙 enabled 상태 설정 (forceEnabled가 있으면 우선, 없으면 camOnRef 사용)
        const enabledState = forceEnabled !== null ? forceEnabled : camOnRef.current;
        track.enabled = enabledState;
        // console.log(`[produceCamera] producing with track.enabled=${track.enabled}, forceEnabled=${forceEnabled}, camOnRef.current=${camOnRef.current}`);

        const producer = await t.produce({
            track,
            appData: { type: "camera" },
        });

        // console.log(`[produceCamera] new producer created: ${producer.id}`);
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

                const peerId = serverPeerId ?? fallbackPeerId;

                const finalAppData = serverAppData ?? targetAppData ?? {};

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
                    audio.play().catch(() => { });
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
                        try { c.close(); } catch { }
                    }
                    consumersRef.current.delete(producerId);

                    // ✅ 2) 오디오 엘리먼트 정리
                    const a = audioElsRef.current.get(producerId);
                    if (a) {
                        try { a.srcObject = null; } catch { }
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
                } catch { }
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

        // console.log(`[toggleMic] producer exists:`, !!audioProducer, `track:`, audioProducer?.track?.readyState);
        // console.log(`[toggleMic] local audio track exists:`, !!at, `readyState:`, at?.readyState);

        // 혹시 producer가 없다면 에러 (audio는 항상 있어야 함)
        if (!audioProducer) {
            console.error(`[toggleMic] No audio producer! This should not happen.`);
        } else {
            if (audioProducer.track) {
                audioProducer.track.enabled = newVal;
                // console.log(`[toggleMic] producer track enabled set to:`, newVal);
            }
        }

        // 로컬 스트림 트랙도 동기화
        if (at) {
            at.enabled = newVal;
            // console.log(`[toggleMic] local stream track enabled set to:`, newVal);
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
            // console.log(`[toggleMic] sent USER_STATE_CHANGE to server: muted=${!newVal}`);
        }
    };

    const handlePeerCameraOff = (peerId) => {
        // 1. consumer 제거
        const key = `${peerId}:camera`;
        const consumer = consumersRef.current.get(key);
        if (consumer) {
            consumer.close();
            consumersRef.current.delete(key);
        }

        // 2. MediaStream 즉시 제거 (중요)
        const prevStream = peerStreamsRef.current.get(peerId);
        if (prevStream) {
            prevStream.getTracks().forEach((t) => t.stop());
            peerStreamsRef.current.delete(peerId);
        }

        // 3. React 상태 즉시 반영
        setParticipants((prev) =>
            prev.map((p) =>
                p.id === peerId
                    ? {
                        ...p,
                        cameraOff: true,
                        stream: null,
                    }
                    : p
            )
        );
    };

    const removeVideoConsumer = (peerId) => {
        for (const [producerId, c] of consumersRef.current.entries()) {
            if (
                c.appData?.type === "camera" &&
                String(c.appData?.peerId) === String(peerId)
            ) {
                try { c.close(); } catch { }
                consumersRef.current.delete(producerId);
            }
        }

        peerStreamsRef.current.delete(peerId);

        setParticipants(prev =>
            prev.map(p =>
                String(p.id) === String(peerId)
                    ? { ...p, stream: null, cameraOff: true }
                    : p
            )
        );
    };

    const removeAudioConsumer = (peerId) => {
        for (const [producerId, c] of consumersRef.current.entries()) {
            if (
                c.appData?.type === "audio" &&
                String(c.appData?.peerId) === String(peerId)
            ) {
                try { c.close(); } catch { }
                consumersRef.current.delete(producerId);
            }
        }
    };

    const canReopenPip = () => {
        const video = mainVideoRef.current;
        if (!video) return false;

        const stream = video.srcObject;
        const track = stream?.getVideoTracks?.()[0];

        return !!track && track.readyState === "live";
    };

    // --- Hooks ---

    useEffect(() => {
        const init = async () => {
            await startLocalMedia();

            // 🔥 저장된 이모지/배경제거 상태가 있으면 canvasPipeline으로 전환
            const savedEmoji = faceEmojiRef.current;
            const savedBgRemove = bgRemoveRef.current;
            if (savedEmoji || savedBgRemove) {
                console.log("[Init] Detected saved emoji/bgRemove, switching to canvasPipeline");
                // 약간의 대기 후 turnOnCamera 호출
                setTimeout(async () => {
                    if (!canvasPipelineActiveRef.current) {
                        try {
                            await turnOnCamera();
                        } catch (e) {
                            console.warn("[Init] turnOnCamera for saved state failed:", e);
                        }
                    }
                }, 500);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // startMeeting은 MeetingRouteBridge / startLocalMedia에서 roomId·subjectId와 함께 호출됨
        return () => {
            // 🔥 언마운트 시 얼굴 필터 정리
            stopFaceEmojiFilter().catch(() => { });
            stopAvatarFilter().catch(() => { });

            // ❗ 언마운트 시에만 종료 (숨김일 땐 호출 안 됨)
            endMeeting();
        };
    }, [endMeeting, stopFaceEmojiFilter, stopAvatarFilter]);

    useEffect(() => {
        const handler = () => {
            const video = document.querySelector("video[data-main-video]");
            if (video) {
                requestBrowserPip(video).catch(() => { });
            }
        };

        window.addEventListener("meeting:request-pip", handler);
        return () =>
            window.removeEventListener("meeting:request-pip", handler);
    }, [requestBrowserPip]);

    useEffect(() => {
        let lastPip = false;

        const interval = setInterval(() => {
            const nowPip = !!document.pictureInPictureElement;

            // PiP → 일반 화면으로 전환된 순간
            if (lastPip && !nowPip) {
                window.dispatchEvent(
                    new CustomEvent("pip:exited")
                );
            }

            lastPip = nowPip;
        }, 300);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const video = mainVideoRef.current;
            if (!video) return;
            if (!document.pictureInPictureElement) return;

            const stream = video.srcObject;
            const track = stream?.getVideoTracks?.()[0];

            const videoGone =
                !stream ||
                !track ||
                track.readyState !== "live";

            if (videoGone) {
                document.exitPictureInPicture().catch(() => { });
                window.dispatchEvent(
                    new CustomEvent("pip:auto-closed-by-camera-off")
                );
            }
        }, 300);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!roomReconnecting) {
            // roomReconnecting이 false가 되면 리셋
            roomSyncRequestedRef.current = false;
            return;
        }

        const sfuWs = sfuWsRef.current;
        if (!sfuWs || sfuWs.readyState !== WebSocket.OPEN) {
            console.log("[room:sync] WebSocket not ready");
            return;
        }

        // recvTransport가 준비되지 않았으면 대기
        if (!recvTransportRef.current || !sfuDeviceRef.current) {
            console.log("[room:sync] recvTransport not ready, will retry when ready");
            return;
        }

        // 이미 요청을 보냈으면 중복 방지
        if (roomSyncRequestedRef.current) {
            console.log("[room:sync] Request already sent, skipping");
            return;
        }

        // handler가 이미 등록되어 있으면 재사용
        if (!roomSyncHandlerRef.current) {
            roomSyncHandlerRef.current = async (event) => {
                const msg = JSON.parse(event.data);
                if (msg.action !== "room:sync:response") return;

                console.log("[room:sync] Received room:sync:response", msg.data);
                const { peers, existingProducers } = msg.data || {};

                // peers가 없어도 처리 (빈 배열일 수 있음)
                if (!Array.isArray(peers)) {
                    console.warn("[room:sync] Invalid peers in response, but continuing");
                }

                // 1. 참가자 상태 업데이트
                if (Array.isArray(peers) && peers.length > 0) {
                    peers.forEach(peer => {
                        // 🔥 이 값이 “진실”
                        setParticipants(prev =>
                            prev.map(p =>
                                String(p.id) === String(peer.peerId)
                                    ? {
                                        ...p,
                                        muted: !peer.micOn,
                                        cameraOff: !peer.cameraOn,
                                        isReconnecting: false,
                                        isLoading: false,
                                    }
                                    : p
                            )
                        );

                        // ❗ producer 없으면 절대 consume 시도 X
                        if (!peer.cameraOn) {
                            removeVideoConsumer(peer.peerId);
                        }
                        if (!peer.micOn) {
                            removeAudioConsumer(peer.peerId);
                        }
                    });
                }

                // 2. 기존 producer들을 다시 consume
                if (existingProducers && Array.isArray(existingProducers)) {
                    console.log(`[room:sync] Re-consuming ${existingProducers.length} producers`);
                    for (const producer of existingProducers) {
                        // 이미 consume 중인 producer는 스킵
                        if (consumersRef.current.has(producer.producerId)) {
                            console.log(`[room:sync] Producer ${producer.producerId} already consumed, skipping`);
                            continue;
                        }
                        try {
                            await consumeProducer(producer.producerId, producer.peerId, producer.appData || {});
                        } catch (error) {
                            console.error(`[room:sync] Failed to consume producer ${producer.producerId}:`, error);
                        }
                    }
                }

                // 항상 roomReconnecting을 false로 설정 (peers가 없어도)
                hasFinishedInitialSyncRef.current = true;
                setRoomReconnecting(false);

                // ✅ room:sync 완료 후 모든 참가자의 isReconnecting 강제 해제
                setParticipants(prev => prev.map(p => ({
                    ...p,
                    isReconnecting: false,
                    isLoading: false,
                    reconnectStartedAt: undefined
                })));

                bumpStreamVersion();
                roomSyncRequestedRef.current = false;

                console.log("[room:sync] Room sync completed, roomReconnecting set to false");

                // handler 제거
                const currentSfuWs = sfuWsRef.current;
                if (currentSfuWs && roomSyncHandlerRef.current) {
                    currentSfuWs.removeEventListener("message", roomSyncHandlerRef.current);
                }
                roomSyncHandlerRef.current = null;
            };
            sfuWs.addEventListener("message", roomSyncHandlerRef.current);
        }

        console.log("[room:sync] Sending room:sync request");
        roomSyncRequestedRef.current = true;
        sfuWs.send(JSON.stringify({
            action: "room:sync",
            requestId: safeUUID(),
        }));

        // 타임아웃 설정 (10초 후에도 응답이 없으면 재시도)
        const timeoutId = setTimeout(() => {
            if (roomSyncRequestedRef.current && roomReconnecting) {
                console.warn("[room:sync] Timeout waiting for response, will retry");
                roomSyncRequestedRef.current = false;
                // useEffect가 다시 실행되도록 강제
                setRecvTransportReady(prev => !prev);
            }
        }, 10000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [roomReconnecting, recvTransportReady]);

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
            // ❗ 통화 종료 버튼일 때만 LEAVE
            if (!isLeavingRef.current) {
                console.log("[beforeunload] ignored (PiP / LMS 이동)");
                return;
            }

            try {
                wsRef.current?.send(
                    JSON.stringify({ type: "LEAVE" })
                );
            } catch { }

            try {
                wsRef.current?.close();
            } catch { }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    /* useEffect(() => {
        const video = mainVideoRef.current;
        if (!video) return;

        const handleLeavePiP = () => {
            console.log("[PiP] 복귀 - MeetingPage로 돌아갑니다");

            // ❗ 통화 종료 아님 → LEAVE 보내지 않도록
            isLeavingRef.current = false;

            navigate(
                `/lms/${subjectId}/MeetingRoom/${roomId}`,
                { replace: true }
            );
        };

        video.addEventListener("leavepictureinpicture", handleLeavePiP);

        return () => {
            video.removeEventListener(
                "leavepictureinpicture",
                handleLeavePiP
            );
        };
    }, [navigate, subjectId, roomId]); */

    useEffect(() => {
        // 이미 해제됐으면 아무것도 안 함
        if (!roomReconnecting) return;

        // 내 로컬 미디어 준비 + recvTransport 준비 + 초기 sync 완료
        if (!isLocalLoading && recvTransportRef.current && hasFinishedInitialSyncRef.current) {
            setRoomReconnecting(false);
        }
    }, [isLocalLoading, streamVersion, roomReconnecting]);

    useEffect(() => {
        const interval = setInterval(() => {
            setParticipants(prev =>
                prev.map(p => {
                    if (!p.isReconnecting) return p;

                    const peerId = String(p.id);
                    if (p.isMe) {
                        return {
                            ...p,
                            isReconnecting: false,
                            isLoading: false,
                            reconnectStartedAt: undefined,
                        };
                    }

                    const elapsed = Date.now() - (p.reconnectStartedAt ?? 0);

                    // 최소 800ms는 보여주기
                    if (elapsed < 800) return p;

                    // ✅ 800ms 이상 경과했으면 재접속 상태 종료
                    if (reconnectHistoryRef.current.has(peerId)) {
                        console.log(`✅ [RECONNECT COMPLETED] ${p.name} (${peerId}) - elapsed=${elapsed}ms`);
                        reconnectHistoryRef.current.delete(peerId);
                        reconnectCompletedTimeRef.current.set(peerId, Date.now());  // ✅ 완료 시간 기록
                    }

                    // 스트림이 생겼거나, 카메라 OFF면 종료
                    if (p.stream || p.cameraOff) {
                        if (reconnectHistoryRef.current.has(peerId)) {
                            reconnectHistoryRef.current.delete(peerId);
                            reconnectCompletedTimeRef.current.set(peerId, Date.now());  // ✅ 완료 시간 기록
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

                // 연결 직후 현재 상태 전송 (초기 동기화)
                const sendInitialState = () => {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;

                    ws.send(JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: {
                            muted: !micOnRef.current,
                            cameraOff: !camOnRef.current, // ← 오직 버튼 상태만
                        },
                    }));
                };

                // ⛔ 즉시 보내지 말고
                setTimeout(sendInitialState, 300);

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
                    setParticipants((prev) => {
                        const prevMap = new Map(prev.map((p) => [String(p.id), p]));
                        const newServerIds = new Set(data.users.map((u) => String(u.userId)));

                        // -------------------------------------------------------------
                        // 1. 서버 목록에 있는 유저들 업데이트 (신규 + 기존)
                        // -------------------------------------------------------------
                        const updatedUsers = data.users.map((u) => {
                            const peerId = String(u.userId);
                            const old = prevMap.get(peerId);

                            // 재접속 완료된 경우 이력 정리
                            if (!old && reconnectHistoryRef.current.has(peerId)) {
                                reconnectHistoryRef.current.delete(peerId);
                            }
                            if (reconnectTimeoutRef.current.has(peerId)) {
                                clearTimeout(reconnectTimeoutRef.current.get(peerId));
                                reconnectTimeoutRef.current.delete(peerId);
                            }

                            const isMe = peerId === String(userId);

                            // 스트림 복구 (React 상태 갱신 전 Ref 확인)
                            const refStream = peerStreamsRef.current.get(peerId);
                            const currentStream = old?.stream || refStream || null;

                            // 변수 선언 순서 수정 (ReferenceError 방지)
                            const isOnline = u.online === true;
                            const isOffline = u.online === false && everOnlineRef.current.has(peerId);

                            const completedTime = reconnectCompletedTimeRef.current.get(peerId);
                            const now = Date.now();
                            const recentlyCompleted = completedTime && (now - completedTime) < 1000;

                            if (!isMe) {
                                if (isOffline && !recentlyCompleted) {
                                    if (!reconnectHistoryRef.current.has(peerId)) {
                                        reconnectHistoryRef.current.add(peerId);
                                        console.log(`➕ [ADD RECONNECT] ${u.userName} (${peerId})`);
                                    }
                                } else if (isOnline && reconnectHistoryRef.current.has(peerId)) {
                                    reconnectHistoryRef.current.delete(peerId);
                                }
                            }

                            // ✅ 초기 sync 완료 후에는 기존 참가자에게 재접속 스피너 표시 안 함
                            // PIP 복귀 시 페이지 새로고침으로 인해 online 상태가 잠시 false일 수 있음
                            const shouldShowReconnecting = !isMe && isOffline && !recentlyCompleted && !hasFinishedInitialSyncRef.current && !!old;

                            const baseUser = {
                                id: peerId,
                                name: u.userName,
                                joinAt: u.joinAt,
                                isMe,
                                muted: isMe ? !micOnRef.current : (u.muted ?? false),
                                cameraOff: isMe ? !camOnRef.current : (u.cameraOff ?? true),

                                stream: shouldShowReconnecting ? null : currentStream,
                                screenStream: (shouldShowReconnecting ? null : old?.screenStream) ?? null,
                                isScreenSharing: shouldShowReconnecting ? false : (old?.isScreenSharing ?? false),

                                reaction: old?.reaction ?? null,
                                speaking: old?.speaking ?? false,

                                isJoining: false,
                                isReconnecting: shouldShowReconnecting,
                                isLoading: false,
                                lastUpdate: Date.now(),
                                reconnectStartedAt: shouldShowReconnecting ? (old?.reconnectStartedAt ?? Date.now()) : undefined
                            };

                            // 신규 유저 로딩 처리
                            // ✅ 초기 sync 완료 후에는 "접속 중" 스피너도 표시 안 함
                            if (!old && !reconnectHistoryRef.current.has(peerId)) {
                                const shouldStopLoading = isMe && localStreamRef.current;
                                const skipJoiningSpinner = hasFinishedInitialSyncRef.current;
                                return {
                                    ...baseUser,
                                    isJoining: !isMe && !skipJoiningSpinner,
                                    isLoading: !isMe && !shouldStopLoading && !skipJoiningSpinner,
                                };
                            }

                            // 기존 유저 업데이트
                            const shouldStopLoading = isMe && localStreamRef.current;
                            return {
                                ...baseUser,
                                isLoading: !shouldStopLoading && baseUser.isLoading
                            };
                        });

                        // -------------------------------------------------------------
                        // 2. [Ghost Retention] 서버 목록엔 없지만, 로컬에 있던 유저 살리기
                        // -------------------------------------------------------------
                        const ghostUsers = prev.filter((p) => {
                            const peerId = String(p.id);

                            // 이미 위에서 업데이트된 유저는 제외
                            if (newServerIds.has(peerId)) return false;

                            // 1) 나 자신은 절대 삭제 안 함
                            if (p.isMe) return true;

                            // 2) 재접속 중이면 유지
                            if (reconnectHistoryRef.current.has(peerId) || p.isReconnecting) {
                                console.log(`👻 [GHOST RETAINED] ${p.name} (${peerId}) - Reconnecting logic`);
                                return true;
                            }

                            // 3) ✅ [핵심 추가] 오디오/비디오 Consumer가 하나라도 살아있으면 절대 삭제하지 않음
                            const hasActiveConsumer = Array.from(consumersRef.current.values()).some(
                                (c) => String(c.appData?.peerId) === peerId && !c.closed
                            );

                            if (hasActiveConsumer) {
                                console.log(`🛡️ [CONSUMER PROTECTED] ${p.name} (${peerId}) missing from server list but has active consumers.`);
                                return true;
                            }

                            // 4) ✅ [강화] peerStreamsRef에 스트림이 있으면 보호
                            const hasPeerStream = peerStreamsRef.current.has(peerId);
                            if (hasPeerStream) {
                                console.log(`🔒 [STREAM PROTECTED] ${p.name} (${peerId}) has active peer stream.`);
                                return true;
                            }

                            // 5) ✅ [강화] 최근 30초 내 업데이트된 사용자 보호
                            const lastUpdate = p.lastUpdate || 0;
                            const timeSinceUpdate = Date.now() - lastUpdate;
                            if (timeSinceUpdate < 30000) {
                                console.log(`⏰ [TIME PROTECTED] ${p.name} (${peerId}) updated ${Math.round(timeSinceUpdate / 1000)}s ago.`);
                                return true;
                            }

                            // 그 외(진짜 나감)는 제거
                            console.log(`❌ [REMOVING] ${p.name} (${peerId}) - no protection criteria met.`);
                            return false;
                        }).map(p => {
                            // 활성 consumer가 있는지 확인
                            const peerId = String(p.id);
                            const hasActiveConsumer = Array.from(consumersRef.current.values()).some(
                                (c) => String(c.appData?.peerId) === peerId && !c.closed
                            );

                            return {
                                ...p,
                                // 활성 consumer가 있으면 재접속 중이 아님 (스트림이 곧 복구될 것)
                                isReconnecting: p.isMe ? false : !hasActiveConsumer,
                                // 활성 consumer가 있으면 기존 stream 유지
                                stream: p.isMe ? p.stream : (hasActiveConsumer ? p.stream : null),
                                screenStream: p.isMe ? p.screenStream : null,
                                isScreenSharing: p.isMe ? p.isScreenSharing : false,
                                reconnectStartedAt: p.isMe ? undefined : (hasActiveConsumer ? undefined : (p.reconnectStartedAt || Date.now()))
                            };
                        });

                        // -------------------------------------------------------------
                        // 3. 최종 병합
                        // -------------------------------------------------------------
                        const mergedUsers = [...updatedUsers, ...ghostUsers];

                        setActiveSpeakerId((currentSpeakerId) => {
                            const exists = mergedUsers.some((u) => String(u.id) === String(currentSpeakerId));
                            return exists ? currentSpeakerId : String(mergedUsers[0]?.id ?? "") || null;
                        });

                        return mergedUsers;
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
                    // console.log(`[WS] USER_STATE_CHANGE received:`, data.userId, data.changes);
                    setParticipants((prev) =>
                        prev.map((p) => {
                            if (String(p.id) === String(data.userId)) {
                                // console.log(`[WS] Updating participant ${p.name} with changes:`, data.changes);
                                // ✅ 스트림 관련 필드는 절대 덮어쓰지 않음 (서버가 모르는 정보)
                                const safeChanges = { ...data.changes };
                                delete safeChanges.stream;
                                delete safeChanges.screenStream;
                                delete safeChanges.isScreenSharing;
                                delete safeChanges.reaction;
                                return { ...p, ...safeChanges };
                            }
                            return p;
                        })
                    );
                    return;
                }

                if (data.type === "USER_RECONNECTING") {
                    const peerId = String(data.userId);
                    if (peerId === String(userId)) return;

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
            // ❗ 통화 종료 버튼이 아닌 경우에는 절대 끊지 않는다
            if (!isLeavingRef.current) {
                console.log("[SPRING WS] unmount ignored (PiP / LMS 이동)");
                return;
            }

            if (pingInterval) clearInterval(pingInterval);

            try {
                wsRef.current?.close();
            } catch { }

            wsRef.current = null;
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
                try { a.srcObject = null; } catch { }
            });
            audioElsRef.current.clear();

            sendTransportRef.current = null;
            recvTransportRef.current = null;
            setRecvTransportReady(false);
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
                    setRecvTransportReady(true); // recvTransport 준비 완료

                    const producers = sfuDeviceRef.current?._existingProducers || [];
                    for (const p of producers) {
                        await consumeProducer(p.producerId, p.peerId, p.appData);
                    }

                    await drainPending();
                    hasFinishedInitialSyncRef.current = true;

                    // ✅ recvTransport 생성 완료 시 roomReconnecting 강제 해제
                    setRoomReconnecting(false);

                    // ✅ 모든 참가자의 스피너 강제 해제
                    setParticipants(prev => prev.map(p => ({
                        ...p,
                        isReconnecting: false,
                        isJoining: false,
                        isLoading: false,
                        reconnectStartedAt: undefined
                    })));

                    bumpStreamVersion();

                    // recvTransport가 준비되었고 roomReconnecting이면 room:sync 재시도
                    // useEffect가 자동으로 처리하도록 함 (roomReconnecting이 true이고 recvTransport가 준비되면)
                    // 여기서는 별도로 처리하지 않음
                }
                return;
            }

            if (msg.action === "newProducer") {
                // 🚀 [핵심 수정] 새 프로듀서 알림에서 appData를 꺼내서 전달!
                const { producerId, peerId, appData } = msg.data;

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

                if (appData?.type === "camera") {
                    handlePeerCameraOff(peerId);
                }

                /* if (appData?.mediaTag === "screen") {
                    handlePeerScreenOff(peerId);
                } */

                // 🔥 2️⃣ React 상태 업데이트
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

                        return {
                            ...p,
                            stream: null,
                            cameraOff: true,
                            lastUpdate: Date.now(),
                        };
                    })
                );

                // consumer 정리
                const c = consumersRef.current.get(producerId);
                if (c) {
                    try { c.close(); } catch { }
                }
                consumersRef.current.delete(producerId);

                bumpStreamVersion();
                return;
            }

            if (msg.action === "peerLeft") {
                const { peerId } = msg.data || {};
                if (!peerId) return;

                console.log(`[SFU] peerLeft received for ${peerId}. Starting grace period.`);

                // 1. 재접속 이력에 추가 (USERS_UPDATE에서 이 사람을 삭제하지 않도록 보호)
                reconnectHistoryRef.current.add(peerId);

                // 2. 미디어 스트림 정리 (메모리 누수 방지)
                clearPeerStreamOnly(peerId);
                bumpStreamVersion();

                // 3. 기존에 돌고 있던 삭제 타이머가 있다면 취소 (타이머 리셋 효과)
                if (reconnectTimeoutRef.current.has(peerId)) {
                    clearTimeout(reconnectTimeoutRef.current.get(peerId));
                }

                // ✅ 4. [30초 유예] 30초 뒤에도 복귀하지 않으면 그때 삭제
                const timer = setTimeout(() => {
                    setParticipants(prev => {
                        // 현재 시점에서도 여전히 이 peerId가 있다면 삭제
                        // (만약 복귀했다면 reconnectHistoryRef에서 제거되었을 것임)
                        const stillOffline = reconnectHistoryRef.current.has(peerId);

                        // 🔥 추가 보호: consumer가 살아있으면 삭제하지 않음
                        const hasActiveConsumer = Array.from(consumersRef.current.values()).some(
                            (c) => String(c.appData?.peerId) === peerId && !c.closed
                        );

                        if (hasActiveConsumer) {
                            console.log(`🛡️ [TIMEOUT PROTECTED] Peer ${peerId} still has active consumers. Keeping.`);
                            reconnectHistoryRef.current.delete(peerId);
                            reconnectTimeoutRef.current.delete(peerId);
                            return prev;
                        }

                        if (stillOffline) {
                            console.log(`💀 [REMOVE] Peer ${peerId} timed out after 30s. Removing from UI.`);
                            return prev.filter(p => String(p.id) !== String(peerId));
                        }
                        return prev;
                    });

                    // 5. 메모리 정리
                    reconnectHistoryRef.current.delete(peerId);
                    reconnectTimeoutRef.current.delete(peerId);

                }, 30000); // 🔥 30초 대기 (10초에서 증가)

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
                try { a.srcObject = null; } catch { }
            });
            audioElsRef.current.clear();
        };

        return () => {
            // ❗ 통화 종료 버튼이 아닌 경우에는 절대 leave하지 않는다
            if (!isLeavingRef.current) {
                console.log("[SFU] unmount ignored (PiP / LMS 이동)");
                return;
            }

            effectAliveRef.current = false;

            try {
                safeSfuSend({
                    action: "leave",
                    requestId: safeUUID(),
                    data: { roomId, peerId: userId },
                });
            } catch { }

            producersRef.current.forEach((p) => safeClose(p));
            consumersRef.current.forEach((c) => safeClose(c));

            producersRef.current.clear();
            consumersRef.current.clear();

            try { sfuWsRef.current?.close(); } catch { }
            sfuWsRef.current = null;
        };
    }, [roomId, userId]); // isPipMode를 의존성에서 제거하여 재연결 방지

    useEffect(() => {
        sessionStorage.setItem("sidebarOpen", String(sidebarOpen));
    }, [sidebarOpen]);

    useEffect(() => {
        sessionStorage.setItem("sidebarView", sidebarView);
    }, [sidebarView]);

    useEffect(() => {
        // 마운트 직후 첫 렌더링에서는 스크롤하지 않음 (자동 스크롤 방지)
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            return;
        }

        // 메시지가 있고 채팅 영역이 보이는 상태일 때만 스크롤
        if (messages.length > 0 && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
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
        } catch { }
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

        <div className="meeting-page">
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
                                <div className={`main-stage ${isFullscreen && sidebarOpen ? "sidebar-open" : ""}`} ref={mainStageRef}>
                                    <div className="main-video-area">
                                        <VideoTile
                                            user={mainUser}
                                            isMain
                                            stream={mainStream}
                                            roomReconnecting={roomReconnecting}
                                            isScreen={isMainScreenShare}
                                            reaction={mainUser?.reaction}
                                            videoRef={mainVideoRef}
                                        />

                                        {document.pictureInPictureElement && (
                                            <div className="pip-mode-banner">
                                                PiP 모드 이용중
                                            </div>
                                        )}
                                        <button
                                            className="pip-btn"
                                            onClick={handleBrowserPip}
                                            title="PiP"
                                            type="button"
                                        >
                                            <PictureInPicture2 size={18} />
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
                                            {/* 😀 얼굴 이모지 선택 팝업 */}
                                            {showReactions && (
                                                <div className="fullscreen-reaction-popup">
                                                    <button
                                                        className="reaction-btn"
                                                        onClick={() => {
                                                            setFaceMode("");
                                                            faceModeRef.current = "";
                                                            setFaceEmoji("");
                                                            faceEmojiRef.current = "";
                                                            setBgRemove(false);
                                                            bgRemoveRef.current = false;
                                                            // ✅ 파이프라인은 유지하고(패스스루), 이모지만 제거 → 레이스/검은화면 방지
                                                            startFaceEmojiFilter("").catch(() => { });
                                                            stopAvatarFilter().catch(() => { });
                                                            setShowReactions(false);
                                                            setToastMessage("얼굴 필터가 해제되었습니다.");
                                                            setShowToast(true);
                                                        }}
                                                    >
                                                        ❌
                                                    </button>
                                                    <button
                                                        className={`reaction-btn ${bgRemove ? "active" : ""}`}
                                                        onClick={async () => {
                                                            const next = !bgRemoveRef.current;
                                                            setBgRemove(next);
                                                            bgRemoveRef.current = next;
                                                            setShowReactions(false);
                                                            // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera 호출
                                                            // (drawLoop에서 bgRemoveRef.current를 체크하여 배경 제거 처리)
                                                            if (!canvasPipelineActiveRef.current) {
                                                                await turnOnCamera();
                                                            }
                                                            setToastMessage(next ? "배경이 제거되었습니다." : "배경 제거가 해제되었습니다.");
                                                            setShowToast(true);
                                                        }}
                                                        title="배경 지우기"
                                                    >
                                                        🧹
                                                    </button>
                                                    {faceEmojis.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={async () => {
                                                                setFaceMode("emoji");
                                                                faceModeRef.current = "emoji";
                                                                setFaceEmoji(emoji);
                                                                faceEmojiRef.current = emoji;
                                                                setShowReactions(false);
                                                                // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera로 시작
                                                                if (!canvasPipelineActiveRef.current) {
                                                                    await turnOnCamera();
                                                                }
                                                                setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                                                setShowToast(true);
                                                            }}
                                                            className="reaction-btn"
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
                                                            <div className="invite-section">
                                                                <button className="invite-btn" onClick={handleInvite}>
                                                                    <Share size={16} /> 초대하기
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 🎛 전체화면 미디어 컨트롤 (7개 버튼 - 스트립과 함께 움직임) */}
                                            <div
                                                className={`fullscreen-media-controls ${isStripVisible ? "visible" : "hidden"
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
                                                    onClick={() => {
                                                        if (camOn) {
                                                            turnOffCamera();
                                                        } else {
                                                            turnOnCamera();
                                                        }
                                                    }}
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
                                                    label="얼굴"
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
                                                className={`fullscreen-strip-wrapper ${isStripVisible ? "visible" : "hidden"
                                                    }`}
                                            >
                                                <div className="fullscreen-strip custom-scrollbar">
                                                    {orderedParticipants.map((p) => (
                                                        <div
                                                            key={p.id}
                                                            className={`strip-item ${activeSpeakerId === p.id ? "active-strip" : ""
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

                                            {/* 🔼 스트립 토글 버튼 */}
                                            {showStripToggle && (
                                                <button
                                                    className={`fullscreen-strip-toggle-btn show ${isStripVisible ? "down" : "up"
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
                                            key={p.id}
                                            className={`strip-item ${activeSpeakerId === p.id ? "active-strip" : ""
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
                                            {/* 😀 얼굴 이모지 선택 팝업 */}
                                            {showReactions && (
                                                <div className="grid-fullscreen-reaction-popup">
                                                    <button
                                                        className="reaction-btn"
                                                        onClick={() => {
                                                            // 🔥 새 아키텍처: refs만 초기화
                                                            setFaceMode("");
                                                            faceModeRef.current = "";
                                                            setFaceEmoji("");
                                                            faceEmojiRef.current = "";
                                                            setBgRemove(false);
                                                            bgRemoveRef.current = false;
                                                            setShowReactions(false);
                                                            setToastMessage("얼굴 필터가 해제되었습니다.");
                                                            setShowToast(true);
                                                        }}
                                                    >
                                                        ❌
                                                    </button>
                                                    <button
                                                        className={`reaction-btn ${bgRemove ? "active" : ""}`}
                                                        onClick={async () => {
                                                            const next = !bgRemoveRef.current;
                                                            setBgRemove(next);
                                                            bgRemoveRef.current = next;
                                                            setShowReactions(false);
                                                            // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera 호출
                                                            if (!canvasPipelineActiveRef.current) {
                                                                await turnOnCamera();
                                                            }
                                                            setToastMessage(next ? "배경이 제거되었습니다." : "배경 제거가 해제되었습니다.");
                                                            setShowToast(true);
                                                        }}
                                                        title="배경 지우기"
                                                    >
                                                        🧹
                                                    </button>
                                                    {faceEmojis.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={async () => {
                                                                setFaceMode("emoji");
                                                                faceModeRef.current = "emoji";
                                                                setFaceEmoji(emoji);
                                                                faceEmojiRef.current = emoji;
                                                                setShowReactions(false);
                                                                // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera로 시작
                                                                if (!canvasPipelineActiveRef.current) {
                                                                    await turnOnCamera();
                                                                }
                                                                setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                                                setShowToast(true);
                                                            }}
                                                            className="reaction-btn"
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
                                                                <div key={part.id} className={`participant-card ${part.isMe ? "me" : ""}`}>
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
                                                            <div className="invite-section">
                                                                <button className="invite-btn" onClick={handleInvite}>
                                                                    <Share size={16} /> 초대하기
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 미디어 컨트롤 */}
                                            <div className={`grid-fullscreen-media-controls ${gridStripVisible ? "visible" : "hidden"}`}>
                                                <ButtonControl label={micOn ? "마이크 끄기" : "마이크 켜기"} icon={Mic} active={!micOn} disabled={micDisabled} onClick={toggleMic} />
                                                <ButtonControl label={camOn ? "카메라 끄기" : "카메라 켜기"} icon={Video} active={!camOn} disabled={camDisabled} onClick={() => (camOn ? turnOffCamera() : turnOnCamera())} />
                                                <div className="divider" />
                                                {!isIOS && (
                                                    <ButtonControl
                                                        label={isScreenSharing ? "화면 공유 중지" : "화면 공유"}
                                                        icon={Monitor}
                                                        active={isScreenSharing}
                                                        onClick={() => (isScreenSharing ? stopScreenShare() : startScreenShare())}
                                                    />
                                                )}
                                                <ButtonControl label="얼굴" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
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
                                                            key={part.id}
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
                                        <div key={p.id} className="grid-tile">
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
                                <button
                                    className="reaction-btn"
                                    onClick={() => {
                                        // 🔥 새 아키텍처: refs만 초기화하면 draw 루프가 이모지 없이 비디오만 그림
                                        setFaceMode("");
                                        faceModeRef.current = "";
                                        setFaceEmoji("");
                                        faceEmojiRef.current = "";
                                        setBgRemove(false);
                                        bgRemoveRef.current = false;
                                        setShowReactions(false);
                                        setToastMessage("얼굴 필터가 해제되었습니다.");
                                        setShowToast(true);
                                    }}
                                >
                                    ❌
                                </button>
                                <button
                                    className={`reaction-btn ${bgRemove ? "active" : ""}`}
                                    onClick={async () => {
                                        const next = !bgRemoveRef.current;
                                        setBgRemove(next);
                                        bgRemoveRef.current = next;
                                        setShowReactions(false);
                                        // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera 호출
                                        if (!canvasPipelineActiveRef.current) {
                                            await turnOnCamera();
                                        }
                                        setToastMessage(next ? "배경이 제거되었습니다." : "배경 제거가 해제되었습니다.");
                                        setShowToast(true);
                                    }}
                                    title="배경 지우기"
                                >
                                    🧹
                                </button>
                                {faceEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={async () => {
                                            setFaceMode("emoji");
                                            faceModeRef.current = "emoji";
                                            setFaceEmoji(emoji);
                                            faceEmojiRef.current = emoji;
                                            // 🔥 배경 제거 상태 유지 (동시 사용 가능)
                                            setShowReactions(false);
                                            // 🔥 canvasPipeline이 활성화되어 있지 않으면 turnOnCamera로 시작
                                            if (!canvasPipelineActiveRef.current) {
                                                await turnOnCamera();
                                            }
                                            setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                            setShowToast(true);
                                        }}
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
                                onClick={toggleMic}
                            />
                            <ButtonControl
                                label={camOn ? "카메라 끄기" : "카메라 켜기"}
                                icon={Video}
                                active={!camOn}
                                disabled={camDisabled}
                                onClick={camOn ? turnOffCamera : turnOnCamera}
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
                            <ButtonControl label="얼굴" icon={Smile} active={showReactions} onClick={() => setShowReactions(!showReactions)} />
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
                                    <button className="invite-btn" onClick={handleInvite}>
                                        <Share size={16} /> 초대하기
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            <Toast
                message={toastMessage}
                visible={showToast}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
}

export default MeetingPage;