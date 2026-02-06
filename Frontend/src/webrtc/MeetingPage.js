import {
    ChevronDown, ChevronUp, LayoutGrid, Loader2, Maximize, Minimize, MessageSquare, Mic, MicOff,
    Monitor, MoreHorizontal, PanelRightClose, PanelRightOpen, Phone, PictureInPicture2, Send, Share, Smile, Users, Video, VideoOff, X,
} from "lucide-react";
import "pretendard/dist/web/static/pretendard.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import * as mediasoupClient from "mediasoup-client";
import "./MeetingPage.css";
import { useMeeting } from "./MeetingContext";
import { useLMS } from "../lms/LMSContext";
import Toast from "../toast/Toast";
import { toWsBackendUrl, getWsProtocol } from "../utils/backendUrl";
import api from "../api/api";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    VRMHumanBoneName,
    VRMLoaderPlugin,
    VRMUtils,
} from "@pixiv/three-vrm";

// --- ICE (STUN/TURN) ---
// TURN: 도메인 기반 사용 (IP 대신, 운영 안정성 향상)
// transport 명시 필수 (UDP/TCP 모두 지원)
const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    {
        urls: [
            "turn:onsil.study:3478?transport=udp",
            "turn:onsil.study:3478?transport=tcp",
        ],
        username: "test",
        credential: "test",
    },
];

// SFU 시그널링: nginx/프록시 사용. 포트(:4000) 붙이면 안 됨.
// REACT_APP_SFU_WS_HOST 설정 시 해당 호스트 사용, 미설정 시 현재 도메인(same-origin)
const SFU_WS_BASE = process.env.REACT_APP_SFU_WS_HOST || "";
function getSfuWsUrl() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = SFU_WS_BASE || window.location.hostname;
    // 같은 출처일 때 포트 포함 → 예: http://15.165.181.93:3000 이면 ws://15.165.181.93:3000/sfu/ 로 연결되어 프록시 동작
    const port = SFU_WS_BASE ? "" : (window.location.port ? `:${window.location.port}` : "");
    return `${protocol}://${host}${port}/sfu/`;
}

// --- Components ---

// ✅ 공유 AudioContext (타일마다 새로 만들면 렉/리소스 증가)
let _sharedAudioCtx = null;
let _audioCtxLocked = false; // 통화 종료 후 재생성 방지 잠금
function getSharedAudioContext() {
    if (_audioCtxLocked) return null; // 잠금 상태면 재생성하지 않음
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
        _sharedAudioCtx = new AudioContext();
    }
    if (_sharedAudioCtx.state === "suspended") {
        _sharedAudioCtx.resume().catch(() => { });
    }
    return _sharedAudioCtx;
}
// ✅ 통화 종료 시 AudioContext를 close하여 브라우저 빨간원(녹음중) 표시 제거
function closeSharedAudioContext() {
    _audioCtxLocked = true; // 잠금 활성화: 비동기 코드가 다시 생성하지 못하게
    if (_sharedAudioCtx && _sharedAudioCtx.state !== "closed") {
        try { _sharedAudioCtx.close(); } catch { }
    }
    _sharedAudioCtx = null;
}
function unlockSharedAudioContext() {
    _audioCtxLocked = false;
}

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

// 🔥 전역 프레임 캐시 - VideoTile 리마운트 시에도 마지막 프레임 유지 (PIP 모드 깜빡임 방지)
const globalFrameCache = new Map(); // peerId -> { imageData, width, height, timestamp }

// 🔥 동일 비디오/오디오 트랙이면 기존 stream 참조 유지 → PiP 시 상대방 타일 검은화면 방지
// 🔥 오디오 트랙이 추가되면 새 stream 참조 반환 → 원격 참가자 speaking 감지를 위해 필요
function getStableStreamRef(oldStream, newStream) {
    if (!oldStream || !newStream) return newStream;
    const oldV = oldStream.getVideoTracks?.()?.[0];
    const newV = newStream.getVideoTracks?.()?.[0];
    if (!oldV || !newV) return newStream;
    // 비디오 트랙이 다르면 새 stream 반환
    if (oldV.id !== newV.id) return newStream;

    // 🔥 오디오 트랙 확인: 새 스트림에 오디오가 있는데 기존에는 없으면 새 stream 반환
    // 이래야 VideoTile에서 오디오 분석 effect가 다시 실행됨
    const oldA = oldStream.getAudioTracks?.()?.[0];
    const newA = newStream.getAudioTracks?.()?.[0];
    if (newA && (!oldA || oldA.id !== newA.id)) {
        return newStream;
    }

    return oldStream;
}

// VideoTile 내부에서 오디오 레벨을 직접 감지
const VideoTile = ({ user, isMain = false, stream, isScreen, reaction, roomReconnecting = false, videoRef, isFilterPreparing = false, isBrowserPipMode = false, onSpeakingChange }) => {
    const internalVideoRef = useRef(null);
    const videoEl = internalVideoRef;

    const setVideoRef = (el) => {
        internalVideoRef.current = el;
        if (videoRef) videoRef.current = el;
    };



    // 🔥 Canvas 기반 렌더링을 위한 ref (검은화면/흰화면 깜빡임 방지)
    const displayCanvasRef = useRef(null);
    const canvasCtxRef = useRef(null); // canvas context 캐싱
    const rafIdRef = useRef(null);
    const lastValidFrameRef = useRef(false); // 마지막으로 유효한 프레임이 있었는지
    const lastFrameImageDataRef = useRef(null); // 마지막 유효 프레임 ImageData 저장
    const lastCanvasSizeRef = useRef({ width: 0, height: 0 }); // canvas 크기 추적

    const safeUser = user ?? {
        id: "",
        name: "대기 중",
        isMe: false,
        muted: true,
        cameraOff: true,
        speaking: false,
        isLoading: false,
    };

    // ✅ 트랙 상태 변화(mute/ended)를 실시간으로 감지하기 위한 state
    const [trackVersion, setTrackVersion] = useState(0);

    const hasLiveVideoTrack = useMemo(() => {
        return stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted) ?? false;
    }, [stream, trackVersion]);

    useEffect(() => {
        const track = stream?.getVideoTracks()[0];
        if (!track) return;

        const handleTrackChange = () => setTrackVersion(v => v + 1);

        track.addEventListener("mute", handleTrackChange);
        track.addEventListener("unmute", handleTrackChange);
        track.addEventListener("ended", handleTrackChange);

        return () => {
            track.removeEventListener("mute", handleTrackChange);
            track.removeEventListener("unmute", handleTrackChange);
            track.removeEventListener("ended", handleTrackChange);
        };
    }, [stream]);

    // ✅ 카메라 OFF면 아이콘/아바타 타일로 전환되어야 함
    // (stream이 잠깐 살아있어도, 상태가 OFF면 "꺼짐"으로 표시하는 게 맞음)
    const showVideoOffIcon = !isScreen && !!safeUser.cameraOff;

    const canShowVideo = useMemo(() => {
        if (!stream) return false;

        // 화면공유는 videoTrack이 있으면 보여줌
        if (isScreen) return stream.getVideoTracks().length > 0;

        // ✅ 로컬(나) 영상은 canvas capture 등 synthetic track에서 muted 플래그가
        // 오래 유지될 수 있어 muted 여부로 숨기지 않는다.
        if (safeUser.isMe) return hasLiveVideoTrack;

        // ✅ 원격 카메라 영상은 "live track 존재"만으로 판단
        // (receiver track은 일시적으로 mute 될 수 있으니 mute/enable로 숨기지 않음)
        return hasLiveVideoTrack;
    }, [stream, isScreen, hasLiveVideoTrack, safeUser.isMe]);

    // ✅ 핵심: "실제로 video를 렌더링할지"를 별도로 결정
    // - 화면공유는 videoTrack이 있으면 항상 렌더링
    // - 🔥 카메라 OFF(본인 선택 또는 방장 강제)이면 항상 아바타 타일 — 검은 화면 방지
    // - 카메라 ON이고 live track이 있을 때만 비디오 렌더링
    const shouldRenderVideo = useMemo(() => {
        if (!stream) return false;

        // 화면공유는 항상 렌더링
        if (isScreen) return stream.getVideoTracks().length > 0;

        // 🔥 카메라가 꺼져 있으면(본인 선택 또는 방장 강제) 항상 아바타 타일로 표시
        // — 방장 강제 끄기 시 타일이 검은 화면으로 바뀌는 문제 방지
        if (safeUser.cameraOff) return false;

        const hasLiveTrack = stream.getVideoTracks().some(t => t.readyState === "live");
        if (hasLiveTrack) return true;

        // 스트림에 video track이 있으면 일단 렌더링 (곧 live가 될 수 있음)
        if (stream.getVideoTracks().length > 0) return true;

        return canShowVideo;
    }, [stream, isScreen, safeUser.cameraOff, safeUser.isMe, isFilterPreparing, canShowVideo]);

    // 스트림의 오디오 트랙 목록이 바뀔 때 effect 재실행 (오디오가 나중에 합쳐져도 분석 시작)
    // A화면에서 B 타일이 안 빛나는 오류: B 스트림이 비디오만 있다가 오디오가 나중에 붙으면 stream 참조는 그대로라 effect가 안 돌아감

    // ✅ VideoTile은 이제 순수하게 렌더링만 담당 (오디오 분석은 상위 MeetingPage에서 수행)

    // 🔥 stream 참조를 추적하여 변경 감지 강화
    const streamIdRef = useRef(null);
    const currentStreamId = stream?.id ?? null;

    // 🔥 PiP 진입/복귀 시 상대 타일 검은화면 방지: 트랙 id가 바뀔 때만 "표시용" 스트림 갱신
    // 부모가 같은 트랙의 새 MediaStream 참조를 넘겨도 srcObject/캔버스는 건드리지 않음
    const lastDisplayStreamRef = useRef(null);
    const displayStream = useMemo(() => {
        const vid = stream?.getVideoTracks?.()?.[0];
        const lastVid = lastDisplayStreamRef.current?.getVideoTracks?.()?.[0];
        if (!stream) {
            lastDisplayStreamRef.current = null;
            return null;
        }
        if (vid && lastVid && vid.id === lastVid.id && lastDisplayStreamRef.current) {
            return lastDisplayStreamRef.current;
        }
        lastDisplayStreamRef.current = stream;
        return stream;
    }, [stream, stream?.getVideoTracks?.()?.[0]?.id]);

    // 🔥 Canvas/비디오는 displayStream 기준 (트랙이 같으면 effect 재실행 안 함)
    const displayStreamId = displayStream?.id ?? null;

    // 🔥 Canvas 기반 렌더링 useLayoutEffect (PiP 복귀 시 검은화면 방지: 페인트 전에 캐시 복원)
    useLayoutEffect(() => {
        const v = videoEl.current;
        const canvas = displayCanvasRef.current;
        // 🔥 전역 캐시 키 (peerId 우선 - 같은 참가자는 항상 같은 캐시)
        const cacheKey = (safeUser?.id != null ? String(safeUser.id) : "") || `stream_${displayStreamId}`;

        if (!v || !canvas) return;
        if (!shouldRenderVideo) {
            // 렌더링하지 않을 때는 RAF 중지하지만, 마지막 프레임은 전역 캐시에 보존
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            return;
        }

        // 🔥 canvas context 캐싱 (매번 새로 가져오지 않음)
        if (!canvasCtxRef.current || canvasCtxRef.current.canvas !== canvas) {
            canvasCtxRef.current = canvas.getContext("2d", { willReadFrequently: true });
        }
        const ctx = canvasCtxRef.current;
        if (!ctx) return;

        let isActive = true;
        let frameCount = 0;

        // 🔥 전역 캐시에서 프레임 복원하는 헬퍼 함수
        const restoreFromCache = () => {
            const cached = globalFrameCache.get(cacheKey);
            if (cached && cached.imageData && cached.width > 0 && cached.height > 0) {
                if (canvas.width === 0 || canvas.height === 0) {
                    canvas.width = cached.width;
                    canvas.height = cached.height;
                }
                try {
                    if (canvas.width === cached.width && canvas.height === cached.height) {
                        ctx.putImageData(cached.imageData, 0, 0);
                    } else {
                        const tempCanvas = document.createElement("canvas");
                        tempCanvas.width = cached.width;
                        tempCanvas.height = cached.height;
                        const tempCtx = tempCanvas.getContext("2d");
                        if (tempCtx) {
                            tempCtx.putImageData(cached.imageData, 0, 0);
                            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                        }
                    }
                    return true;
                } catch (e) {
                    // 복원 실패 시 무시
                }
            }
            return false;
        };

        // 🔥 전역 캐시에 프레임 저장하는 헬퍼 함수
        const saveToCache = () => {
            if (canvas.width > 0 && canvas.height > 0) {
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    globalFrameCache.set(cacheKey, {
                        imageData,
                        width: canvas.width,
                        height: canvas.height,
                        timestamp: Date.now()
                    });
                    // 로컬 ref에도 저장 (빠른 접근용)
                    lastFrameImageDataRef.current = imageData;
                    lastCanvasSizeRef.current = { width: canvas.width, height: canvas.height };
                } catch (e) {
                    // getImageData 실패 시 무시
                }
            }
        };

        const drawFrame = () => {
            if (!isActive) return;

            // video가 유효한 프레임을 가지고 있는지 확인
            const hasValidFrame = v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !v.paused;

            if (hasValidFrame) {
                const needsResize = canvas.width !== v.videoWidth || canvas.height !== v.videoHeight;

                if (needsResize) {
                    // 🔥 크기 변경 전에 현재 프레임 저장
                    if (canvas.width > 0 && canvas.height > 0 && lastValidFrameRef.current) {
                        saveToCache();
                    }

                    // canvas 크기 변경 (이 때 canvas 내용이 지워짐)
                    canvas.width = v.videoWidth;
                    canvas.height = v.videoHeight;

                    // 🔥 크기 변경 후 캐시에서 복원
                    restoreFromCache();
                }

                try {
                    // video에서 canvas로 프레임 복사
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    lastValidFrameRef.current = true;

                    // 🔥 주기적으로 전역 캐시에 프레임 저장 (15프레임마다, 약 0.25초)
                    frameCount++;
                    if (frameCount % 15 === 0) {
                        saveToCache();
                    }
                } catch (e) {
                    // drawImage 실패 시 마지막 프레임 유지 (아무것도 안 함)
                }
            } else {
                // 🔥 hasValidFrame이 false일 때 캐시에서 복원
                restoreFromCache();
            }

            rafIdRef.current = requestAnimationFrame(drawFrame);
        };

        // 🔥 시작 전에 전역 캐시 또는 로컬 ref에서 프레임 복원 (리마운트/스트림 변경 시 깜빡임 방지)
        const cachedRestored = restoreFromCache();
        if (!cachedRestored && lastFrameImageDataRef.current && lastCanvasSizeRef.current.width > 0) {
            // 전역 캐시에 없으면 로컬 ref에서 시도
            if (canvas.width === 0 || canvas.height === 0) {
                canvas.width = lastCanvasSizeRef.current.width;
                canvas.height = lastCanvasSizeRef.current.height;
            }
            try {
                if (canvas.width === lastCanvasSizeRef.current.width &&
                    canvas.height === lastCanvasSizeRef.current.height) {
                    ctx.putImageData(lastFrameImageDataRef.current, 0, 0);
                } else {
                    const tempCanvas = document.createElement("canvas");
                    tempCanvas.width = lastCanvasSizeRef.current.width;
                    tempCanvas.height = lastCanvasSizeRef.current.height;
                    const tempCtx = tempCanvas.getContext("2d");
                    if (tempCtx) {
                        tempCtx.putImageData(lastFrameImageDataRef.current, 0, 0);
                        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                    }
                }
            } catch (e) {
                // 복원 실패 시 무시
            }
        }

        // RAF 루프 시작
        drawFrame();

        return () => {
            isActive = false;
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            // 🔥 cleanup 시 마지막 프레임은 보존 (refs는 유지됨)
        };
    }, [displayStream, shouldRenderVideo]);

    // 🔥 srcObject 설정: displayStream만 사용 (트랙 id가 바뀔 때만 교체 → PiP 시 상대 타일 검은화면 방지)
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        const hasLiveStream = (displayStream || stream) && (displayStream || stream).getVideoTracks().some(t => t.readyState === "live");

        if (!shouldRenderVideo) {
            // 렌더링하지 않을 때도 스트림이 live면 유지 (PIP 등)
            if (hasLiveStream && v.srcObject && v.paused) {
                v.play().catch(() => { });
            }
            return;
        }

        // 🔥 displayStream 기준으로만 교체 (트랙 id가 같으면 이미 같은 스트림 참조이므로 교체 없음)
        const needsUpdate = displayStream && (streamIdRef.current !== displayStreamId || v.srcObject !== displayStream || !v.srcObject);

        if (displayStream && needsUpdate) {
            try {
                v.srcObject = displayStream;
                streamIdRef.current = displayStreamId;
            } catch (e) {
                console.warn("[VideoTile] srcObject 업데이트 실패:", e);
            }
        }

        v.muted = true;

        // 🔥 비디오 재생 보장 (단순화)
        const ensurePlay = async () => {
            if (!v || !v.srcObject) return;
            if (!shouldRenderVideo && !hasLiveStream) return;

            try {
                if (v.paused || v.readyState < 2) {
                    await v.play();
                }
            } catch (err) {
                setTimeout(() => {
                    if (v && v.srcObject && (shouldRenderVideo || hasLiveStream)) {
                        v.play().catch(() => { });
                    }
                }, 50);
            }
        };

        ensurePlay();

        // 🔥 스트림이 live 상태인데 비디오가 재생되지 않으면 주기적으로 재시도 (displayStream 사용)
        const playRetryInterval = setInterval(() => {
            if (!v || !v.srcObject) {
                if (hasLiveStream && v && displayStream) {
                    v.srcObject = displayStream;
                    v.play().catch(() => { });
                } else {
                    clearInterval(playRetryInterval);
                    return;
                }
            }

            if (!shouldRenderVideo && !hasLiveStream) {
                clearInterval(playRetryInterval);
                return;
            }

            const hasLiveTrack = displayStream && displayStream.getVideoTracks().some(t => t.readyState === "live");
            if (hasLiveTrack && (v.paused || v.readyState < 2)) {
                v.play().catch(() => { });
            } else if (hasLiveTrack && !v.paused) {
                clearInterval(playRetryInterval);
            }
        }, 500);

        // 🔥 Page Visibility API: 탭이 다시 보일 때 비디오 재생
        const handleVisibilityChange = () => {
            if (!document.hidden && v && v.srcObject && shouldRenderVideo) {
                console.log("[VideoTile] 탭이 다시 보임, 비디오 재생 시도");
                ensurePlay();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // 🔥 PIP 모드 종료 시 비디오 재생 보장 (검은 화면 방지) - displayStream 사용
        const handlePipLeave = () => {
            console.log("[VideoTile] PIP 모드 종료 감지, 비디오 재생 시도");
            if (v && displayStream) {
                const forceReconnect = () => {
                    try {
                        if (!v.srcObject || v.srcObject !== displayStream) {
                            v.srcObject = displayStream;
                            streamIdRef.current = displayStreamId;
                            console.log("[VideoTile] ✅ PIP 종료 후 srcObject 재설정 완료");
                        }
                    } catch (e) {
                        console.warn("[VideoTile] PIP 종료 시 srcObject 설정 실패:", e);
                    }
                };
                forceReconnect();
                const retryPlay = async (attempt = 0) => {
                    if (attempt > 15) return;
                    if (!v || !displayStream) return;
                    forceReconnect();
                    const hasLive = displayStream.getVideoTracks().some(t => t.readyState === "live");
                    if (!hasLive && attempt < 5) {
                        // 처음 5번은 스트림이 live가 될 때까지 대기
                        setTimeout(() => retryPlay(attempt + 1), 100);
                        return;
                    }

                    try {
                        if (v.paused || v.readyState < 2) {
                            await v.play();
                            console.log("[VideoTile] ✅ PIP 종료 후 비디오 재생 성공 (시도:", attempt + 1, ")");
                        } else {
                            console.log("[VideoTile] ✅ PIP 종료 후 비디오 이미 재생 중");
                            return; // 재생 중이면 종료
                        }
                    } catch (err) {
                        console.warn("[VideoTile] PIP 종료 후 비디오 재생 실패 (시도:", attempt + 1, "):", err);
                        // 30ms 후 재시도 (더 빠른 재시도)
                        setTimeout(() => retryPlay(attempt + 1), 30);
                    }
                };
                // 즉시 시작하고, 여러 번 시도
                retryPlay();
                setTimeout(() => retryPlay(3), 100);
                setTimeout(() => retryPlay(6), 300);
            }
        };

        // PIP 종료 이벤트 감지
        if (v) {
            v.addEventListener("leavepictureinpicture", handlePipLeave);
        }

        return () => {
            clearInterval(playRetryInterval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (v) {
                v.removeEventListener("leavepictureinpicture", handlePipLeave);
            }
        };
    }, [displayStream, shouldRenderVideo, displayStreamId]);

    const isSpeaking = !!safeUser.speaking;
    const isJoining = safeUser.isJoining;
    const isReconnecting = safeUser.isReconnecting;

    const showRoomReconnecting = roomReconnecting && !safeUser.isMe;

    // 🔥 스트림이 실제로 live 상태인지 확인하여 재접속 스피너 표시 여부 결정
    const hasLiveStream = stream && stream.getVideoTracks().some(t => t.readyState === "live");
    // 스트림이 live 상태면 재접속 스피너를 표시하지 않음 (스트림이 정상 작동 중)
    const shouldShowReconnecting = !safeUser.isMe && isReconnecting && !hasLiveStream;

    // pip 모드 여부 확인 (렌더링 시점)
    // const isCurrentlyInPip = document.pictureInPictureElement === videoEl.current;

    const peerId = safeUser?.id != null ? String(safeUser.id) : "";
    const peerName = safeUser?.name != null ? String(safeUser.name) : "";

    return (
        <div
            className={`video-tile ${isMain ? "main" : ""} ${safeUser.isMe ? "me" : ""} ${isSpeaking ? "speaking" : ""} ${isScreen ? "screen-share" : ""}`}
            data-peer-id={peerId}
            data-peer-name={peerName}
        >
            {/* ✅ 핵심 원칙: 재접속 스피너는 원격 타일(remote tile)에만 표시 */}
            {/* 로컬 타일(!safeUser.isMe === false)은 절대 재접속 스피너를 보지 않음 */}
            {/* 🔥 스트림이 live 상태면 재접속 스피너를 표시하지 않음 */}
            {shouldShowReconnecting && (
                <div className="reconnecting-overlay">
                    <Loader2 className="spinner" />
                    <p>재접속 중...</p>
                </div>
            )}

            <div className={`video-content ${isScreen ? "screen-share" : ""}`} style={{ position: "relative" }}>
                {/* 🔥 숨겨진 video element (canvas 렌더링 소스) */}
                <video
                    ref={setVideoRef}
                    autoPlay
                    playsInline
                    muted
                    data-main-video={isMain ? "main" : "tile"}
                    data-peer-id={peerId}
                    data-peer-name={peerName}
                    className={`video-element ${isScreen ? "screen" : ""}`}
                    style={{
                        position: "absolute",
                        width: "1px",
                        height: "1px",
                        opacity: 0,
                        pointerEvents: "none",
                    }}
                />

                {/* 🔥 Canvas 기반 렌더링 (깜빡임 완전 방지) - 항상 렌더링하여 마지막 프레임 유지 */}
                <canvas
                    ref={displayCanvasRef}
                    className={`video-element ${isScreen ? "screen" : ""}`}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: isScreen ? "contain" : "cover",
                        display: "block",
                        // 🔥 shouldRenderVideo가 false여도 canvas를 DOM에 유지 (마지막 프레임 보존)
                        // opacity로 숨기면 canvas 내용이 유지됨
                        opacity: shouldRenderVideo ? 1 : 0,
                        position: shouldRenderVideo ? "relative" : "absolute",
                        pointerEvents: shouldRenderVideo ? "auto" : "none",
                    }}
                />

                {/* 카메라 꺼짐 또는 스트림 없음 - canvas 위에 겹쳐서 표시 */}
                {!shouldRenderVideo && (
                    <div
                        className="camera-off-placeholder"
                        style={isMain ? { position: "absolute", zIndex: 1, top: "50%", left: "50%", transform: "translate(-50%, -50%)" } : { position: "relative", zIndex: 1 }}
                    >
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

function MeetingPage({ portalRoomId }) {
    const params = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();

    const navigate = useNavigate();
    const loggedRef = useRef(false);

    // /lms/{subjectId}/MeetingRoom/{roomId} → subjectId는 subject_id, roomId는 서버 난수(room_id)로 DB 저장
    const pathMatch = useMemo(() => location.pathname.match(/\/lms\/([^/]+)\/MeetingRoom\/([^/]+)/), [location.pathname]);
    const subjectIdFromPath = pathMatch ? pathMatch[1] : null;
    const roomIdFromPath = pathMatch ? pathMatch[2] : null;
    const roomId = roomIdFromPath || params.roomId || portalRoomId || sessionStorage.getItem("pip.roomId");
    const subjectId = subjectIdFromPath || params.subjectId || sessionStorage.getItem("pip.subjectId");

    useEffect(() => {
        if (!roomId) return;
        if (loggedRef.current) return;

        console.log("[CLIENT] roomId =", roomId, "(from:", params.roomId ? "URL" : "portal/session", ")");
        loggedRef.current = true;
    }, [roomId, params.roomId]);

    const {
        startMeeting,
        endMeeting,
        saveMeetingState,
        requestBrowserPip,
        isPipMode,
        isBrowserPipMode,
        customPipData,
        pipVideoRef, // 🔥 브라우저 PIP용 숨겨진 video element ref
    } = useMeeting();

    // roomTitle, email, room 정보 (LMSContext에서)
    const { roomTitle, email, user, room, roomNickname } = useLMS();
    const hostUserEmail = room?.hostUserEmail || "";
    /** 회차 ID - 있으면 meetingroom_participant/meeting_room DB 저장, 없으면 입장만 허용 */
    const scheduleId = searchParams.get("scheduleId") ?? room?.scheduleId ?? (() => { try { const s = sessionStorage.getItem("pip.scheduleId"); return s != null && s !== "" ? Number(s) : null; } catch { return null; } })();
    const userEmail = (email || user?.email || sessionStorage.getItem("userEmail") || "").trim();
    const isHostLocal =
        !!userEmail &&
        !!hostUserEmail &&
        String(userEmail).toLowerCase() === String(hostUserEmail).trim().toLowerCase();

    useEffect(() => {
        if (!roomId || !subjectId) return;

        // ✅ 새 회의 입장 시 AudioContext 잠금 해제 (이전 통화 종료에서 잠겼을 수 있음)
        unlockSharedAudioContext();

        console.log("[MeetingPage] startMeeting", { roomId, subjectId });
        startMeeting(roomId, subjectId);
    }, [roomId, subjectId, startMeeting]);

    // 🔥 roomId가 달라지면 micOn/camOn 저장값 초기화 → 새 방에서는 마이크·카메라 켠 상태로 시작
    const prevRoomIdRef = useRef(null);
    useEffect(() => {
        if (!roomId) return;
        const prev = prevRoomIdRef.current;
        prevRoomIdRef.current = roomId;
        if (prev != null && prev !== roomId) {
            try {
                localStorage.removeItem("micOn");
                localStorage.removeItem("camOn");
            } catch { }
            setMicOn(true);
            setCamOn(true);
        }
    }, [roomId]);

    // DB 입장 로그용: subjectId·scheduleId를 sessionStorage에 유지 (WebSocket URL에 항상 포함되도록)
    useEffect(() => {
        if (subjectId) try { sessionStorage.setItem("pip.subjectId", subjectId); } catch (e) { }
        if (scheduleId != null && scheduleId !== "") try { sessionStorage.setItem("pip.scheduleId", String(scheduleId)); } catch (e) { }
        if (roomId) try { sessionStorage.setItem("pip.roomId", roomId); } catch (e) { }
    }, [subjectId, scheduleId, roomId]);

    // 🔥 브라우저 PIP용 숨겨진 video element 생성 및 초기화
    useEffect(() => {
        if (!pipVideoRef) return;

        // 이미 생성되어 있으면 재생성하지 않음
        if (pipVideoRef.current) {
            console.log("[MeetingPage] 숨겨진 PIP video가 이미 존재합니다.");
            return;
        }

        // 숨겨진 video element 생성
        const hiddenVideo = document.createElement("video");
        hiddenVideo.autoplay = true;
        hiddenVideo.playsInline = true;
        hiddenVideo.muted = true;
        // 완전히 숨기기 (화면 밖으로 이동 + 투명도 0)
        hiddenVideo.style.cssText = "position:fixed; bottom:-9999px; right:-9999px; width:1px; height:1px; opacity:0; pointer-events:none; z-index:-9999;";
        document.body.appendChild(hiddenVideo);
        pipVideoRef.current = hiddenVideo;

        console.log("[MeetingPage] ✅ 숨겨진 PIP video element 생성 완료");

        // 🔥 Page Visibility API: 탭이 다시 보일 때 숨겨진 video 재생
        const handleVisibilityChange = () => {
            if (!document.hidden && hiddenVideo && hiddenVideo.paused && hiddenVideo.srcObject) {
                console.log("[MeetingPage] 탭이 다시 보임, 숨겨진 PIP video 재생 시도");
                hiddenVideo.play().catch((err) => {
                    console.warn("[MeetingPage] 숨겨진 PIP video 재생 실패:", err);
                });
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // cleanup: 컴포넌트 언마운트 시 제거
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (pipVideoRef.current) {
                try {
                    pipVideoRef.current.pause();
                    pipVideoRef.current.srcObject = null;
                    pipVideoRef.current.remove();
                } catch (e) {
                    console.warn("[MeetingPage] 숨겨진 PIP video cleanup 중 오류:", e);
                }
                pipVideoRef.current = null;
            }
        };
    }, [pipVideoRef]);

    const [layoutMode, setLayoutMode] = useState("speaker");

    // 🔥 사이드바 상태를 로컬스토리지에서 복원 (기본값: 열림)
    const [sidebarView, setSidebarView] = useState(() => {
        try {
            return localStorage.getItem("meeting.sidebarView") || "chat";
        } catch {
            return "chat";
        }
    });

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        try {
            const saved = localStorage.getItem("meeting.sidebarOpen");
            // 저장된 값이 있으면 사용, 없으면 기본값 true (열림)
            return saved !== null ? saved === "true" : true;
        } catch {
            return true; // 기본값: 열림
        }
    });

    const [micOn, setMicOn] = useState(() => {
        const saved = localStorage.getItem("micOn");
        return saved !== null ? saved === "true" : true;
    });

    const [camOn, setCamOn] = useState(() => {
        const saved = localStorage.getItem("camOn");
        return saved !== null ? saved === "true" : true;
    });

    /** 방장이 강제로 마이크를 끈 경우 — 스스로 마이크 켤 수 없음 */
    const [mutedByHostMe, setMutedByHostMe] = useState(false);
    /** 방장이 강제로 카메라를 끈 경우 — 스스로 카메라 켤 수 없음 */
    const [cameraOffByHostMe, setCameraOffByHostMe] = useState(false);

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

    // 🔥 필터 준비중 스피너 제거 - 항상 false로 유지하여 바로 카메라 표시
    // 이모지/배경제거는 준비되면 자동으로 적용됨
    const [isFilterPreparing] = useState(false);

    const [messages, setMessages] = useState(() => {
        try {
            const saved = sessionStorage.getItem(`chat_${roomId}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [roomReconnecting, setRoomReconnecting] = useState(true);
    /** SFU WS 끊김 시 재연결 트리거 (검은화면 방지) */
    const [sfuReconnectKey, setSfuReconnectKey] = useState(0);

    const [participantCount, setParticipantCount] = useState(1);
    const [chatDraft, setChatDraft] = useState("");

    /** 방 시작 시각(ms). 서버에서 USERS_UPDATE로 전달 → 모두 동일한 경과 시간 표시 */
    const [roomStartedAt, setRoomStartedAt] = useState(null);
    /** 경과 시간 표시 "00:00:00" (1초마다 갱신) */
    const [elapsedTimeDisplay, setElapsedTimeDisplay] = useState("00:00:00");

    const [showReactions, setShowReactions] = useState(false);
    const [myReaction, setMyReaction] = useState(null);

    // 🔥 토스트 메시지 상태
    const [toastMessage, setToastMessage] = useState("");
    const [showToast, setShowToast] = useState(false);

    // 👑 방장 권한 드롭다운 메뉴 상태
    const [hostMenuTargetId, setHostMenuTargetId] = useState(null);

    // 방장이 카메라 켜기 요청 시 표시할 확인 모달 (window.confirm은 WebSocket 콜백에서 차단되므로 인앱 모달 사용)
    const [forceCameraOnRequest, setForceCameraOnRequest] = useState(null); // null | { hostName: string }
    // 방장이 마이크 켜기 요청 시 표시할 확인 모달
    const [forceUnmuteRequest, setForceUnmuteRequest] = useState(null); // null | { hostName: string }
    // 통화 종료 확인 모달
    const [leaveConfirmModal, setLeaveConfirmModal] = useState(false);

    // 🔥 얼굴 이모지 필터
    const [faceEmoji, setFaceEmoji] = useState(() => {
        try {
            // ✅ 얼굴 이모지/모드는 "다음 접속에도 유지"해야 하므로 localStorage 우선
            return localStorage.getItem("faceEmoji") || sessionStorage.getItem("faceEmoji") || "";
        } catch {
            return "";
        }
    });

    // 🔥 얼굴 필터 모드: "", "emoji", "avatar"
    const [faceMode, setFaceMode] = useState(() => {
        try {
            return localStorage.getItem("faceMode") || sessionStorage.getItem("faceMode") || "";
        } catch {
            return "";
        }
    });

    // 🔥 (emoji쪽) 배경 지우기 토글
    const [bgRemove, setBgRemove] = useState(() => {
        try {
            // ✅ 배경제거는 "다음 접속에도 유지"해야 하므로 localStorage 우선
            return localStorage.getItem("faceBgRemove") === "true" || sessionStorage.getItem("faceBgRemove") === "true";
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
    /** SFU consumer에서 참가자 생성 시 peerId → 표시 이름 조회용 (USERS_UPDATE에서 갱신) */
    const peerIdToNameRef = useRef(new Map());

    const effectAliveRef = useRef(true);
    const chatEndRef = useRef(null);
    const chatAreaRef = useRef(null);
    const [chatConnected, setChatConnected] = useState(false);
    const lastSpeakingRef = useRef(null);
    const isInitialMountRef = useRef(true);

    const reactionTimersRef = useRef({});

    const micOnRef = useRef(micOn);
    const camOnRef = useRef(camOn);
    const micPermissionRef = useRef(micPermission);
    const camPermissionRef = useRef(camPermission);
    // 🔥 필터 준비 중 상태 ref (비동기 함수에서 최신 값 참조용)
    const isFilterPreparingRef = useRef(isFilterPreparing);
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
    // 🔥 faceFilter용 마지막 정상 프레임 저장 (검/흰 화면 대신 freeze용)
    const faceFilterLastGoodFrameCanvasRef = useRef(null);
    const faceFilterLastGoodFrameAtRef = useRef(0);
    const faceBgMaskCanvasRef = useRef(null);        // 배경 제거용 마스크 캔버스
    const faceBgSegmenterRef = useRef(null);         // MediaPipe ImageSegmenter
    const faceBgLastInferAtRef = useRef(0);
    const faceFilterOutStreamRef = useRef(null);
    const faceFilterOutTrackRef = useRef(null);
    const faceFilterRawTrackRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const lastFaceBoxRef = useRef(null);
    const smoothedFaceBoxRef = useRef(null);  // 🔥 이모지 떨림 방지용 smoothed 위치
    const hasEverDrawnEmojiRef = useRef(false);  // 🔥 카메라 켤 때 한 번만 검은화면, 이후 얼굴 미감지 시에는 원본 비디오(움직임 유지)
    const emojiBlackScreenStartedAtRef = useRef(0);   // 🔥 검은화면 시작 시각 (3초 경과 시 토스트용)
    const emojiBlackScreenToastShownRef = useRef(false);  // 🔥 검은화면 3초 토스트 이미 표시 여부
    const lastDetectAtRef = useRef(0);
    const lastFaceBoxAtRef = useRef(0);       // ✅ 마지막으로 "유효한 얼굴 박스"를 갱신한 시각(ms)
    const faceDetectorLoadingRef = useRef(null);
    const faceDetectorLastAttemptAtRef = useRef(0);
    const faceDetectInFlightRef = useRef(false);

    // 🔥 bottom-strip 스크롤 관련 refs
    const bottomStripRef = useRef(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const faceDetectSeqRef = useRef(0);
    const faceDetectCanvasRef = useRef(null);
    const faceDetectCtxRef = useRef(null);
    const pipelineWarmupUntilRef = useRef(0);
    // ✅ 얼굴 이모지 필터 start/stop 레이스 방지용 오퍼레이션 큐
    const faceEmojiOpRef = useRef(Promise.resolve());

    // ✅ 얼굴 bbox 정규화/검증
    // - 일부 환경에서 bbox가 0~1 정규화 값으로 들어오는 경우가 있어 픽셀로 보정
    // - 너무 엄격하게 막으면 "배경 제거는 되는데 이모지가 안 뜨는" 현상이 발생할 수 있어 완화
    const normalizeFaceBox = (box, videoW, videoH) => {
        if (!box) return null;
        let x = Number(box.x);
        let y = Number(box.y);
        let w = Number(box.width);
        let h = Number(box.height);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
        if (w <= 0 || h <= 0) return null;

        const vw = Number(videoW) || 0;
        const vh = Number(videoH) || 0;

        // normalized(0~1)로 들어오는 케이스 보정
        const looksNormalized = vw > 0 && vh > 0 && w <= 1.5 && h <= 1.5;
        if (looksNormalized) {
            x = x * vw;
            y = y * vh;
            w = w * vw;
            h = h * vh;
        }

        // 최소 크기(너무 작은 값은 노이즈)
        if (w < 8 || h < 8) return null;

        if (vw > 0 && vh > 0) {
            // 살짝 벗어나는 값은 클램프(엄격한 reject로 이모지가 아예 안 뜨는 현상 방지)
            const margin = 8;
            x = Math.max(-margin, Math.min(vw + margin, x));
            y = Math.max(-margin, Math.min(vh + margin, y));
            w = Math.max(0, Math.min(vw - x, w));
            h = Math.max(0, Math.min(vh - y, h));
            if (w < 8 || h < 8) return null;
        }

        return { x, y, width: w, height: h };
    };

    const isValidFaceBox = (box, videoW, videoH) => {
        return !!normalizeFaceBox(box, videoW, videoH);
    };

    // ✅ 얼굴 탐지기 초기화(재시도 포함)
    const ensureFaceDetector = useCallback(async () => {
        if (faceDetectorRef.current) return faceDetectorRef.current;
        if (faceDetectorLoadingRef.current) return null;

        const now = Date.now();
        // 너무 자주 재시도하면 렉/네트워크 부담 → 2초 쿨다운
        if (now - (faceDetectorLastAttemptAtRef.current || 0) < 2000) return null;
        faceDetectorLastAttemptAtRef.current = now;

        const rawLoading = (async () => {
            // 1) Native FaceDetector(지원 시) 우선
            if (typeof window !== "undefined" && "FaceDetector" in window) {
                try {
                    const native = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                    return { kind: "native", detector: native };
                } catch { }
            }

            // 2) MediaPipe(tasks-vision) 폴백
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
                    // ✅ 기본 0.5는 빡세서 종종 못 잡음 → 완화
                    minDetectionConfidence: 0.5,
                });
                return { kind: "mediapipe", detector: mp };
            } catch {
                return null;
            }
        })();

        // ✅ 모델 로딩이 길어져도 drawLoop가 "잠기는" 현상 방지(타임아웃)
        const TIMEOUT_MS = 6000;
        const loading = Promise.race([
            rawLoading,
            new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
        ]);

        faceDetectorLoadingRef.current = loading;
        const result = await loading.catch(() => null);
        faceDetectorLoadingRef.current = null;

        if (result && !faceDetectorRef.current) {
            faceDetectorRef.current = result;
        }
        return result;
    }, []);

    const getFaceDetectCanvas = (videoW, videoH) => {
        // ✅ 얼굴 탐지는 다운스케일해서 가볍게(렉 방지: 256 이하로 제한)
        const MAX_W = 256;
        const vw = Number(videoW) || 0;
        const vh = Number(videoH) || 0;
        const w = vw > 0 ? Math.min(MAX_W, vw) : MAX_W;
        const h = vw > 0 && vh > 0 ? Math.max(1, Math.round(w * (vh / vw))) : 240;

        let c = faceDetectCanvasRef.current;
        if (!c) {
            c = document.createElement("canvas");
            faceDetectCanvasRef.current = c;
        }
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;

        let ctx = faceDetectCtxRef.current;
        if (!ctx) {
            ctx = c.getContext("2d", { willReadFrequently: true });
            faceDetectCtxRef.current = ctx;
        }
        return { canvas: c, ctx, detectW: w, detectH: h };
    };

    const runFaceDetectOnce = useCallback(async (videoEl, videoW, videoH) => {
        const det = faceDetectorRef.current || await ensureFaceDetector();
        if (!det) return null;

        const { canvas: c, ctx, detectW, detectH } = getFaceDetectCanvas(videoW, videoH);
        if (!ctx) return null;

        try {
            // 다운스케일 프레임 생성
            ctx.drawImage(videoEl, 0, 0, detectW, detectH);
        } catch {
            return null;
        }

        // detect 결과 bbox는 detect canvas 좌표계 → 원본(videoW/videoH)로 스케일업
        const sx = (Number(videoW) || 1) / detectW;
        const sy = (Number(videoH) || 1) / detectH;

        try {
            if (det.kind === "native") {
                const faces = await det.detector.detect(c).catch(() => null);
                const bb = faces?.[0]?.boundingBox;
                if (!bb) return null;
                const candidate = { x: bb.x * sx, y: bb.y * sy, width: bb.width * sx, height: bb.height * sy };
                return normalizeFaceBox(candidate, videoW, videoH);
            }

            if (det.kind === "mediapipe") {
                const res = det.detector.detectForVideo(c, performance.now());
                const bb = res?.detections?.[0]?.boundingBox;
                if (!bb) return null;
                const candidate = {
                    x: (bb.originX ?? bb.x ?? 0) * sx,
                    y: (bb.originY ?? bb.y ?? 0) * sy,
                    width: (bb.width ?? 0) * sx,
                    height: (bb.height ?? 0) * sy,
                };
                return normalizeFaceBox(candidate, videoW, videoH);
            }
        } catch { }

        return null;
    }, [ensureFaceDetector]);

    // 🔥 항상 canvas 파이프라인 사용 (처음부터 producer는 canvas track을 사용)
    const canvasPipelineActiveRef = useRef(false);
    const canvasPipelineRafRef = useRef(null);
    const canvasPipelineVideoElRef = useRef(null);   // 카메라 원본 재생용 hidden video
    const canvasPipelineCanvasRef = useRef(null);    // 항상 사용하는 출력 canvas
    const canvasPipelineOutTrackRef = useRef(null);  // producer에 연결된 canvas track
    const canvasPipelineRawTrackRef = useRef(null);  // 카메라 원본 track
    // 🔥 마지막 정상 프레임 저장 (검/흰 화면 대신 freeze용)
    const lastGoodFrameCanvasRef = useRef(null);
    const lastGoodFrameAtRef = useRef(0);
    const canvasPipelineVideoKickTimerRef = useRef(null); // hidden video 재생 유지용
    const canvasPipelineDrawLoopRef = useRef(null); // visibility 복귀 시 즉시 1프레임 그리기용

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

    // 🔥 서버 목록에서 잠깐 사라진 peer 보호용 (PIP 모드 전환 시 타일 깜빡임 방지)
    const missingSinceRef = useRef(new Map()); // peerId -> timestamp

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
    const faceEmojiWasOnBeforeScreenShareRef = useRef(null); // 화면공유 시작 전 이모지 필터 상태 (null: 없음, 문자열: 이모지)
    const faceModeWasOnBeforeScreenShareRef = useRef(null); // 화면공유 시작 전 필터 모드
    const bgRemoveWasOnBeforeScreenShareRef = useRef(false); // 화면공유 시작 전 배경제거 상태
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
    useEffect(() => { isFilterPreparingRef.current = isFilterPreparing; }, [isFilterPreparing]);

    // 권한 denied 시 서버에 상태 전송 → 다른 참가자에게도 마이크/카메라 off 아이콘 표시
    useEffect(() => {
        if (micPermission !== "denied" && camPermission !== "denied") return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const uid = userIdRef.current;
        if (!uid) return;
        const muted = micPermission === "denied" || !micOnRef.current;
        const cameraOff = camPermission === "denied" || !camOnRef.current;
        try {
            wsRef.current.send(JSON.stringify({
                type: "USER_STATE_CHANGE",
                userId: uid,
                changes: { muted, cameraOff },
            }));
        } catch (_) { }
    }, [micPermission, camPermission]);

    // 🔥 컴포넌트 마운트 시 저장된 필터 설정이 있으면 모델을 미리 로딩 (즉시 적용을 위해)
    useEffect(() => {
        try {
            const savedEmoji = localStorage.getItem("faceEmoji") || sessionStorage.getItem("faceEmoji");
            const savedBgRemove = localStorage.getItem("faceBgRemove") === "true" || sessionStorage.getItem("faceBgRemove") === "true";

            // 저장된 필터 설정이 있으면 모델을 미리 로딩 (cold start 방지)
            if (savedEmoji) {
                ensureFaceDetector().catch(() => { });
                console.log("[MeetingPage] Preloading FaceDetector for instant emoji");
            }
            if (savedBgRemove) {
                // 배경제거 세그멘터도 미리 로딩 (cold start 방지)
                const cur = faceBgSegmenterRef.current;
                if (!cur?.segmenter && !cur?.loading) {
                    const loading = (async () => {
                        try {
                            const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
                            const vision = await FilesetResolver.forVisionTasks(
                                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                            );
                            const segmenter = await ImageSegmenter.createFromOptions(vision, {
                                baseOptions: {
                                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
                                    delegate: "CPU",
                                },
                                runningMode: "VIDEO",
                                outputCategoryMask: true,
                            });
                            return segmenter;
                        } catch (e) {
                            console.warn("[MeetingPage] Failed to preload bg segmenter:", e);
                            return null;
                        }
                    })();
                    faceBgSegmenterRef.current = { loading };
                    loading.then((seg) => {
                        if (seg) {
                            faceBgSegmenterRef.current = { segmenter: seg };
                            console.log("[MeetingPage] Preloaded bg segmenter for instant bg removal");
                        } else {
                            faceBgSegmenterRef.current = null;
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("[MeetingPage] Failed to preload models:", e);
        }
    }, []); // 마운트 시 한 번만 실행

    // 사용자 정보 가져오기 (전역 nickname 사용 - 방별 닉네임이 있으면 그게 우선)
    const [userNickname, setUserNickname] = useState(null);

    useEffect(() => {
        // API에서 사용자 정보 가져오기
        api.get("/users/me")
            .then((res) => {
                const nickname = res.data.nickname?.trim() || "";
                const name = res.data.name?.trim() || "";

                // nickname을 우선적으로 사용하고, 없으면 name 사용
                const displayName = nickname || name || null;
                if (displayName) {
                    setUserNickname(displayName);
                    userNameRef.current = displayName;
                    // localStorage에 userName 저장
                    localStorage.setItem("userName", displayName);
                }
                if (res.data.userId) {
                    localStorage.setItem("userId", res.data.userId);
                    userIdRef.current = res.data.userId;
                }
            })
            .catch((err) => {
                console.error("사용자 정보 가져오기 실패", err);
                // 실패 시 기존 로직 사용
            });
    }, []);

    if (!userIdRef.current) {
        // ✅ 유령 유저(User-xxxx) 방지:
        // - 미팅/SFU의 peerId는 "로그인 userId"와 반드시 동일해야 함
        // - 임의 UUID + User-xxxx를 생성/저장하면 서버의 userId와 불일치하여
        //   USERS_UPDATE/consume 로직에서 '다른 참가자'로 인식되는 타일이 생길 수 있음
        const sessionId = (sessionStorage.getItem("userId") || "").trim();
        const sessionName =
            (sessionStorage.getItem("nickname") || "").trim() ||
            (sessionStorage.getItem("userName") || "").trim();

        const storedId = (localStorage.getItem("userId") || "").trim();
        const storedName = (localStorage.getItem("userName") || "").trim();

        const id = sessionId || storedId;
        const name = sessionName || storedName || "";

        if (id) {
            userIdRef.current = id;
            // 저장소 동기화(있을 때만)
            sessionStorage.setItem("userId", id);
            localStorage.setItem("userId", id);
        } else {
            // 정말로 userId가 없는 비정상 케이스에만 임시 id를 사용하되, 저장/표시명 생성은 하지 않음
            userIdRef.current = safeUUID();
        }

        if (name) {
            userNameRef.current = name;
            sessionStorage.setItem("userName", name);
            localStorage.setItem("userName", name);
        }
    }

    /* 브라우저 pip 관련 로직 */
    const mainVideoRef = useRef(null);
    const gridFullscreenVideoRef = useRef(null);
    /** 그리드 일반 모드: 참가자 id → video element (타일별 PiP용) */
    const gridTileVideoRefsRef = useRef({});
    const gridTileRefStableRef = useRef({});
    const getGridTileVideoRef = useCallback((id) => {
        const idKey = String(id);
        if (!gridTileRefStableRef.current[idKey]) {
            gridTileRefStableRef.current[idKey] = {
                get current() {
                    return gridTileVideoRefsRef.current[idKey];
                },
                set current(v) {
                    gridTileVideoRefsRef.current[idKey] = v;
                },
            };
        }
        return gridTileRefStableRef.current[idKey];
    }, []);

    const userId = userIdRef.current;
    // ✅ 방별 닉네임(roomNickname)을 최우선으로 사용
    const preferredRoomNick = (roomNickname || "").trim();
    const userName =
        (preferredRoomNick ? preferredRoomNick : null) ||
        userNickname ||
        userNameRef.current;

    const hasAudioTrack = localStream?.getAudioTracks().length > 0;
    // const hasVideoTrack = localStream?.getVideoTracks().length > 0;

    const micMuted = !hasAudioTrack || !micOn;
    const camMuted = !camOn;

    const micDisabled = micPermission !== "granted" || mutedByHostMe;
    const camDisabled = camPermission !== "granted" || cameraOffByHostMe;

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

    // 권한 거부 시 비디오 타일에 마이크 off/카메라 off 아이콘 표시용
    const userForTile = useCallback((u) => {
        if (!u) return u;
        if (!u.isMe) return u;
        return {
            ...u,
            muted: u.muted || micPermission === "denied",
            cameraOff: u.cameraOff || camPermission === "denied",
        };
    }, [micPermission, camPermission]);

    // ✅ mainStream 계산은 기존 로직(화면공유 포함)을 그대로 쓰시면 됩니다.
    // 여기서는 단순화해두었으니, 당신 원본의 mainStream 계산식으로 교체하세요.
    const mainStream =
        mainUser?.isScreenSharing && mainUser?.screenStream
            ? mainUser.screenStream
            : mainUser?.isMe
                ? localStream
                : mainUser?.stream;

    // 🔥 PiP용 mainStream ref (handleBrowserPip에서 사용)
    const mainStreamRef = useRef(null);
    useEffect(() => {
        mainStreamRef.current = mainStream;
    }, [mainStream]);

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

    // 🔥 사이드바 토글 (열기/닫기만)
    const toggleSidebarOpen = useCallback(() => {
        if (sidebarOpen) {
            setSidebarOpen(false);
        } else {
            // 닫혀있을 때는 기본적으로 채팅 뷰로 열기
            if (!sidebarView) {
                setSidebarView("chat");
            }
            setSidebarOpen(true);
        }
    }, [sidebarOpen, sidebarView]);

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

    // ============================================
    // 👑 방장 권한 기능 핸들러
    // ============================================

    const showToastMsg = useCallback((msg) => {
        if (!msg) return;
        setToastMessage(String(msg));
        setShowToast(true);
    }, []);

    // 현재 사용자가 방장인지 확인
    const amIHost = useMemo(() => {
        const me = participants.find(p => p.isMe);
        return me?.isHost ?? false;
    }, [participants]);

    // 마이크 강제 끄기
    const handleForceMute = useCallback((targetUserId) => {
        if (!amIHost) return showToastMsg("방장만 사용할 수 있습니다.");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return showToastMsg("서버 연결이 아직 준비되지 않았습니다.");

        // UI 즉시 반영 (낙관적 업데이트)
        setParticipants((prev) =>
            prev.map((p) => (String(p.id) === String(targetUserId) ? { ...p, muted: true, mutedByHost: true } : p))
        );

        wsRef.current.send(JSON.stringify({
            type: "FORCE_MUTE",
            targetUserId
        }));
        setHostMenuTargetId(null);
    }, [amIHost, showToastMsg]);

    // 카메라 강제 끄기
    const handleForceCameraOff = useCallback((targetUserId) => {
        if (!amIHost) return showToastMsg("방장만 사용할 수 있습니다.");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return showToastMsg("서버 연결이 아직 준비되지 않았습니다.");

        // UI 즉시 반영 (낙관적 업데이트)
        setParticipants((prev) =>
            prev.map((p) => (String(p.id) === String(targetUserId) ? { ...p, cameraOff: true, cameraOffByHost: true } : p))
        );

        wsRef.current.send(JSON.stringify({
            type: "FORCE_CAMERA_OFF",
            targetUserId
        }));
        setHostMenuTargetId(null);
    }, [amIHost, showToastMsg]);

    // 마이크 강제 켜기 (방장이 허용)
    const handleForceUnmute = useCallback((targetUserId) => {
        if (!amIHost) return showToastMsg("방장만 사용할 수 있습니다.");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return showToastMsg("서버 연결이 아직 준비되지 않았습니다.");

        setParticipants((prev) =>
            prev.map((p) => (String(p.id) === String(targetUserId) ? { ...p, muted: false, mutedByHost: false } : p))
        );

        wsRef.current.send(JSON.stringify({
            type: "FORCE_UNMUTE",
            targetUserId
        }));
        setHostMenuTargetId(null);
    }, [amIHost, showToastMsg]);

    // 카메라 강제 켜기 (방장이 허용)
    const handleForceCameraOn = useCallback((targetUserId) => {
        if (!amIHost) return showToastMsg("방장만 사용할 수 있습니다.");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return showToastMsg("서버 연결이 아직 준비되지 않았습니다.");

        setParticipants((prev) =>
            prev.map((p) => (String(p.id) === String(targetUserId) ? { ...p, cameraOff: false, cameraOffByHost: false } : p))
        );

        wsRef.current.send(JSON.stringify({
            type: "FORCE_CAMERA_ON",
            targetUserId
        }));
        setHostMenuTargetId(null);
    }, [amIHost, showToastMsg]);

    // 강퇴
    const handleKick = useCallback((targetUserId) => {
        if (!amIHost) return showToastMsg("방장만 사용할 수 있습니다.");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return showToastMsg("서버 연결이 아직 준비되지 않았습니다.");
        const ok = window.confirm("정말 내보내시겠습니까?");
        if (!ok) return;

        // UI 즉시 반영 (낙관적 업데이트)
        setParticipants((prev) => prev.filter((p) => String(p.id) !== String(targetUserId)));

        wsRef.current.send(JSON.stringify({
            type: "KICK",
            targetUserId
        }));
        setHostMenuTargetId(null);
    }, [amIHost, showToastMsg]);

    // 드롭다운 메뉴 토글
    const toggleHostMenu = useCallback((targetId) => {
        setHostMenuTargetId(prev => prev === targetId ? null : targetId);
    }, []);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!hostMenuTargetId) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.host-menu-dropdown') && !e.target.closest('.more-btn')) {
                setHostMenuTargetId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [hostMenuTargetId]);

    const turnOffCamera = async () => {
        // 1) Canvas 파이프라인 정리
        canvasPipelineActiveRef.current = false;
        if (canvasPipelineRafRef.current) {
            clearTimeout(canvasPipelineRafRef.current);
            canvasPipelineRafRef.current = null;
        }
        if (canvasPipelineVideoElRef.current) {
            try { canvasPipelineVideoElRef.current.pause(); } catch { }
            try { canvasPipelineVideoElRef.current.srcObject = null; } catch { }
            try { canvasPipelineVideoElRef.current.remove(); } catch { }
            canvasPipelineVideoElRef.current = null;
        }
        // 🔥 hidden video 재생 유지 타이머 정리
        if (canvasPipelineVideoKickTimerRef.current) {
            try {
                document.removeEventListener("visibilitychange", canvasPipelineVideoKickTimerRef.current.kickVideo);
            } catch { }
            try {
                clearInterval(canvasPipelineVideoKickTimerRef.current.kickTimer);
            } catch { }
            canvasPipelineVideoKickTimerRef.current = null;
        }
        try { canvasPipelineOutTrackRef.current?.stop?.(); } catch { }
        canvasPipelineOutTrackRef.current = null;
        try { canvasPipelineRawTrackRef.current?.stop?.(); } catch { }
        canvasPipelineRawTrackRef.current = null;
        canvasPipelineCanvasRef.current = null;
        lastGoodFrameCanvasRef.current = null;

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

        // ✅ 통화 종료 중이면 새 스트림 생성/상태 업데이트를 건너뜀
        // (handleHangup이 이후에 전체 정리하므로, 여기서 setLocalStream하면 race condition 발생)
        if (isLeavingRef.current) {
            console.log("[turnOffCamera] isLeaving=true, skipping setLocalStream");
            return;
        }

        const audioOnly = new MediaStream([...prevAudio]);
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);

        setCamOn(false);
        localStorage.setItem("camOn", "false");

        // ⭐ 서버에 상태 전파
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "USER_STATE_CHANGE",
                userId,
                changes: { cameraOff: true },
            }));
        }

        console.log("[turnOffCamera] camera and canvas pipeline stopped");
    };

    const turnOnCamera = async () => {
        // 🔥 sendTransport 체크를 producer 생성 부분으로 이동
        // canvas 파이프라인은 먼저 시작하여 이모지가 바로 적용되게 함

        // 🔥 [최적화 1] 카메라 요청과 동시에 모델 로딩 시작 (병렬 처리)
        const wantEmoji = !!faceEmojiRef.current && faceModeRef.current === "emoji";
        const wantBgRemove = !!bgRemoveRef.current;
        const needFiltersOnStart = wantEmoji || wantBgRemove;

        // 필터가 필요하면 모델 로딩 시작 (스피너 없이 바로 비디오 표시)
        if (needFiltersOnStart) {
            console.log("[turnOnCamera] Filter settings detected, loading models in background");
        }

        // await로 기다리지 않고 프로미스만 트리거해둡니다 (병렬 처리)
        if (wantEmoji) ensureFaceDetector().catch(() => { });

        // 🔥 핵심: 이미 canvas pipeline이 활성화되어 있고 track이 살아있으면 재사용
        // (이모지/배경제거 변경 시 track 교체 방지 → PiP 안정성 보장)
        const existingOutTrack = canvasPipelineOutTrackRef.current;
        const existingProducer = producersRef.current.get("camera");
        if (
            canvasPipelineActiveRef.current &&
            existingOutTrack?.readyState === "live" &&
            existingProducer &&
            !existingProducer.closed
        ) {
            console.log("[turnOnCamera] pipeline already active, reusing existing track/producer");
            setCamOn(true);
            localStorage.setItem("camOn", "true");
            return;
        }

        // 1) 카메라 트랙 획득 (오디오도 함께 - 이전 스트림이 없을 경우 대비)
        let stream;
        const needAudio = !localStreamRef.current?.getAudioTracks().some(t => t.readyState === "live");
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
                audio: needAudio
            });
        } catch (err) {
            console.error("Camera permission denied or error", err);
            return;
        }
        const rawTrack = stream.getVideoTracks()[0];
        const newAudioTrack = stream.getAudioTracks()[0];
        console.log("[turnOnCamera] got camera track:", rawTrack.id, rawTrack.readyState, "audio:", needAudio ? newAudioTrack?.id : "reusing");
        if (isLikelyCameraTrack(rawTrack)) lastCameraTrackRef.current = rawTrack;
        canvasPipelineRawTrackRef.current = rawTrack;

        // 2) 기존 canvas 파이프라인 정리
        if (canvasPipelineRafRef.current) {
            clearTimeout(canvasPipelineRafRef.current);
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
        // 렌더링 최적화를 위해 완전 투명보다는 1px 크기로라도 존재하게 함
        v.style.cssText = "position:fixed; bottom:0; right:0; width:640px; height:480px; opacity:0.01; pointer-events:none; z-index:-999;";
        document.body.appendChild(v);
        canvasPipelineVideoElRef.current = v;
        v.srcObject = new MediaStream([rawTrack]);
        // 🔥 v.play()를 await하지 않고 즉시 다음 단계로 진행 (비동기로 처리)
        v.play().catch(() => { }); // 에러 무시하고 계속 진행

        // 🔥 hidden video 재생 유지 (PIP/라우트 전환 시 paused 방지)
        const kickVideo = () => {
            try {
                if (v && v.srcObject && v.paused) {
                    v.play().catch(() => { });
                }
            } catch { }
        };
        document.addEventListener("visibilitychange", kickVideo);
        const kickTimer = setInterval(kickVideo, 500);
        canvasPipelineVideoKickTimerRef.current = { kickVideo, kickTimer };

        // 🔥 메타데이터 로드 대기 완전 제거 - drawLoop에서 처리하므로 즉시 시작
        const videoW = 1280;
        const videoH = 720;

        // 4) Canvas 생성 (항상 사용)
        const canvas = document.createElement("canvas");
        canvas.width = videoW;
        canvas.height = videoH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasPipelineCanvasRef.current = canvas;

        // 🔥 마지막 정상 프레임 저장용 canvas 준비
        const lastCanvas = document.createElement("canvas");
        lastCanvas.width = canvas.width;
        lastCanvas.height = canvas.height;
        lastGoodFrameCanvasRef.current = lastCanvas;

        // 5) Canvas에서 track 캡처 (부드러운 화면을 위해 60fps)
        const outStream = canvas.captureStream(60);
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

        // 7) ✅ FaceDetector는 drawLoop에서 필요할 때만 ensureFaceDetector()로 로딩(초기/자동복원 멈춤 방지)

        // 🔥 상태를 즉시 업데이트하여 UI가 바로 반응하도록
        setCamOn(true);
        localStorage.setItem("camOn", "true");

        // 8) 로컬 스트림 설정 (drawLoop 시작 전에 설정하여 즉시 표시)
        // 이전 오디오 트랙이 있으면 사용, 없으면 새로 가져온 트랙 사용
        const prevAudio = localStreamRef.current
            ?.getAudioTracks()
            .filter((t) => t.readyState === "live") ?? [];
        const audioTracks = prevAudio.length > 0 ? prevAudio : (newAudioTrack ? [newAudioTrack] : []);
        // 오디오 트랙 enabled 상태 설정
        audioTracks.forEach(t => { t.enabled = !!micOnRef.current; });
        const merged = new MediaStream([...audioTracks, outTrack]);
        localStreamRef.current = merged;
        setLocalStream(merged);
        bumpStreamVersion();

        // 🔥 권한 설정 (startLocalMedia와 동일하게)
        setMicPermission("granted");
        setCamPermission("granted");
        setIsLocalLoading(false);

        // 🔥 필터가 필요하면 스피너를 보여주기 위해 먼저 producer 생성
        // (스피너가 모든 사람에게 보이도록 하기 위해 producer를 먼저 생성)
        // await를 사용하여 producer가 생성된 후에 스피너를 그리고 drawLoop 시작
        let producerCreated = false;
        let producerCreating = false;
        // 9) Draw 루프 시작 (producer는 drawLoop 내에서 생성됨)
        // 🔥 WebSocket으로 filterPreparing 상태를 동기화하므로 canvas 스피너 불필요

        canvasPipelineActiveRef.current = true;
        hasEverDrawnEmojiRef.current = false;  // 🔥 카메라 켤 때 한 번만 검은화면
        emojiBlackScreenStartedAtRef.current = 0;
        emojiBlackScreenToastShownRef.current = false;
        let frameCount = 0;

        // 🔥 배경 제거용 캔버스 및 세그멘터 초기화
        let bgFrameCanvas = null;
        let bgFrameCtx = null;

        // ✅ 세그멘테이션 입력은 다운스케일(원본 해상도 그대로 넣으면 CPU 급증/멈춤 유발)
        let bgSegInputCanvas = null;
        let bgSegInputCtx = null;
        const getBgSegInput = (videoW, videoH) => {
            const MAX_W = 256;
            const vw = Number(videoW) || 0;
            const vh = Number(videoH) || 0;
            const w = vw > 0 ? Math.min(MAX_W, vw) : MAX_W;
            const h = vw > 0 && vh > 0 ? Math.max(1, Math.round(w * (vh / vw))) : 144;

            if (!bgSegInputCanvas) bgSegInputCanvas = document.createElement("canvas");
            if (bgSegInputCanvas.width !== w) bgSegInputCanvas.width = w;
            if (bgSegInputCanvas.height !== h) bgSegInputCanvas.height = h;
            if (!bgSegInputCtx) bgSegInputCtx = bgSegInputCanvas.getContext("2d", { willReadFrequently: true });
            return { canvas: bgSegInputCanvas, ctx: bgSegInputCtx, w, h };
        };

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

        // 🔥 핵심: setTimeout 사용 (requestAnimationFrame은 탭이 백그라운드로 가면 멈춤)
        // 탭이 백그라운드여도 canvas에 계속 프레임을 그려야 PiP가 검은화면이 안됨
        // ✅ 필터가 켜져있을 때는 15fps로 낮춰서 렉/멈춤 방지
        const BASE_INTERVAL = 16;  // ~60fps
        const FILTER_INTERVAL = 66; // ~15fps

        const drawLoop = async () => {
            if (!canvasPipelineActiveRef.current) return;

            const isHidden = document.hidden;
            const isBgRemoveOn = !!bgRemoveRef.current;
            const isEmojiOn = !!faceEmojiRef.current && faceModeRef.current === "emoji";
            const warmupDone = Date.now() > (pipelineWarmupUntilRef.current || 0);

            // 백그라운드에서는 얼굴 감지/배경제거 추론 생략 → CPU 절약, 복귀 시 렉 방지
            if (!isHidden) {
                // ==========================================================
                // 1. 얼굴 감지 실행 (비동기) - 🔥 렉 방지: 80ms 주기
                // ==========================================================
                try {
                    if (isEmojiOn) {
                        if (!faceDetectorRef.current) ensureFaceDetector().catch(() => { });

                        const nowMs = Date.now();
                        if (faceDetectorRef.current && nowMs - lastDetectAtRef.current > 80) {
                            lastDetectAtRef.current = nowMs;
                            if (!faceDetectInFlightRef.current) {
                                faceDetectInFlightRef.current = true;
                                faceDetectSeqRef.current++;
                                const currentSeq = faceDetectSeqRef.current;
                                const vw = v.videoWidth || canvas.width;
                                const vh = v.videoHeight || canvas.height;

                                runFaceDetectOnce(v, vw, vh)
                                    .then(normalized => {
                                        if (currentSeq !== faceDetectSeqRef.current) return;
                                        if (normalized) {
                                            lastFaceBoxRef.current = normalized;
                                            lastFaceBoxAtRef.current = Date.now();
                                        } else {
                                            // 얼굴 잃어버림: 1초 정도는 기존 위치 유지 (깜빡임 방지)
                                            if (Date.now() - (lastFaceBoxAtRef.current || 0) > 1000) {
                                                lastFaceBoxRef.current = null;
                                            }
                                        }
                                    })
                                    .finally(() => {
                                        if (currentSeq === faceDetectSeqRef.current) faceDetectInFlightRef.current = false;
                                    });
                            }
                        }
                    }
                } catch { }

                // ==========================================================
                // 2. 배경 제거 추론 (비동기) - 백그라운드에서는 스킵
                // ==========================================================
                if (isBgRemoveOn) ensureBgSegmenterForPipeline();
            }

            // ==========================================================
            // 🎨 그리기 단계 (Safe Rendering)
            // ==========================================================

            // 비디오 준비 상태 확인 - 동적 크기 업데이트
            const videoReady = v && v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2;
            if (videoReady) {
                // 비디오 크기가 변경되었으면 캔버스 크기 업데이트
                const currentW = v.videoWidth;
                const currentH = v.videoHeight;
                if (canvas.width !== currentW || canvas.height !== currentH) {
                    canvas.width = currentW;
                    canvas.height = currentH;
                    // 🔥 lastGood도 사이즈 동기화
                    if (lastGoodFrameCanvasRef.current) {
                        lastGoodFrameCanvasRef.current.width = currentW;
                        lastGoodFrameCanvasRef.current.height = currentH;
                    }
                }
            } else {
                // 🔥 비디오가 준비되지 않았으면 마지막 정상 프레임 사용 (검은 화면 대신 freeze)
                const last = lastGoodFrameCanvasRef.current;
                if (last && lastGoodFrameAtRef.current > 0) {
                    try {
                        ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
                    } catch {
                        // 복사 실패 시 검은 화면
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                } else {
                    // 마지막 프레임이 없으면 검은 화면
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                const isHidden = document.hidden;
                const nextInterval = isHidden ? 200 : (isEmojiOn || isBgRemoveOn) ? 66 : 33;
                canvasPipelineRafRef.current = setTimeout(drawLoop, nextInterval);
                return;
            }

            // 🔥 필터 준비 중에도 원본 비디오를 canvas에 그려서 다른 참가자에게 전송
            // WebSocket으로 filterPreparing 상태를 동기화하므로 VideoTile 오버레이로 스피너 표시
            {
                // 필터 준비 상태 확인 (렌더링용)
                const isEmojiReady = !isEmojiOn || (isEmojiOn && !!lastFaceBoxRef.current);
                const isBgReady = !isBgRemoveOn || (isBgRemoveOn && !!faceBgSegmenterRef.current?.segmenter);

                // 🖌️ 렌더링 시작 - 필터가 준비되면 정상 렌더링
                // A. 배경 제거 (준비되었을 때만, 백그라운드에서는 스킵해 CPU 절약)
                if (isBgRemoveOn && isBgReady && !isHidden) {
                    if (!bgFrameCanvas) {
                        bgFrameCanvas = document.createElement("canvas");
                        bgFrameCanvas.width = canvas.width;
                        bgFrameCanvas.height = canvas.height;
                        bgFrameCtx = bgFrameCanvas.getContext("2d");
                    }
                    // 1) 비디오 -> 임시 캔버스
                    bgFrameCtx.drawImage(v, 0, 0, bgFrameCanvas.width, bgFrameCanvas.height);

                    // 2) 추론 & 마스크
                    const seg = faceBgSegmenterRef.current?.segmenter;
                    const nowMs = performance.now();
                    if (seg && nowMs - faceBgLastInferAtRef.current > 100) { // Throttle
                        faceBgLastInferAtRef.current = nowMs;
                        try {
                            const vw = v.videoWidth || canvas.width;
                            const vh = v.videoHeight || canvas.height;
                            const segInput = getBgSegInput(vw, vh);
                            segInput.ctx.drawImage(v, 0, 0, segInput.w, segInput.h);
                            const res = seg.segmentForVideo(segInput.canvas, nowMs);
                            const mask = res?.categoryMask;
                            if (mask) {
                                const maskW = mask.width;
                                const maskH = mask.height;
                                const dataU8 = mask.getAsUint8Array();
                                let maskCanvas = faceBgMaskCanvasRef.current;
                                if (!maskCanvas) {
                                    maskCanvas = document.createElement("canvas");
                                    faceBgMaskCanvasRef.current = maskCanvas;
                                }
                                maskCanvas.width = maskW;
                                maskCanvas.height = maskH;
                                const mctx = maskCanvas.getContext("2d");
                                const img = mctx.createImageData(maskW, maskH);
                                for (let i = 0; i < maskW * maskH; i++) {
                                    const isPerson = dataU8[i] === 0; // 0: person
                                    const o = i * 4;
                                    img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255;
                                    img.data[o + 3] = isPerson ? 255 : 0;
                                }
                                mctx.putImageData(img, 0, 0);
                            }
                        } catch { }
                    }

                    // 3) 마스크 합성
                    if (faceBgMaskCanvasRef.current) {
                        bgFrameCtx.globalCompositeOperation = "destination-in";
                        bgFrameCtx.drawImage(faceBgMaskCanvasRef.current, 0, 0, bgFrameCanvas.width, bgFrameCanvas.height);
                        bgFrameCtx.globalCompositeOperation = "source-over";

                        // 최종: 흰 배경 + 사람
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(bgFrameCanvas, 0, 0, canvas.width, canvas.height);
                    } else {
                        // 배경제거가 켜져있지만 세그멘터가 아직 준비 안됨
                        // 🔥 이모지 모드: 카메라 켤 때 한 번만 검은화면, 이후에는 원본 비디오(움직임 유지)
                        if (isEmojiOn) {
                            if (!hasEverDrawnEmojiRef.current) {
                                if (!emojiBlackScreenStartedAtRef.current) emojiBlackScreenStartedAtRef.current = Date.now();
                                if (Date.now() - emojiBlackScreenStartedAtRef.current >= 3000 && !emojiBlackScreenToastShownRef.current) {
                                    emojiBlackScreenToastShownRef.current = true;
                                    setToastMessage("얼굴이 보이게 해주세요.");
                                    setShowToast(true);
                                }
                                ctx.fillStyle = "#000000";
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            } else {
                                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                            }
                        } else {
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        }
                    }
                } else {
                    // B. 일반 비디오 (배경제거 X)
                    // 🔥 이모지 모드 + 얼굴 미감지: 카메라 켤 때 한 번만 검은화면, 이후에는 원본 비디오(움직임 유지)
                    if (isEmojiOn && !lastFaceBoxRef.current) {
                        if (!hasEverDrawnEmojiRef.current) {
                            if (!emojiBlackScreenStartedAtRef.current) emojiBlackScreenStartedAtRef.current = Date.now();
                            if (Date.now() - emojiBlackScreenStartedAtRef.current >= 3000 && !emojiBlackScreenToastShownRef.current) {
                                emojiBlackScreenToastShownRef.current = true;
                                setToastMessage("얼굴이 보이게 해주세요.");
                                setShowToast(true);
                            }
                            ctx.fillStyle = "#000000";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        } else {
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        }
                    } else {
                        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    }
                }

                // C. 이모지 그리기 (얼굴이 감지되었을 때만)
                if (isEmojiOn && lastFaceBoxRef.current) {
                    const box = normalizeFaceBox(lastFaceBoxRef.current, v.videoWidth, v.videoHeight);
                    if (box) {
                        const scaleX = canvas.width / (v.videoWidth || canvas.width);
                        const scaleY = canvas.height / (v.videoHeight || canvas.height);
                        // 🔥 최대 크기 제한 추가 (화면의 50% 이하)
                        const maxSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.5);
                        const rawSize = Math.max(box.width * scaleX, box.height * scaleY) * 2.5;
                        const size = Math.max(120, Math.min(maxSize, rawSize));
                        const x = (box.x + box.width / 2) * scaleX;
                        const y = (box.y + box.height / 2) * scaleY - (size * 0.1);

                        // 부드러운 이동 (Smoothing) - 🔥 새로고침 시 바로 따라오도록 개선
                        const prev = smoothedFaceBoxRef.current;
                        const curr = { x, y, size };
                        // 🔥 새로고침 직후(처음 몇 프레임) 또는 얼굴이 새로 감지된 경우 즉시 따라오게 함
                        const isNewDetection = !prev ||
                            frameCount <= 10 ||
                            (lastFaceBoxAtRef.current && Date.now() - lastFaceBoxAtRef.current < 300);
                        const factor = isNewDetection ? 1.0 : 0.9; // 새 감지 시 즉시 이동, 이후 부드럽게
                        const smoothed = prev && !isNewDetection ? {
                            x: prev.x + (curr.x - prev.x) * factor,
                            y: prev.y + (curr.y - prev.y) * factor,
                            size: prev.size + (curr.size - prev.size) * factor
                        } : curr;
                        smoothedFaceBoxRef.current = smoothed;

                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.font = `${smoothed.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
                        ctx.fillText(faceEmojiRef.current, smoothed.x, smoothed.y);
                        hasEverDrawnEmojiRef.current = true;  // 🔥 이모지 한 번이라도 그렸으면 이후 얼굴 미감지 시 원본 비디오 표시
                        emojiBlackScreenStartedAtRef.current = 0;
                        emojiBlackScreenToastShownRef.current = false;
                    }
                }
            } // end of video rendering block

            frameCount++;

            // 🔥 Producer 생성 (최초 1회) - 비디오가 준비되었을 때 생성
            if (!producerCreated && !producerCreating && videoReady) {
                producerCreating = true;
                try {
                    const transport = sendTransportRef.current;
                    if (transport && !transport.closed) {
                        const newProducer = await transport.produce({
                            track: outTrack,
                            encodings: [{ maxBitrate: 2500000, scaleResolutionDownBy: 1.0 }], // 2.5Mbps 제한 (60fps 대응)
                            appData: { type: "camera" },
                        });
                        producersRef.current.set("camera", newProducer);
                        producerCreated = true;
                        producerCreating = false;
                        console.log("[turnOnCamera] producer created (frame:", frameCount, ")");
                    } else {
                        producerCreating = false;
                    }
                } catch (e) {
                    console.error("[turnOnCamera] producer creation failed:", e);
                    producerCreating = false;
                }
            }

            // ✅ 마지막 정상 프레임 저장 (검/흰 화면 대신 freeze용)
            // 🔥 이모지 ON + 얼굴 미감지 시 검은화면을 그렸으면 저장하지 않음 (이전 이모지 프레임 유지)
            const drewBlackForEmoji = isEmojiOn && !lastFaceBoxRef.current;
            try {
                const last = lastGoodFrameCanvasRef.current;
                if (last && canvas && !drewBlackForEmoji) {
                    const lctx = last.getContext("2d");
                    if (lctx) {
                        lctx.drawImage(canvas, 0, 0, last.width, last.height);
                        lastGoodFrameAtRef.current = Date.now();
                    }
                }
            } catch { }

            // 다음 프레임: 백그라운드 200ms(CPU 절약), 포그라운드 필터 66ms(~15fps), 무필터 33ms
            const nextInterval = isHidden ? 200 : (isEmojiOn || isBgRemoveOn) ? 66 : 33;
            canvasPipelineRafRef.current = setTimeout(drawLoop, nextInterval);
        };

        canvasPipelineDrawLoopRef.current = drawLoop;
        // Draw 루프 즉시 시작 (비동기로 실행하여 블로킹 방지)
        drawLoop();

        // ⭐ 서버에 상태 전파 (비동기로 처리하여 블로킹 방지)
        // setTimeout으로 비동기 처리하여 카메라 켜기 지연 방지
        setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId,
                    changes: { cameraOff: false },
                }));
            }
        }, 0);

        console.log("[turnOnCamera] canvas pipeline started immediately, emoji mode:", faceModeRef.current, "emoji:", faceEmojiRef.current);
    };

    // ✅ 전체화면 상태 감지(원본 유지). 그리드 전체화면에서 Esc로 나올 때도 그리드 복원
    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreenEl = document.fullscreenElement;
            setIsFullscreen(!!fullscreenEl);
            if (fullscreenEl) {
                document.body.classList.add("fullscreen-active");
            } else {
                document.body.classList.remove("fullscreen-active");
                // 그리드 전체화면에서 브라우저로 나가면(Esc 등) 그리드 타일이 다시 보이도록
                setIsGridFullscreen(false);
            }
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!chatDraft.trim()) return;

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "CHAT",
                    message: chatDraft,
                })
            );
        }

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
        // ✅ 통화종료 확인 모달에서 확인 시에만 호출됨
        isLeavingRef.current = true;
        // ✅ 통화 종료는 PiP 유지가 목적이 아니므로, pip 세션 키 제거 (cleanup 스킵 방지)
        try { sessionStorage.removeItem("pip.roomId"); } catch { }
        try { sessionStorage.removeItem("pip.subjectId"); } catch { }

        // ✅ 0) 상태 전파 (카메라/마이크 끄기)
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: "USER_STATE_CHANGE",
                    userId,
                    changes: { cameraOff: true, muted: true },
                }));
            }
        } catch { }

        // ✅ 0-1) 프로듀서 즉시 끊기 → 상대 화면에서 내 타일/스트림 즉시 제거
        try {
            producersRef.current.forEach((p) => {
                try { p.close(); } catch { }
                if (p.appData?.type) safeSfuSend({ action: "closeProducer", data: { producerId: p.id } });
            });
            producersRef.current.clear();
        } catch { }

        // ✅ 1) LEAVE 전송 (2회 전송으로 확실히 유도)
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const leaveMsg = JSON.stringify({ type: "LEAVE" });
                wsRef.current.send(leaveMsg);
                setTimeout(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        try { wsRef.current.send(leaveMsg); } catch { }
                    }
                }, 50);
            }
        } catch { }

        // ✅ 2) SFU leave 전송
        try {
            safeSfuSend({
                action: "leave",
                requestId: safeUUID(),
                data: { roomId, peerId: userId },
            });
        } catch { }

        // ✅ 3) 500ms 후 전체 정리 및 페이지 이동
        // (alert 이전에 정리 루프를 시작하지만, UI 블로킹 방지를 위해 setTimeout 사용)
        setTimeout(() => {
            try {
                // ✅ 카메라/필터 파이프라인 포함 전체 카메라 정리 (hidden video + rawTrack stop 포함)
                // turnOffCamera 내부에서 canvasPipelineVideoElRef / kickTimer / rawTrack 까지 정리함
                try { turnOffCamera(); } catch { }

                // 얼굴 필터 정리
                stopFaceEmojiFilter().catch(() => { });
                stopAvatarFilter().catch(() => { });

                // SFU 트랜스포트/프로듀서 강제 종료
                try {
                    producersRef.current.forEach(p => p.close());
                    producersRef.current.clear();
                    sendTransportRef.current?.close();
                    recvTransportRef.current?.close();
                } catch { }

                // 로컬 미디어 정리
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                    localStreamRef.current = null;
                }
                // 화면공유 스트림 정리(남아있으면 브라우저가 계속 캡처/사용중으로 표시될 수 있음)
                if (screenStreamRef.current) {
                    try {
                        screenStreamRef.current.getTracks().forEach((t) => {
                            try { t.stop(); } catch { }
                        });
                    } catch { }
                    screenStreamRef.current = null;
                }

                // ✅ 추가 안전장치: 필터/파이프라인 전환 중 localStream에 안 들어간 "원본 카메라 트랙"까지 stop
                // - face/emoji 필터는 rawTrack을 localStream에서 분리한 채(outTrack만) 유지할 수 있음
                // - 이 rawTrack이 남아있으면 브라우저가 카메라 사용중(빨간원)으로 표시됨
                try {
                    const extraTracks = [
                        lastCameraTrackRef?.current,
                        faceFilterRawTrackRef?.current,
                        faceFilterOutTrackRef?.current,
                        avatarRawTrackRef?.current,
                        avatarOutTrackRef?.current,
                        canvasPipelineRawTrackRef?.current,
                        canvasPipelineOutTrackRef?.current,
                    ].filter(Boolean);
                    extraTracks.forEach((t) => {
                        try {
                            if (t.readyState === "live") t.stop();
                        } catch { }
                    });
                } catch { }
                try { lastCameraTrackRef.current = null; } catch { }
                try { faceFilterRawTrackRef.current = null; } catch { }
                try { faceFilterOutTrackRef.current = null; } catch { }
                try { avatarRawTrackRef.current = null; } catch { }
                try { avatarOutTrackRef.current = null; } catch { }
                try { canvasPipelineOutTrackRef.current = null; } catch { }

                // ✅ 남아있는 video/audio 엘리먼트의 srcObject 해제 (hidden element가 stream을 잡고 있는 경우 방지)
                try {
                    document.querySelectorAll("video").forEach((v) => {
                        try {
                            if (v?.srcObject) v.srcObject = null;
                        } catch { }
                    });
                    document.querySelectorAll("audio").forEach((a) => {
                        try {
                            if (a?.srcObject) a.srcObject = null;
                        } catch { }
                    });
                } catch { }
                setLocalStream(null);

                // ✅ audioElsRef 정리 (new Audio()로 생성된 요소는 DOM에 없어 querySelectorAll로 못 잡음)
                try {
                    audioElsRef.current.forEach((a) => {
                        try { a.pause(); } catch { }
                        try { a.srcObject = null; } catch { }
                    });
                    audioElsRef.current.clear();
                } catch { }

                // ✅ 공유 AudioContext 닫기 + 잠금 (비동기 코드가 재생성 못하게)
                closeSharedAudioContext();

                // WebSocket 정리 (충분한 시간 경과 후)
                try { wsRef.current?.close(); } catch { }
                wsRef.current = null;

                try { sfuWsRef.current?.close(); } catch { }
                sfuWsRef.current = null;

                // 상태 초기화
                setParticipants([]);
                setMessages([]);
                if (endMeeting) endMeeting();

                // ✅ 최종 안전장치: 혹시 남아있는 모든 live 트랙 강제 종료
                // (비동기 race condition으로 놓친 트랙까지 커버)
                try {
                    const allRefs = [
                        localStreamRef, screenStreamRef,
                        lastCameraTrackRef, faceFilterRawTrackRef, faceFilterOutTrackRef,
                        avatarRawTrackRef, avatarOutTrackRef,
                        canvasPipelineRawTrackRef, canvasPipelineOutTrackRef,
                    ];
                    allRefs.forEach((ref) => {
                        try {
                            const val = ref?.current;
                            if (!val) return;
                            // MediaStream인 경우 (getTracks 있음)
                            if (typeof val.getTracks === "function") {
                                val.getTracks().forEach((t) => { try { if (t.readyState === "live") t.stop(); } catch { } });
                            }
                            // MediaStreamTrack인 경우 (stop 있음, getTracks 없음)
                            else if (typeof val.stop === "function" && val.readyState === "live") {
                                val.stop();
                            }
                        } catch { }
                    });
                } catch { }

                // ✅ AudioContext 한번 더 확인 (endMeeting 이후 혹시 재생성된 경우)
                closeSharedAudioContext();

                // 페이지 이동
                if (subjectId) {
                    navigate(`/lms/${subjectId}/dashboard`, { replace: true });
                } else {
                    navigate("/lmsMain", { replace: true });
                }
            } catch (e) {
                console.warn("[handleHangup] Cleanup failed:", e);
                // 강제 이동
                navigate("/lmsMain", { replace: true });
            }
        }, 400);

        // alert은 사용자에게 알림을 주는 용도로만 사용 (가장 마지막에 띄우거나 생략 가능)
        // 여기서는 기존 alert 유지를 위해 배치
        // alert("채팅이 종료되었습니다.");
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
            // ✅ 이모지/모드는 localStorage에 저장(다음 접속에도 유지)
            if (faceEmoji) localStorage.setItem("faceEmoji", faceEmoji);
            else localStorage.removeItem("faceEmoji");

            if (faceMode) localStorage.setItem("faceMode", faceMode);
            else localStorage.removeItem("faceMode");

            // ✅ 배경제거도 localStorage에 저장(다음 접속에도 유지)
            if (bgRemove) localStorage.setItem("faceBgRemove", String(bgRemove));
            else localStorage.removeItem("faceBgRemove");
            // 기존 sessionStorage와의 호환성을 위해 sessionStorage에도 저장
            sessionStorage.setItem("faceBgRemove", String(bgRemove));

            // ✅ 서버에도 배경제거/이모지 상태 동기화 (다른 참가자 목록·복원용)
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: {
                            faceEmoji: faceEmoji || null,
                            bgRemove: !!bgRemove,
                        },
                    }));
                }
            } catch { }
        } catch { }
    }, [faceEmoji, faceMode, bgRemove]);

    // 🔥 F5 새로고침 후 저장된 마이크/카메라/이모지/배경제거 상태 자동 복원
    const hasMountedRef = useRef(false);
    useEffect(() => {
        if (hasMountedRef.current) return;
        hasMountedRef.current = true;

        // 저장된 마이크/카메라 상태 확인
        const savedMicOn = micOnRef.current;
        const savedCamOn = camOnRef.current;

        // 저장된 이모지 또는 배경제거 상태가 있으면 자동 적용
        const savedEmoji = faceEmojiRef.current;
        const savedBgRemove = bgRemoveRef.current;

        // 마이크나 카메라가 켜져있었거나, 이모지/배경제거가 활성화되어 있었으면 복원
        if (savedMicOn || savedCamOn || savedEmoji || savedBgRemove) {
            // 🔥 빠른 canvas 파이프라인 시작 - sendTransport 준비되면 바로 시작
            const checkAndApply = async () => {
                // sendTransport가 준비될 때까지 대기 (최대 10초, 50ms 간격으로 빠르게 체크)
                let waited = 0;
                while ((!sendTransportRef.current || sendTransportRef.current.closed) && waited < 10000) {
                    await new Promise(r => setTimeout(r, 50));
                    waited += 50;
                }

                // sendTransport가 준비되면 상태 복원
                if (sendTransportRef.current && !sendTransportRef.current.closed) {
                    console.log("[Auto-restore] sendTransport ready, restoring saved state:", {
                        savedMicOn,
                        savedCamOn,
                        savedEmoji,
                        savedBgRemove,
                        waited
                    });

                    try {
                        // 카메라가 켜져있었을 때만 카메라 켜기 (이모지/배경제거가 있어도 카메라가 꺼져있었으면 켜지 않음)
                        if (savedCamOn) {
                            if (!canvasPipelineActiveRef.current) {
                                pipelineWarmupUntilRef.current = Date.now() + 1000;
                                await turnOnCamera();
                            }
                        }
                        // 카메라가 켜져있고 이모지/배경제거가 활성화되어 있으면 이모지 필터 적용
                        // (카메라가 이미 켜져있거나 방금 켠 경우)
                        else if ((savedCamOn || canvasPipelineActiveRef.current) && (savedEmoji || savedBgRemove)) {
                            // 카메라가 이미 켜져있으면 이모지 필터만 적용
                            if (canvasPipelineActiveRef.current && savedEmoji) {
                                await startFaceEmojiFilter(savedEmoji);
                            }
                        }

                        // 마이크가 켜져있었으면 마이크 켜기 (ensureLocalProducers에서 처리되지만 명시적으로 확인)
                        if (savedMicOn) {
                            // ensureLocalProducers가 이미 호출되었을 수 있으므로, 트랙 enabled 상태만 확인
                            const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
                            audioTracks.forEach(t => {
                                if (t.enabled !== savedMicOn) {
                                    t.enabled = savedMicOn;
                                    console.log("[Auto-restore] Audio track enabled set to", savedMicOn);
                                }
                            });
                        }
                    } catch (e) {
                        console.warn("[Auto-restore] Failed to restore state:", e);
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

        if (faceFilterRafRef.current != null) {
            clearTimeout(faceFilterRafRef.current);
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
        // ✅ 통화 종료 중이면 스킵 (race condition으로 AudioContext 재생성 방지)
        if (!isLeavingRef.current && rawTrack && rawTrack.readyState === "live") {
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
        faceFilterLastGoodFrameCanvasRef.current = null;
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
        // ✅ 통화 종료 중이면 스킵 (race condition으로 AudioContext 재생성 방지)
        if (!isLeavingRef.current && rawTrack && rawTrack.readyState === "live") {
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
                clearTimeout(canvasPipelineRafRef.current);
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

        // 🔥 faceFilter용 마지막 정상 프레임 저장용 canvas 준비
        const faceFilterLastCanvas = document.createElement("canvas");
        faceFilterLastCanvas.width = canvas.width;
        faceFilterLastCanvas.height = canvas.height;
        faceFilterLastGoodFrameCanvasRef.current = faceFilterLastCanvas;

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
        hasEverDrawnEmojiRef.current = false;  // 🔥 카메라 켤 때 한 번만 검은화면
        emojiBlackScreenStartedAtRef.current = 0;
        emojiBlackScreenToastShownRef.current = false;

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

        // 🔥 이모지 모드일 때는 얼굴 감지기를 즉시 초기화하여 입장/새로고침 시 빠른 감지
        if (faceEmojiRef.current && faceModeRef.current === "emoji" && detectorState) {
            console.log("[startFaceEmojiFilter] 얼굴 감지기 즉시 초기화 완료, 감지 시작");
            // 얼굴 감지가 즉시 시작되도록 lastDetectAtRef를 초기화
            lastDetectAtRef.current = 0;
        }

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
        const filterStartTime = Date.now(); // 🔥 시간 기반 타임아웃용
        let filteredFramesDrawn = 0; // 🔥 필터가 실제로 적용된 프레임 개수 (쌩얼 노출 방지)

        // 렌더 루프
        const draw = async () => {
            if (!faceFilterActiveRef.current) return;

            // 🔥 비디오가 준비되지 않았으면 검은 화면
            const videoReady = v && v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2;
            if (!videoReady) {
                // 🔥 비디오가 준비되지 않았으면 마지막 정상 프레임 사용 (검은 화면 대신 freeze)
                const last = faceFilterLastGoodFrameCanvasRef.current;
                if (last && faceFilterLastGoodFrameAtRef.current > 0) {
                    try {
                        ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
                    } catch {
                        // 복사 실패 시 검은 화면
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                } else {
                    // 마지막 프레임이 없으면 검은 화면
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                faceFilterRafRef.current = requestAnimationFrame(draw);
                return;
            }

            // 비디오 프레임 (+ 배경 제거 옵션)
            const wantBgRemove = !!bgRemoveRef.current;
            const wantEmoji = !!faceEmojiRef.current && faceModeRef.current === "emoji";

            // 🔥 얼굴 감지 상태 미리 계산 (이모지 모드일 때 중복 계산 방지)
            let normalizedFaceBoxForEmoji = null;
            let canDrawEmoji = false;
            if (wantEmoji) {
                const box = lastFaceBoxRef.current;
                const videoW = v.videoWidth || canvas.width;
                const videoH = v.videoHeight || canvas.height;
                const isRecent = lastFaceBoxAtRef.current && (Date.now() - lastFaceBoxAtRef.current < 1200);
                normalizedFaceBoxForEmoji = normalizeFaceBox(box, videoW, videoH);
                canDrawEmoji = !!normalizedFaceBoxForEmoji && isRecent;
            }

            // 🔥 필터 준비 상태 확인 (배경제거만 체크)
            // 이모지는 여기서 체크하지 않음 - draw에서 얼굴 미감지 시 기본 이모지로 가림
            const checkFiltersReady = () => {
                // 배경제거가 켜져있어도 세그멘터 로딩을 기다리지 않음 (너무 오래 걸림)
                // 대신 세그멘터가 준비될 때까지 검은 화면을 유지하고, 준비되면 바로 적용
                return true; // 항상 true 반환하여 바로 시작 (세그멘터는 백그라운드에서 로딩)
            };
            const filtersReady = checkFiltersReady();

            // 🔥 배경제거 세그멘터가 실제로 준비되었는지 확인 (필터 적용 여부 판단용)
            const bgSegActuallyReady = wantBgRemove ? !!faceBgSegmenterRef.current?.segmenter : true;

            // 🔥 필터 준비 중이면 마지막 정상 프레임 사용 (검은 화면 대신 freeze)
            if (isFilterPreparingRef.current && (wantBgRemove || wantEmoji)) {
                const last = faceFilterLastGoodFrameCanvasRef.current;
                if (last && faceFilterLastGoodFrameAtRef.current > 0) {
                    try {
                        ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
                    } catch {
                        // 복사 실패 시 검은 화면
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                } else {
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                faceFilterRafRef.current = requestAnimationFrame(draw);
                return;
            }

            // 🔥 배경제거가 켜져있는데 세그멘터가 준비되지 않았을 때 처리
            if (wantBgRemove && !bgSegActuallyReady) {
                // 배경제거만 켜져있고 세그멘터가 준비되지 않았으면 마지막 정상 프레임 사용
                const last = faceFilterLastGoodFrameCanvasRef.current;
                if (last && faceFilterLastGoodFrameAtRef.current > 0) {
                    try {
                        ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
                    } catch {
                        // 복사 실패 시 검은 화면
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                } else {
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                faceFilterRafRef.current = requestAnimationFrame(draw);
                return;
            }

            if (wantBgRemove) ensureBgSegmenter();

            try {
                // 🔥 필터 준비 중이면 원본 비디오를 그리지 않음 (검은 화면 유지)
                if (isFilterPreparingRef.current && (wantBgRemove || wantEmoji)) {
                    // 필터 준비 중에는 검은 화면만 유지 (위에서 이미 그려짐)
                    // 얼굴 감지는 계속 진행 (아래에서 처리)
                } else if (!wantBgRemove || !frameCtx) {
                    // 🔥 이모지 모드 + 얼굴 미감지: 카메라 켤 때 한 번만 검은화면, 이후에는 원본 비디오(움직임 유지)
                    if (wantEmoji && !canDrawEmoji) {
                        if (!hasEverDrawnEmojiRef.current) {
                            if (!emojiBlackScreenStartedAtRef.current) emojiBlackScreenStartedAtRef.current = Date.now();
                            if (Date.now() - emojiBlackScreenStartedAtRef.current >= 3000 && !emojiBlackScreenToastShownRef.current) {
                                emojiBlackScreenToastShownRef.current = true;
                                setToastMessage("얼굴이 보이게 해주세요.");
                                setShowToast(true);
                            }
                            ctx.fillStyle = "#000000";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        } else {
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        }
                    } else {
                        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    }
                } else {
                    // 🔥 이모지 모드 + 얼굴 미감지: 카메라 켤 때 한 번만 검은화면, 이후에는 원본 비디오(움직임 유지)
                    if (wantEmoji && !canDrawEmoji) {
                        if (!hasEverDrawnEmojiRef.current) {
                            if (!emojiBlackScreenStartedAtRef.current) emojiBlackScreenStartedAtRef.current = Date.now();
                            if (Date.now() - emojiBlackScreenStartedAtRef.current >= 3000 && !emojiBlackScreenToastShownRef.current) {
                                emojiBlackScreenToastShownRef.current = true;
                                setToastMessage("얼굴이 보이게 해주세요.");
                                setShowToast(true);
                            }
                            ctx.fillStyle = "#000000";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        } else {
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        }
                    } else {
                    // 1) frameCanvas에 비디오 프레임
                    frameCtx.globalCompositeOperation = "source-over";
                    frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
                    frameCtx.drawImage(v, 0, 0, frameCanvas.width, frameCanvas.height);

                    // 2) 세그멘테이션 마스크 업데이트(쓰로틀)
                    const seg = faceBgSegmenterRef.current?.segmenter;
                    const nowMs = performance.now();
                    if (seg && nowMs - faceBgLastInferAtRef.current > 140) {
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
                        // 🔥 마스크 자체가 유효한지 먼저 확인 (마스크 크기 확인)
                        const maskW = maskCanvas.width || 0;
                        const maskH = maskCanvas.height || 0;
                        if (maskW < 10 || maskH < 10) {
                            // 마스크가 너무 작으면 유효하지 않음
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        } else {
                            frameCtx.globalCompositeOperation = "destination-in";
                            frameCtx.drawImage(maskCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
                            frameCtx.globalCompositeOperation = "source-over";

                            // 🔥 마스크 적용 후 실제로 사람 영역이 있는지 확인 (효율적인 샘플링 방식)
                            // 사람이 감지되지 않으면 원본 비디오 표시 (하얀 배경만 보이는 문제 방지)
                            try {
                                // 성능을 위해 샘플링으로 확인 (전체 픽셀 확인은 너무 느림)
                                const sampleSize = 50; // 50x50 샘플링
                                const stepX = Math.max(1, Math.floor(frameCanvas.width / sampleSize));
                                const stepY = Math.max(1, Math.floor(frameCanvas.height / sampleSize));
                                const imageData = frameCtx.getImageData(0, 0, frameCanvas.width, frameCanvas.height);
                                const data = imageData.data;
                                let visiblePixels = 0;
                                let totalSamples = 0;

                                // 샘플링으로 확인
                                for (let y = 0; y < frameCanvas.height; y += stepY) {
                                    for (let x = 0; x < frameCanvas.width; x += stepX) {
                                        const idx = (y * frameCanvas.width + x) * 4;
                                        if (data[idx + 3] > 10) { // alpha > 10
                                            visiblePixels++;
                                        }
                                        totalSamples++;
                                    }
                                }

                                const visibleRatio = totalSamples > 0 ? visiblePixels / totalSamples : 0;
                                // 사람 영역이 3% 미만이면 원본 비디오 표시 (마스크가 제대로 작동하지 않음)
                                if (visibleRatio < 0.03) {
                                    console.log("[BgRemove] 사람 영역이 거의 없음, 원본 비디오 표시:", visibleRatio);
                                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                                } else {
                                    // 4) 최종 출력: 배경 흰색 + 사람만
                                    ctx.save();
                                    ctx.fillStyle = "#ffffff";
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);
                                    ctx.restore();
                                    // 🔥 배경제거가 실제로 적용된 프레임 카운트 증가
                                    if (wantBgRemove) filteredFramesDrawn++;
                                }
                            } catch (checkError) {
                                // 검증 실패 시: 필터 준비 중이면 검은 화면, 아니면 원본 비디오
                                if (isFilterPreparingRef.current && (wantBgRemove || wantEmoji)) {
                                    ctx.fillStyle = "#000000";
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                } else {
                                    console.warn("[BgRemove] 마스크 검증 실패, 원본 비디오 표시:", checkError);
                                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                                }
                            }
                        }
                    } else {
                        // 🔥 마스크가 아직 로드되지 않았을 때: 필터 준비 중이면 검은 화면, 아니면 원본 비디오
                        if (isFilterPreparingRef.current && (wantBgRemove || wantEmoji)) {
                            ctx.fillStyle = "#000000";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        } else {
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                        }
                    }
                    } // end else (wantEmoji && !canDrawEmoji)
                }
            } catch {
                // 필터 준비 중이면 마지막 정상 프레임 사용 (검은 화면 대신 freeze)
                if (isFilterPreparingRef.current && (wantBgRemove || wantEmoji)) {
                    const last = faceFilterLastGoodFrameCanvasRef.current;
                    if (last && faceFilterLastGoodFrameAtRef.current > 0) {
                        try {
                            ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
                        } catch {
                            // 복사 실패 시 검은 화면
                            ctx.fillStyle = "#000000";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                    } else {
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                }
                faceFilterRafRef.current = requestAnimationFrame(draw);
                return;
            }

            // 얼굴 감지(지원 시) - throttle + in-flight lock + 최신 결과만 반영
            const now = Date.now();
            const wantEmojiForDetect = !!faceEmojiRef.current && faceModeRef.current === "emoji";
            // 🔥 이모지 모드일 때는 warmup 없이 즉시 얼굴 감지 시작 (입장/새로고침 시 쌩얼 노출 방지)
            const shouldStartDetection = true;

            if (wantEmojiForDetect && shouldStartDetection && !faceDetectorRef.current) {
                ensureFaceDetector().catch(() => { });
            }

            const det = faceDetectorRef.current;
            // 🔥 얼굴 감지 간격 완화(렉 방지): 50/80ms - CPU 부하 감소
            const hasDetectedFace = !!lastFaceBoxRef.current && lastFaceBoxAtRef.current && (Date.now() - lastFaceBoxAtRef.current < 1200);
            const detectInterval = (isFilterPreparingRef.current || !hasDetectedFace) ? 50 : 80;
            if (wantEmojiForDetect && shouldStartDetection && det && now - lastDetectAtRef.current > detectInterval) {
                lastDetectAtRef.current = now;

                if (!faceDetectInFlightRef.current) {
                    faceDetectInFlightRef.current = true;
                    const seq = ++faceDetectSeqRef.current;
                    const vw = v.videoWidth || canvas.width;
                    const vh = v.videoHeight || canvas.height;

                    Promise.resolve(runFaceDetectOnce(v, vw, vh))
                        .then((normalized) => {
                            if (seq !== faceDetectSeqRef.current) return;
                            if (normalized) {
                                lastFaceBoxRef.current = normalized;
                                lastFaceBoxAtRef.current = Date.now();
                            } else {
                                if (!lastFaceBoxAtRef.current || Date.now() - lastFaceBoxAtRef.current > 900) {
                                    lastFaceBoxRef.current = null;
                                    lastFaceBoxAtRef.current = 0;
                                    smoothedFaceBoxRef.current = null;
                                }
                            }
                        })
                        .finally(() => {
                            faceDetectInFlightRef.current = false;
                        });
                }
            }

            // 이모지 오버레이
            // ✅ 얼굴이 인식되지 않으면 절대 그리지 않는다(가운데 뜨는 현상 방지)
            const currentEmoji = faceEmojiRef.current;
            // wantEmoji와 canDrawEmoji는 위에서 이미 계산됨

            if (!canDrawEmoji) {
                // ✅ 얼굴 인식 실패/불안정 시: 가운데 뜨는 현상 방지(스무딩 좌표 리셋)
                smoothedFaceBoxRef.current = null;
            } else if (normalizedFaceBoxForEmoji) {
                const scaleX = canvas.width / (v.videoWidth || canvas.width);
                const scaleY = canvas.height / (v.videoHeight || canvas.height);

                const targetBox = {
                    x: (normalizedFaceBoxForEmoji.x + normalizedFaceBoxForEmoji.width / 2) * scaleX,
                    y: (normalizedFaceBoxForEmoji.y + normalizedFaceBoxForEmoji.height / 2) * scaleY - (normalizedFaceBoxForEmoji.height * scaleY * 0.25),
                    size: Math.max(normalizedFaceBoxForEmoji.width * scaleX, normalizedFaceBoxForEmoji.height * scaleY)
                };

                if (!Number.isFinite(targetBox.x) || !Number.isFinite(targetBox.y) || !Number.isFinite(targetBox.size)) {
                    smoothedFaceBoxRef.current = null;
                } else {
                    const smoothFactor = 0.75;
                    const prev = smoothedFaceBoxRef.current;
                    smoothedFaceBoxRef.current = prev
                        ? {
                            x: prev.x + (targetBox.x - prev.x) * smoothFactor,
                            y: prev.y + (targetBox.y - prev.y) * smoothFactor,
                            size: prev.size + (targetBox.size - prev.size) * smoothFactor
                        }
                        : targetBox;

                    const smoothed = smoothedFaceBoxRef.current;
                    // 🔥 최대 크기 제한 (화면의 50% 이하)
                    const maxSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.5);
                    const size = Math.max(120, Math.min(maxSize, Math.floor(smoothed.size * 2.8)));

                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
                    ctx.fillText(currentEmoji, smoothed.x, smoothed.y);
                    ctx.restore();
                    hasEverDrawnEmojiRef.current = true;  // 🔥 이모지 한 번이라도 그렸으면 이후 얼굴 미감지 시 원본 비디오 표시
                    emojiBlackScreenStartedAtRef.current = 0;
                    emojiBlackScreenToastShownRef.current = false;
                    // 🔥 이모지가 그려진 프레임 카운트 증가
                    if (wantEmoji) filteredFramesDrawn++;
                }
            }

            // 🔥 첫 프레임이 그려진 후 + 필터가 준비되면 새 producer 생성 (keyframe 보장, 쌩얼 노출 방지)
            frameCount++;
            if (!hasReplacedTrack && frameCount >= 3) {
                const MAX_WAIT_MS = 100; // 🔥 시간 기반 타임아웃: 최대 0.1초 대기 (매우 빠른 응답)
                const elapsed = Date.now() - filterStartTime;
                const isTimeout = elapsed >= MAX_WAIT_MS;

                // 필터가 필요 없거나 타임아웃이면 producer 생성
                // 항상 바로 시작 (세그멘터는 백그라운드에서 로딩, 이모지는 바로 적용 가능)
                const needFilters = wantBgRemove || wantEmoji;
                if (!needFilters || isTimeout) {
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
                            if (!needFilters) {
                                console.log("[FaceEmoji] new producer created with canvas track (no filters needed)");
                            } else if (filtersReady) {
                                console.log("[FaceEmoji] new producer created with canvas track (filters ready)", elapsed, "ms");
                            } else {
                                console.log("[FaceEmoji] new producer created with canvas track (timeout after", elapsed, "ms)");
                            }
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
            }

            // 🔥 스피너 제거됨 - 필터 준비 완료 로직 제거

            // ✅ 마지막 정상 프레임 저장 (검/흰 화면 대신 freeze용)
            // 🔥 이모지 ON + 얼굴 미감지 시 검은화면을 그렸으면 저장하지 않음 (이전 이모지 프레임 유지)
            const drewBlackForEmoji = wantEmoji && !canDrawEmoji;
            try {
                const last = faceFilterLastGoodFrameCanvasRef.current;
                if (last && canvas && !drewBlackForEmoji) {
                    const lctx = last.getContext("2d");
                    if (lctx) {
                        lctx.drawImage(canvas, 0, 0, last.width, last.height);
                        faceFilterLastGoodFrameAtRef.current = Date.now();
                    }
                }
            } catch { }

            // 이모지/배경제거 시 20fps로 스로틀(렉 방지), 아니면 rAF
            if (wantBgRemove || wantEmoji) {
                faceFilterRafRef.current = setTimeout(() => requestAnimationFrame(draw), 50);
            } else {
                faceFilterRafRef.current = requestAnimationFrame(draw);
            }
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

    // 🔥 아바타를 canvas로 그려서 MediaStream으로 변환하는 함수
    const createAvatarStream = useCallback((name, width = 640, height = 480, showName = true) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // 배경색 (회색)
        ctx.fillStyle = "#f3f4f6";
        ctx.fillRect(0, 0, width, height);

        // 아바타 원 그리기
        const centerX = width / 2;
        // showName이 true면 이름 공간을 위해 위로 이동, false면 중앙에 배치
        const centerY = showName ? height / 2 - 20 : height / 2;
        const radius = Math.min(width, height) * 0.25;

        // 그라데이션 배경
        const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        gradient.addColorStop(0, "#eef6f0");
        gradient.addColorStop(1, "#cfe8d6");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 텍스트 (이니셜)
        const initials = (name || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

        ctx.fillStyle = "#97c793";
        ctx.font = `bold ${radius * 0.8}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, centerX, centerY);

        // 이름 텍스트 (아바타 아래) - showName이 true일 때만 표시
        if (showName) {
            const displayName = name || "참가자";
            ctx.fillStyle = "#374151"; // 어두운 회색
            // 폰트 크기를 크게 설정 (최소 20px, 또는 width의 5% 중 큰 값)
            const fontSize = Math.max(20, width * 0.05);
            ctx.font = `bold ${fontSize}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            // 텍스트가 너무 길면 잘라내기
            const maxWidth = width * 0.85;
            let finalName = displayName;
            const metrics = ctx.measureText(displayName);
            if (metrics.width > maxWidth) {
                // 텍스트가 너무 길면 "..." 추가
                let truncated = displayName;
                while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
                    truncated = truncated.slice(0, -1);
                }
                finalName = truncated + "...";
            }
            ctx.fillText(finalName, centerX, centerY + radius + 15);
        }

        // Canvas를 MediaStream으로 변환
        const stream = canvas.captureStream(30); // 30fps
        return stream;
    }, []);

    const handleBrowserPip = useCallback(async () => {
        const video = mainVideoRef.current;
        if (!video) return;

        if (!document.pictureInPictureElement) {
            // 🔥 PiP 요청 전에 video에 스트림이 있는지 확인하고 강제 설정
            const currentMainStream = mainStreamRef.current;
            let stream = video.srcObject || currentMainStream;
            const peerName = mainUser?.name || "참가자";
            const peerId = mainUser?.id != null ? String(mainUser.id) : "";

            // 🔥 스트림이 없거나 비디오 트랙이 없으면 아바타 스트림 생성
            if (!stream || !stream.getVideoTracks().some(t => t.readyState === "live")) {
                console.log("[PiP] 비디오 스트림이 없어서 아바타 스트림 생성");
                stream = createAvatarStream(peerName);
                video.srcObject = stream;
                video.muted = true;
                try {
                    await video.play();
                } catch { }
            } else {
                if (!video.srcObject && currentMainStream) {
                    console.log("[PiP] video.srcObject가 없어서 강제 설정");
                    video.srcObject = currentMainStream;
                    video.muted = true;
                    try {
                        await video.play();
                    } catch { }
                }

                // video가 재생 가능한 상태인지 확인
                if (video.readyState < 2) {
                    // 메타데이터 로드 대기
                    await new Promise((resolve) => {
                        const onCanPlay = () => {
                            video.removeEventListener("canplay", onCanPlay);
                            resolve();
                        };
                        video.addEventListener("canplay", onCanPlay);
                        setTimeout(resolve, 1000); // 1초 타임아웃
                    });
                }
            }

            // 🔥 MeetingContext의 requestBrowserPip 사용 (polling 포함)
            console.log("[PiP] MeetingContext requestBrowserPip 호출");
            const success = await requestBrowserPip(video, stream, peerName, peerId);

            if (!success) {
                // fallback: 직접 요청
                console.log("[PiP] fallback: 직접 requestPictureInPicture 호출");
                video.requestPictureInPicture().catch((e) => {
                    console.warn("[PiP] requestPictureInPicture failed:", e);
                });
            }
        }
    }, [requestBrowserPip, mainUser, createAvatarStream]);

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

            // 다른 참가자에게도 마이크/카메라 off 아이콘이 보이도록 서버에 상태 전송
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: { muted: true, cameraOff: true },
                    }));
                } catch (_) { }
            }

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

        // 🔥 필터 준비 중이면 카메라 producer 생성 건너뜀 (쌩얼 전송 방지)
        // turnOnCamera()에서 필터 준비 완료 후 producer를 생성함
        if (isFilterPreparingRef.current) {
            console.log(`[ensureLocalProducers] Filter preparing, skipping camera producer`);
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

            // ⭐ 화면공유 시작 전 이모지 필터 상태 저장
            faceEmojiWasOnBeforeScreenShareRef.current = faceEmojiRef.current || null;
            faceModeWasOnBeforeScreenShareRef.current = faceModeRef.current || null;
            bgRemoveWasOnBeforeScreenShareRef.current = bgRemoveRef.current || false;
            // console.log(`[startScreenShare] Saving emoji filter state: emoji=${faceEmojiWasOnBeforeScreenShareRef.current}, mode=${faceModeWasOnBeforeScreenShareRef.current}, bgRemove=${bgRemoveWasOnBeforeScreenShareRef.current}`);

            // 1) 이모지 필터가 활성화되어 있으면 중지
            if (faceFilterActiveRef.current || faceEmojiRef.current || faceModeRef.current === "emoji") {
                console.log("[startScreenShare] Stopping emoji filter before screen share");
                await stopFaceEmojiFilter();
            }

            // 2) 카메라 producer 닫기 (원격에 camera producerClosed 나가게)
            const cameraProducer = producersRef.current.get("camera");
            if (cameraProducer) {
                const id = cameraProducer.id;
                try { cameraProducer.close(); } catch { }
                producersRef.current.delete("camera");
                safeSfuSend({ action: "closeProducer", data: { producerId: id } });
            }

            // 3) 로컬 카메라 "비디오 트랙만" 정지 (오디오는 유지)
            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => {
                    try { t.stop(); } catch { }
                });

                // 🔥 [Fix] 화면 공유 시작 시 Canvas Pipeline도 확실히 정리
                // 정리하지 않으면 drawLoop가 계속 돌거나, 상태가 꼬여서 화면공유 종료 후 필터 적용 안됨
                canvasPipelineActiveRef.current = false;
                if (canvasPipelineRafRef.current) {
                    clearTimeout(canvasPipelineRafRef.current);
                    canvasPipelineRafRef.current = null;
                }
                // video element도 일시 정지 (CPU 절약)
                if (canvasPipelineVideoElRef.current) {
                    try { canvasPipelineVideoElRef.current.pause(); } catch { }
                }

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

            // 4) 화면공유 producer 생성
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

                // 카메라가 꺼져있으면 이모지 필터 복원하지 않음 (상태는 저장해두고 나중에 카메라 켤 때 적용)
                // 저장된 상태 초기화는 카메라가 켜져있을 때만 수행
                return;
            }

            // 카메라가 켜져있었으면 복구
            if (!sendTransportRef.current || sendTransportRef.current.closed) {
                console.warn("[restore] sendTransport not ready");
                return;
            }

            // 화면공유 시작 전 이모지 필터 상태 확인 (백업)
            const savedEmoji = faceEmojiWasOnBeforeScreenShareRef.current;
            const savedMode = faceModeWasOnBeforeScreenShareRef.current;
            const savedBgRemove = bgRemoveWasOnBeforeScreenShareRef.current;

            // 🔥 [Fix] 화면 공유 중에 변경한 설정(해제 포함)을 정확히 반영하기 위해
            // saved...(백업)값은 무시하고, 현재 UI 상태(ref)를 유일한 진실로 사용한다.
            const targetEmoji = faceEmojiRef.current;
            const targetMode = faceModeRef.current;
            const targetBgRemove = bgRemoveRef.current;

            const hasFilterConfig = targetEmoji || targetMode === "emoji" || targetBgRemove;

            // 이모지 필터가 활성화되어 있었으면 turnOnCamera를 사용 (canvas pipeline)
            // 이렇게 하면 아바타가 잠깐 뜨는 문제를 방지하고 이모지 필터가 바로 적용됨
            if (hasFilterConfig) {
                console.log(`[stopScreenShare] Restoring camera with filter: emoji=${targetEmoji}, mode=${targetMode}, bgRemove=${targetBgRemove}`);

                // 상태 먼저 업데이트 (turnOnCamera가 이 상태를 확인함)
                if (targetEmoji) {
                    faceEmojiRef.current = targetEmoji;
                    setFaceEmoji(targetEmoji);
                }
                if (targetMode) {
                    faceModeRef.current = targetMode;
                    setFaceMode(targetMode);
                }
                if (targetBgRemove !== undefined) {
                    bgRemoveRef.current = targetBgRemove;
                    setBgRemove(targetBgRemove);
                }

                // turnOnCamera 호출 (canvas pipeline 사용, 이모지 필터 자동 적용)
                try {
                    await turnOnCamera();
                    console.log("[stopScreenShare] Camera restored with emoji filter via turnOnCamera");
                } catch (e) {
                    console.error("[stopScreenShare] Failed to restore camera with turnOnCamera:", e);
                    // 실패 시 fallback으로 일반 카메라 복구
                    const prevAudioTracks = localStreamRef.current
                        ? localStreamRef.current.getAudioTracks().filter(t => t.readyState !== "ended")
                        : [];
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false,
                    });
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    if (newVideoTrack && newVideoTrack.readyState === "live") {
                        await produceCamera(newVideoTrack, true);
                        const merged = new MediaStream([...prevAudioTracks, newVideoTrack]);
                        localStreamRef.current = merged;
                        setLocalStream(merged);
                        setParticipants((prev) =>
                            prev.map((p) =>
                                p.isMe ? { ...p, cameraOff: false, stream: merged } : p
                            )
                        );
                    }
                }
            } else {
                // 이모지 필터가 없었으면 기존 방식으로 복구 (produceCamera 사용)
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
            }

            // 저장된 상태 초기화
            faceEmojiWasOnBeforeScreenShareRef.current = null;
            faceModeWasOnBeforeScreenShareRef.current = null;
            bgRemoveWasOnBeforeScreenShareRef.current = false;
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
        const myId = String(userIdRef.current);
        const peerIdStr = String(fallbackPeerId ?? "");
        // 본인 producer는 consume하지 않음 (유령 유저 방지). 서버가 짧은 id(예: f472)를 보낸 경우도 처리
        if (peerIdStr === myId || (peerIdStr.length >= 4 && myId.startsWith(peerIdStr))) return;
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
                    appData: { ...finalAppData, peerId }, // ✅ peerId 추가 - 오디오 모니터링에서 사용
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

                    // 🔥 디버그: consumer 스트림 상태 확인
                    console.log(`[consume] Peer ${peerId} - kind: ${kind}, merged stream:`, {
                        videoTracks: next.getVideoTracks().length,
                        audioTracks: next.getAudioTracks().length,
                        audioTrackIds: next.getAudioTracks().map(t => t.id),
                        audioTrackStates: next.getAudioTracks().map(t => t.readyState),
                    });
                } else {
                    // ✅ 화면공유는 "항상 새 MediaStream"으로 만들어 리렌더 강제
                    screenStream = new MediaStream([consumer.track]);
                }

                // 🔥 비디오 consumer가 들어왔으면 카메라가 켜져있다는 의미
                const isVideoConsumer = kind === "video" && !isScreen;

                setParticipants((prev) => {
                    const idx = prev.findIndex((p) => String(p.id) === String(peerId) || String(p.userId) === String(peerId));
                    const isMe = String(peerId) === String(userIdRef.current);

                    // 🔥 본인 producer에 대한 consumer는 타일 추가하지 않음 (유령 유저 User-xxxx 방지)
                    if (idx === -1 && isMe) return prev;

                    // 신규 참가자 (connectionId 사용 시 id가 peerId와 다를 수 있음)
                    if (idx === -1) {
                        const displayName = peerIdToNameRef.current.get(String(peerId)) || `User-${String(peerId).slice(0, 4)}`;
                        return [
                            ...prev,
                            {
                                id: peerId,
                                userId: peerId,
                                name: displayName,
                                isMe: false,

                                // 🔥 비디오 consumer가 들어왔으면 cameraOff: false
                                // 오디오만 들어온 경우는 cameraOff: true 유지
                                muted: true,
                                cameraOff: isVideoConsumer ? false : true,
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

                    // 🔥 핵심 수정: consumer가 들어올 때는 항상 mergedCameraStream 사용
                    // peerStreamsRef에 저장된 최신 스트림에는 오디오 트랙이 포함되어 있음
                    // getStableStreamRef가 오디오 트랙을 놓치는 경우가 있어서 직접 사용
                    const cameraStream = isScreen ? p.stream : mergedCameraStream;

                    next[idx] = {
                        ...p,

                        // ✅ screen이면 stream 건드리지 않음, camera면 최신 stream 사용
                        stream: isScreen ? p.stream : cameraStream,

                        // ✅ screen이면 screenStream 갱신(항상 새 객체), 아니면 유지
                        screenStream: isScreen ? screenStream : p.screenStream,

                        // ✅ screen일 때만 true로 세팅 (종료는 종료 이벤트에서 false)
                        isScreenSharing: isScreen ? true : p.isScreenSharing,

                        // 🔥 비디오 consumer가 들어왔으면 cameraOff: false로 설정
                        // 오디오 consumer인 경우는 기존 상태 유지
                        cameraOff: isVideoConsumer ? false : p.cameraOff,

                        isLoading: false,
                        isJoining: false,
                        isReconnecting: false,
                        lastUpdate: Date.now(),
                    };

                    return next;
                });

                bumpStreamVersion();

                /* -------------------------------------------------
                오디오 처리 (resume 후 트랙에 데이터가 들어오므로 재생 재시도)
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
                consumer resume (SFU가 paused 상태로 생성하므로 반드시 resume 필요)
                ------------------------------------------------- */
                safeSfuSend({
                    action: "resumeConsumer",
                    requestId: safeUUID(),
                    data: { consumerId },
                });

                // resume 후 트랙에 데이터가 들어오면 오디오 재생 재시도 (브라우저 정책/타이밍 대응)
                if (kind === "audio") {
                    const audio = audioElsRef.current.get(producerId);
                    if (audio) {
                        setTimeout(() => audio.play().catch(() => { }), 150);
                        setTimeout(() => audio.play().catch(() => { }), 500);
                    }
                }

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

                            // ✅ 카메라/오디오 consumer 종료 처리
                            // - video 트랙이 종료되었다고 해서 곧바로 stream을 null로 만들지 않는다.
                            //   (트랙 교체/재-produce 중에도 onended/producerclose가 발생할 수 있어 "아바타 타일"로 오래 머물 수 있음)
                            // - 실제 cameraOff는 서버 상태(room:sync/USERS_UPDATE/USER_STATE_CHANGE)에서만 확정한다.
                            const endedKind = consumer?.track?.kind;
                            if (endedKind === "video") {
                                return { ...p, lastUpdate: Date.now() };
                            }

                            // 오디오 트랙 종료: video는 유지하고 오디오만 제거
                            const cur = peerStreamsRef.current.get(peerId) || p.stream;
                            if (!cur) {
                                return { ...p, lastUpdate: Date.now() };
                            }

                            const aliveTracks = cur
                                .getTracks()
                                .filter((t) => t.readyState !== "ended" && t.id !== consumer?.track?.id);

                            const rebuilt = aliveTracks.length ? new MediaStream(aliveTracks) : cur;
                            try { peerStreamsRef.current.set(peerId, rebuilt); } catch { }
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
                console.error("[consume] Failed to consume remote stream", {
                    producerId,
                    peerId: fallbackPeerId,
                    error: e?.message || String(e),
                    hint: "ICE/DTLS 연결 실패일 수 있음. SFU announcedIp 및 UDP 40000-49999 포트 확인.",
                });

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
        if (mutedByHostMe) return; // 방장이 강제로 끈 경우 스스로 켤 수 없음
        const newVal = !micOn;
        setMicOn(newVal);
        localStorage.setItem("micOn", String(newVal)); // 문자열로 저장

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
        // ⚠️ 원격 track에 stop()을 호출하면 PiP 포함 모든 재생이 'ended'로 굳어버릴 수 있음
        // (receiver track은 stop() 호출 대상이 아님)
        const prevStream = peerStreamsRef.current.get(peerId);
        if (prevStream) peerStreamsRef.current.delete(peerId);

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
            // 🔥 저장된 이모지/배경제거 설정 확인
            const savedEmoji = faceEmojiRef.current;
            const savedBgRemove = bgRemoveRef.current;
            const needFilters = !!(savedEmoji || savedBgRemove);

            if (needFilters && camOnRef.current) {
                // 🔥 이모지/배경제거 설정이 있고 카메라가 켜져있으면 바로 canvas 파이프라인 시작
                // 카메라가 꺼져있으면 이모지/배경제거가 있어도 카메라를 켜지 않음
                if (camOnRef.current) {
                    console.log("[Init] Filter settings detected and camera is ON, starting canvas pipeline directly");
                    try {
                        await turnOnCamera();
                    } catch (e) {
                        console.warn("[Init] turnOnCamera failed, fallback to startLocalMedia:", e);
                        await startLocalMedia();
                    }
                } else {
                    // 카메라가 꺼져있으면 필터 설정이 있어도 카메라를 켜지 않음
                    console.log("[Init] Filter settings detected but camera is OFF, starting local media without camera");
                    await startLocalMedia();
                }
            } else {
                // 필터 설정이 없거나 카메라가 꺼져있으면 기존 방식대로
                console.log("[Init] Starting local media");
                await startLocalMedia();
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // startMeeting은 MeetingRouteBridge / startLocalMedia에서 roomId·subjectId와 함께 호출됨
        return () => {
            // ❗ PIP 모드일 때는 endMeeting 호출하지 않음 (polling 유지)
            const isInPipMode = !!document.pictureInPictureElement ||
                sessionStorage.getItem("pip.roomId");

            if (isInPipMode) {
                // 🔥 사이드바 자동 PiP 진입(라우트 이동) 시 여기로 들어옴
                // 이때 필터/트랙 정리를 해버리면 producer track이 끊기면서 PiP가 마지막 프레임에서 멈출 수 있음
                console.log("[MeetingPage] PIP 모드 - cleanup/endMeeting 모두 스킵");
                return;
            }

            // 🔥 모집페이지 등으로 나갈 때 유예 없이 즉시 퇴장 — producer 먼저 끊어 상대 타일 즉시 제거
            isLeavingRef.current = true;
            try {
                producersRef.current.forEach((p) => {
                    try { p.close(); } catch { }
                    if (p.appData?.type) safeSfuSend({ action: "closeProducer", data: { producerId: p.id } });
                });
                producersRef.current.clear();
            } catch { }
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "LEAVE" }));
                }
            } catch { }
            try {
                safeSfuSend({
                    action: "leave",
                    requestId: safeUUID(),
                    data: { roomId, peerId: userId },
                });
            } catch { }
            try { wsRef.current?.close(); } catch { }
            try { sfuWsRef.current?.close(); } catch { }

            // 🔥 언마운트 시 얼굴 필터 정리 (PIP가 아닐 때만)
            stopFaceEmojiFilter().catch(() => { });
            stopAvatarFilter().catch(() => { });

            // ✅ 언마운트 시 로컬 미디어도 정리 (통화 종료/페이지 이동 시 빨간 점(카메라 사용중) 방지)
            try { turnOffCamera(); } catch { } // hidden video + rawTrack stop 포함
            try {
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
                    localStreamRef.current = null;
                }
            } catch { }
            try {
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
                    screenStreamRef.current = null;
                }
            } catch { }

            // ✅ 추가 안전장치: localStreamRef에 포함되지 않은 원본/출력 트랙 모두 stop (빨간원 방지)
            try {
                const extraTracks = [
                    lastCameraTrackRef?.current,
                    faceFilterRawTrackRef?.current,
                    faceFilterOutTrackRef?.current,
                    avatarRawTrackRef?.current,
                    avatarOutTrackRef?.current,
                    canvasPipelineRawTrackRef?.current,
                    canvasPipelineOutTrackRef?.current,
                ].filter(Boolean);
                extraTracks.forEach((t) => {
                    try {
                        if (t.readyState === "live") t.stop();
                    } catch { }
                });
            } catch { }
            try { lastCameraTrackRef.current = null; } catch { }
            try { faceFilterRawTrackRef.current = null; } catch { }
            try { faceFilterOutTrackRef.current = null; } catch { }
            try { avatarRawTrackRef.current = null; } catch { }
            try { avatarOutTrackRef.current = null; } catch { }
            try { canvasPipelineOutTrackRef.current = null; } catch { }

            // ✅ 숨겨진 video/audio 엘리먼트가 stream을 잡고 있지 않도록 srcObject 해제
            try {
                document.querySelectorAll("video").forEach((v) => {
                    try { if (v?.srcObject) v.srcObject = null; } catch { }
                });
                document.querySelectorAll("audio").forEach((a) => {
                    try { if (a?.srcObject) a.srcObject = null; } catch { }
                });
            } catch { }

            // ✅ audioElsRef 정리 (new Audio()는 DOM에 없어서 querySelectorAll로 잡히지 않음)
            try {
                audioElsRef.current.forEach((a) => {
                    try { a.pause(); } catch { }
                    try { a.srcObject = null; } catch { }
                });
                audioElsRef.current.clear();
            } catch { }

            // ✅ 공유 AudioContext 닫기 + 잠금 (브라우저 빨간원 제거)
            closeSharedAudioContext();

            // ❗ 통화 종료 시에만 회의 상태 종료
            endMeeting();
        };
    }, [endMeeting, stopFaceEmojiFilter, stopAvatarFilter, roomId, userId]);

    useEffect(() => {
        const handler = () => {
            const video = document.querySelector('video[data-main-video="main"]');
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

    // 🔥 PiP 자동 종료 로직 완전 비활성화
    // canvas 기반 스트림은 탭 전환 시 브라우저가 track 상태를 변경할 수 있으므로
    // 자동 종료 기능을 비활성화하여 PiP 안정성 보장
    // (브라우저가 자체적으로 필요 시 PiP를 종료함)

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
                        // ✅ room:sync payload는 환경에 따라 micOn/cameraOn 필드가 없을 수 있음.
                        // 값이 undefined인데도 "!peer.cameraOn"처럼 계산하면 카메라 OFF로 오판 → 스트림 삭제 → 아바타 타일 튐.
                        const hasMicOn = typeof peer.micOn === "boolean";
                        const hasCameraOn = typeof peer.cameraOn === "boolean";
                        const hasMuted = typeof peer.muted === "boolean";
                        const hasCameraOff = typeof peer.cameraOff === "boolean";

                        const mutedFromPeer = hasMicOn
                            ? !peer.micOn
                            : (hasMuted ? peer.muted : undefined);

                        const cameraOffFromPeer = hasCameraOn
                            ? !peer.cameraOn
                            : (hasCameraOff ? peer.cameraOff : undefined);

                        setParticipants(prev =>
                            prev.map(p =>
                                String(p.id) === String(peer.peerId)
                                    ? {
                                        ...p,
                                        ...(typeof mutedFromPeer === "boolean" ? { muted: mutedFromPeer } : {}),
                                        ...(typeof cameraOffFromPeer === "boolean" ? { cameraOff: cameraOffFromPeer } : {}),
                                        isReconnecting: false,
                                        isLoading: false,
                                    }
                                    : p
                            )
                        );

                        // ❗ producer 없으면 절대 consume 시도 X
                        // cameraOn/cameraOff 정보가 "명확히" 꺼짐일 때만 consumer 제거
                        const cameraIsOff = (hasCameraOn && peer.cameraOn === false) || (hasCameraOff && peer.cameraOff === true);
                        if (cameraIsOff) {
                            removeVideoConsumer(peer.peerId);
                        }
                        const micIsOff = (hasMicOn && peer.micOn === false) || (hasMuted && peer.muted === true);
                        if (micIsOff) {
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

                // ✅ 재접속 완료: 다른 참가자들에게 알림
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: "USER_RECONNECTING",
                        userId: userId,
                        reconnecting: false,
                    }));
                    console.log("[MeetingPage] 재접속 완료 알림 전송");
                }

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
        if (sfuWs && sfuWs.readyState === WebSocket.OPEN) {
            sfuWs.send(JSON.stringify({
                action: "room:sync",
                requestId: safeUUID(),
            }));
        } else {
            console.warn("[room:sync] SFU WebSocket not ready, skipping send");
        }

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

    // 🔥 strip-item 클릭 이벤트에서 드래그인지 확인
    const handleStripItemClick = useCallback((e, participantId) => {
        // 드래그로 이동했다면 클릭 이벤트 무시
        if (isDraggingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        manuallySelectedRef.current = true;
        setActiveSpeakerId(participantId);
    }, []);

    useEffect(() => {
        return () => {
            joiningTimeoutRef.current.forEach((t) => clearTimeout(t));
            joiningTimeoutRef.current.clear();
        };
    }, []);

    useEffect(() => {
        // ✅ 탭 닫기/브라우저 종료 시 유예 없이 즉시 퇴장 — producer 먼저 끊어 상대 타일 즉시 제거
        const sendLeaveAndClose = () => {
            isLeavingRef.current = true;
            try {
                producersRef.current.forEach((p) => {
                    try { p.close(); } catch { }
                    if (p.appData?.type) safeSfuSend({ action: "closeProducer", data: { producerId: p.id } });
                });
                producersRef.current.clear();
            } catch { }
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "LEAVE" }));
                }
            } catch { }
            try {
                safeSfuSend({
                    action: "leave",
                    requestId: safeUUID(),
                    data: { roomId, peerId: userId },
                });
            } catch { }
            try { wsRef.current?.close(); } catch { }
            try { sfuWsRef.current?.close(); } catch { }
        };

        window.addEventListener("beforeunload", sendLeaveAndClose);
        window.addEventListener("pagehide", sendLeaveAndClose);

        return () => {
            window.removeEventListener("beforeunload", sendLeaveAndClose);
            window.removeEventListener("pagehide", sendLeaveAndClose);
        };
    }, [roomId, userId]);

    // 🔥 헤더 등에서 "모임 목록" 등 클릭 시: 퇴장(WS/SFU 즉시 끊기) 후 해당 경로로 이동 → 상대방 화면에서 내 타일 즉시 제거
    useEffect(() => {
        const handleLeaveAndNavigate = (e) => {
            const path = (e?.detail?.path || "/room").trim() || "/room";
            isLeavingRef.current = true;

            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "USER_STATE_CHANGE", userId, changes: { cameraOff: true, muted: true } }));
                    wsRef.current.send(JSON.stringify({ type: "LEAVE" }));
                }
            } catch { }
            try {
                producersRef.current.forEach((p) => {
                    try { p.close(); } catch { }
                    if (p.appData?.type) safeSfuSend({ action: "closeProducer", data: { producerId: p.id } });
                });
                producersRef.current.clear();
            } catch { }
            try {
                safeSfuSend({ action: "leave", requestId: safeUUID(), data: { roomId, peerId: userId } });
            } catch { }
            try { wsRef.current?.close(); } catch { }
            try { sfuWsRef.current?.close(); } catch { }
            wsRef.current = null;
            sfuWsRef.current = null;

            // ✅ pip 세션 키 제거 (언마운트 cleanup 스킵 방지)
            try { sessionStorage.removeItem("pip.roomId"); } catch { }
            try { sessionStorage.removeItem("pip.subjectId"); } catch { }

            // ✅ 카메라/필터 파이프라인 정리 (canvas pipeline + hidden video)
            try { turnOffCamera(); } catch { }

            // ✅ 로컬 미디어 트랙 정리
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
                localStreamRef.current = null;
            }
            // ✅ 화면공유 스트림 정리
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { } });
                screenStreamRef.current = null;
            }
            // ✅ 필터/파이프라인에서 분리된 원본/출력 트랙 stop (빨간원 방지)
            try {
                [
                    lastCameraTrackRef?.current,
                    faceFilterRawTrackRef?.current,
                    faceFilterOutTrackRef?.current,
                    avatarRawTrackRef?.current,
                    avatarOutTrackRef?.current,
                    canvasPipelineRawTrackRef?.current,
                    canvasPipelineOutTrackRef?.current,
                ].filter(Boolean).forEach((t) => {
                    try { if (t.readyState === "live") t.stop(); } catch { }
                });
            } catch { }
            try { lastCameraTrackRef.current = null; } catch { }
            try { faceFilterRawTrackRef.current = null; } catch { }
            try { faceFilterOutTrackRef.current = null; } catch { }
            try { avatarRawTrackRef.current = null; } catch { }
            try { avatarOutTrackRef.current = null; } catch { }
            try { canvasPipelineOutTrackRef.current = null; } catch { }
            // ✅ 남아있는 video/audio 엘리먼트의 srcObject 해제
            try {
                document.querySelectorAll("video").forEach((v) => {
                    try { if (v?.srcObject) v.srcObject = null; } catch { }
                });
                document.querySelectorAll("audio").forEach((a) => {
                    try { if (a?.srcObject) a.srcObject = null; } catch { }
                });
            } catch { }
            // ✅ audioElsRef 정리 (DOM 밖 Audio 요소)
            try {
                audioElsRef.current.forEach((a) => {
                    try { a.pause(); } catch { }
                    try { a.srcObject = null; } catch { }
                });
                audioElsRef.current.clear();
            } catch { }
            // ✅ 공유 AudioContext 닫기 + 잠금 (브라우저 빨간원 제거)
            closeSharedAudioContext();
            setLocalStream(null);
            setParticipants([]);
            setMessages([]);
            if (endMeeting) endMeeting();
            navigate(path);
        };

        window.addEventListener("meeting:leave-and-navigate", handleLeaveAndNavigate);
        return () => window.removeEventListener("meeting:leave-and-navigate", handleLeaveAndNavigate);
    }, [roomId, userId, navigate, endMeeting]);

    // 🔥 커스텀 PIP에서 나가기 이벤트 처리
    useEffect(() => {
        const handleLeaveFromPip = () => {
            console.log("[MeetingPage] PIP에서 나가기 이벤트 수신");
            isLeavingRef.current = true;

            // ✅ 0) 카메라가 켜져있다면 즉시 상태 전파 (타일 검게 변하는 현상 방지)
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: { cameraOff: true, muted: true },
                    }));
                }
            } catch { }

            // ✅ 1) SFU 로컬 정리 가속: Producer들을 즉시 닫아 상대방 Consumer들이 즉시 종료되게 함
            try {
                producersRef.current.forEach((p) => {
                    try { p.close(); } catch { }
                    if (p.appData?.type) {
                        safeSfuSend({ action: "closeProducer", data: { producerId: p.id } });
                    }
                });
                producersRef.current.clear();
            } catch { }

            // ✅ 2) LEAVE를 "확실히" 여러 번 보낸다 (패킷 유실/타이밍 대비)
            try {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    const leaveMsg = JSON.stringify({ type: "LEAVE" });
                    wsRef.current.send(leaveMsg);
                    setTimeout(() => {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(leaveMsg);
                        }
                    }, 50);
                }
            } catch { }

            // ✅ 3) SFU에도 leave를 보낸다
            try {
                safeSfuSend({
                    action: "leave",
                    requestId: safeUUID(),
                    data: { roomId, peerId: userId },
                });
            } catch { }

            // ✅ pip 세션 키 제거
            try { sessionStorage.removeItem("pip.roomId"); } catch { }
            try { sessionStorage.removeItem("pip.subjectId"); } catch { }

            // ✅ 4) 카메라/필터 파이프라인 즉시 정리 (빨간원 방지 - setTimeout 밖에서 즉시 실행)
            try { turnOffCamera(); } catch { }

            // ✅ 4-1) 필터/파이프라인에서 분리된 원본/출력 트랙 즉시 stop
            try {
                [
                    lastCameraTrackRef?.current,
                    faceFilterRawTrackRef?.current,
                    faceFilterOutTrackRef?.current,
                    avatarRawTrackRef?.current,
                    avatarOutTrackRef?.current,
                    canvasPipelineRawTrackRef?.current,
                    canvasPipelineOutTrackRef?.current,
                ].filter(Boolean).forEach((t) => {
                    try { if (t.readyState === "live") t.stop(); } catch { }
                });
            } catch { }
            try { lastCameraTrackRef.current = null; } catch { }
            try { faceFilterRawTrackRef.current = null; } catch { }
            try { faceFilterOutTrackRef.current = null; } catch { }
            try { avatarRawTrackRef.current = null; } catch { }
            try { avatarOutTrackRef.current = null; } catch { }
            try { canvasPipelineOutTrackRef.current = null; } catch { }

            // ✅ 5) 충분히 기다린 뒤 소켓 close 및 미디어 중지 (send 버퍼 flush 시간 확보)
            setTimeout(() => {
                try {
                    // 미디어 트랙 중지
                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach((t) => {
                            try { t.stop(); } catch { }
                        });
                        localStreamRef.current = null;
                    }
                    // 화면공유 스트림 정리
                    if (screenStreamRef.current) {
                        screenStreamRef.current.getTracks().forEach((t) => {
                            try { t.stop(); } catch { }
                        });
                        screenStreamRef.current = null;
                    }
                    setLocalStream(null);

                    // 남아있는 video/audio 엘리먼트의 srcObject 해제
                    try {
                        document.querySelectorAll("video").forEach((v) => {
                            try { if (v?.srcObject) v.srcObject = null; } catch { }
                        });
                        document.querySelectorAll("audio").forEach((a) => {
                            try { if (a?.srcObject) a.srcObject = null; } catch { }
                        });
                    } catch { }
                    // ✅ audioElsRef 정리 (DOM 밖 Audio 요소)
                    try {
                        audioElsRef.current.forEach((a) => {
                            try { a.pause(); } catch { }
                            try { a.srcObject = null; } catch { }
                        });
                        audioElsRef.current.clear();
                    } catch { }

                    // ✅ 공유 AudioContext 닫기 + 잠금 (브라우저 빨간원 제거)
                    closeSharedAudioContext();

                    // 소켓 및 트랜스포트 정리
                    try { wsRef.current?.close(); } catch { }
                    wsRef.current = null;

                    try { sfuWsRef.current?.close(); } catch { }
                    sfuWsRef.current = null;

                    try { sendTransportRef.current?.close(); } catch { }
                    sendTransportRef.current = null;
                    try { recvTransportRef.current?.close(); } catch { }
                    recvTransportRef.current = null;

                    try { sfuDeviceRef.current?.close?.(); } catch { }
                    sfuDeviceRef.current = null;

                    setParticipants([]);
                    setMessages([]);
                } catch (e) {
                    console.warn("[MeetingPage] PIP 나가기 정리 중 오류:", e);
                }
            }, 300);
        };

        window.addEventListener("meeting:leave-from-pip", handleLeaveFromPip);

        return () => {
            window.removeEventListener("meeting:leave-from-pip", handleLeaveFromPip);
        };
    }, [roomId, userId]);

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

                    // 🔥 스트림이 실제로 존재하고 live 상태면 재접속 상태 해제
                    const hasLiveStream = p.stream && p.stream.getVideoTracks().some(t => t.readyState === "live");
                    if (hasLiveStream) {
                        if (reconnectHistoryRef.current.has(peerId)) {
                            console.log(`✅ [RECONNECT COMPLETED] ${p.name} (${peerId}) - live stream detected`);
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

                    // 🔥 재접속 상태가 5초 이상 지속되면 자동으로 해제 (무한 스피너 방지)
                    if (elapsed > 5000) {
                        console.log(`⚠️ [RECONNECT TIMEOUT] ${p.name} (${peerId}) - auto-clearing after ${elapsed}ms`);
                        if (reconnectHistoryRef.current.has(peerId)) {
                            reconnectHistoryRef.current.delete(peerId);
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
        // send transport가 아직 준비되지 않았을 수 있으므로 즉시 + 지연 재시도
        ensureLocalProducers();
        const t1 = setTimeout(() => ensureLocalProducers(), 200);
        const t2 = setTimeout(() => ensureLocalProducers(), 600);

        // 오디오 트랙이 없으면 볼륨 분석을 건너뜀 (화면 공유 시 오디오 트랙이 없을 수 있음)
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) {
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }

        // ✅ 공유 AudioContext 사용 (suspended 방지·리소스 절약), 브라우저 정책으로 인한 말하기 감지 실패 방지
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const source = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        let speaking = false;
        let rafId = null;
        const checkVolume = () => {
            if (ctx.state === "suspended") ctx.resume().catch(() => { });
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
            rafId = requestAnimationFrame(checkVolume);
        };
        checkVolume();
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            if (rafId != null) cancelAnimationFrame(rafId);
            try { source.disconnect(); analyser.disconnect(); } catch { }
        };
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

    // 🔥 localStream이 설정되면 participants의 '나' 타일에 반영 (내 카메라가 보이게)
    useEffect(() => {
        if (!localStream) return;
        setParticipants((prev) =>
            prev.map((p) =>
                p.isMe ? { ...p, stream: localStream, isLoading: false, isJoining: false } : p
            )
        );
    }, [localStream]);

    // 1️⃣ Signaling WebSocket (8080)
    useEffect(() => {
        // roomId·userEmail만 있으면 연결 (hostUserEmail 없어도 입장·타일 표시 가능, 방장 여부는 로딩 후 반영)
        if (!roomId || !userEmail) {
            console.log("[WS] 대기 중 - roomId:", roomId, "userEmail:", userEmail);
            return;
        }

        let ws = null;
        let pingInterval = null; // 💓 핑 타이머 변수

        const connect = () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            // ✅ https ? wss : ws
            // ✅ nginx 리버스 프록시를 통해 연결 (포트 생략 → 443/80 기본 포트 사용)
            // ✅ 같은 URL이면 같은 방: WebSocket roomId는 URL의 roomId를 그대로 사용
            const wsRoomId = roomId;
            // ✅ dev(http)에서도 백엔드(8080)로 WS 연결되게 고정
            // - http: ws://{hostname}:8080/ws/room/{roomId}
            // - https: wss://{hostname}/ws/room/{roomId} (nginx 프록시)
            const base = toWsBackendUrl(`/ws/room/${wsRoomId}`, 8080);
            // ✅ 배경제거/이모지 상태도 서버에 전달 (입장 시 복원용)
            const initialFaceEmoji = faceEmojiRef.current || localStorage.getItem("faceEmoji") || "";
            const initialBgRemove = bgRemoveRef.current ?? (localStorage.getItem("faceBgRemove") === "true");
            const wsUrl = `${base}` +
                `?userId=${encodeURIComponent(userId)}` +
                `&userName=${encodeURIComponent(userName)}` +
                `&userEmail=${encodeURIComponent(userEmail || "")}` +
                `&muted=${!micOnRef.current}` +
                `&cameraOff=${!camOnRef.current}` +
                `&isHost=${isHostLocal}` +
                `&title=${encodeURIComponent(roomTitle || "")}` +
                (subjectId ? `&subjectId=${encodeURIComponent(subjectId)}` : "") +
                (scheduleId != null && scheduleId !== "" ? `&scheduleId=${encodeURIComponent(String(scheduleId))}` : "") +
                (initialFaceEmoji ? `&faceEmoji=${encodeURIComponent(initialFaceEmoji)}` : "") +
                `&bgRemove=${!!initialBgRemove}`;

            if (!subjectId && roomId) {
                console.warn("[MeetingPage] WebSocket 연결 시 subjectId 없음 → DB 저장 시 subject_id 비어갈 수 있음. roomId=", roomId);
            }
            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ SPRING WS CONNECTED");
                setChatConnected(true);

                // 연결 직후 현재 상태 전송 (초기 동기화) — 권한 denied면 다른 참가자에게도 off 아이콘 보이도록
                const sendInitialState = () => {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;

                    const muted = !micOnRef.current || micPermissionRef.current === "denied";
                    const cameraOff = !camOnRef.current || camPermissionRef.current === "denied";
                    const faceEmojiState = faceEmojiRef.current || "";
                    const bgRemoveState = !!bgRemoveRef.current;
                    ws.send(JSON.stringify({
                        type: "USER_STATE_CHANGE",
                        userId,
                        changes: { muted, cameraOff, faceEmoji: faceEmojiState || null, bgRemove: bgRemoveState },
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

                // 강퇴된 유저 재입장 시 서버가 거부한 경우
                if (data.type === "REJECTED" && data.reason === "KICKED_TODAY") {
                    setToastMessage("오늘 이 방에서 내보내기되어 입장할 수 없습니다.");
                    setShowToast(true);
                    isLeavingRef.current = true;
                    try { wsRef.current?.close(); } catch { }
                    setTimeout(() => navigate(`/lms/${subjectId}`), 1500);
                    return;
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

                if (data.type === "ROOM_ELAPSED" && data.elapsedMs != null) {
                    const totalSec = Math.max(0, Math.floor(Number(data.elapsedMs) / 1000));
                    const h = Math.floor(totalSec / 3600);
                    const m = Math.floor((totalSec % 3600) / 60);
                    const s = totalSec % 60;
                    setElapsedTimeDisplay([h, m, s].map((n) => String(n).padStart(2, "0")).join(":"));
                    return;
                }

                if (data.type === "USERS_UPDATE" && Array.isArray(data.users)) {
                    data.users.forEach((u) => {
                        const name = u.userName || "";
                        peerIdToNameRef.current.set(String(u.userId), name);
                        if (u.connectionId != null) peerIdToNameRef.current.set(String(u.connectionId), name);
                    });
                    if (data.roomStartedAt != null) setRoomStartedAt(Number(data.roomStartedAt));
                    if (data.roomElapsedMs != null) {
                        const totalSec = Math.max(0, Math.floor(Number(data.roomElapsedMs) / 1000));
                        const h = Math.floor(totalSec / 3600);
                        const m = Math.floor((totalSec % 3600) / 60);
                        const s = totalSec % 60;
                        setElapsedTimeDisplay([h, m, s].map((n) => String(n).padStart(2, "0")).join(":"));
                    }
                    setParticipants((prev) => {
                        const prevMap = new Map(prev.map((p) => [String(p.id), p]));
                        // connectionId 있으면 참가자 고유 id로 사용 (동일 userId가 둘 이상일 때 타일 구분)
                        const newServerIds = new Set(data.users.map((u) => {
                            const cid = u.connectionId != null ? String(u.connectionId) : null;
                            return cid || String(u.userId);
                        }));
                        const now = Date.now();
                        const updatedUsers = data.users.map((u) => {
                            const participantId = u.connectionId != null ? String(u.connectionId) : String(u.userId);
                            const peerId = String(u.userId);
                            const old = prevMap.get(participantId) || prevMap.get(peerId);

                            // 🔥 서버에 다시 나타났으면 missing 기록 제거
                            missingSinceRef.current.delete(peerId);

                            // 재접속 완료된 경우 이력 정리
                            if (!old && reconnectHistoryRef.current.has(peerId)) {
                                reconnectHistoryRef.current.delete(peerId);
                            }
                            if (reconnectTimeoutRef.current.has(peerId)) {
                                clearTimeout(reconnectTimeoutRef.current.get(peerId));
                                reconnectTimeoutRef.current.delete(peerId);
                            }

                            const isMe = peerId === String(userId);
                            const isOfflineFromServer = u.online === false;

                            // 스트림 복구 (React 상태 갱신 전 Ref 확인)
                            // 🔥 refStream(peerStreamsRef)을 우선 사용: 오디오 트랙이 나중에 추가된 경우를 반영
                            const refStream = peerStreamsRef.current.get(peerId);
                            const currentStream = refStream || old?.stream || null;

                            // 🔥 최우선 보호 규칙: live stream이 있으면 무조건 유지 (PIP 모드 전환 시 깜빡임 방지)
                            // 단, 서버가 online=false(재접속 중)로 보낸 유저는 live여도 재접속 스피너 표시
                            if (!isMe && currentStream && !isOfflineFromServer) {
                                const hasLiveStream = currentStream.getVideoTracks().some(t => t.readyState === "live");
                                if (hasLiveStream) {
                                    // live stream이 있으면 재접속 상태로 표시하지 않고 스트림 유지
                                    // 🔥 핵심 수정: peerStreamsRef의 최신 스트림(currentStream) 직접 사용
                                    // 오디오 트랙이 포함된 스트림이 반영되도록 함
                                    return {
                                        ...old,
                                        id: participantId,
                                        userId: peerId,
                                        name: u.userName,
                                        joinAt: u.joinAt,
                                        isMe: false,
                                        muted: typeof u.muted === "boolean" ? u.muted : (old?.muted ?? false),
                                        cameraOff: typeof u.cameraOff === "boolean" ? u.cameraOff : (old?.cameraOff ?? true),
                                        mutedByHost: !!u.mutedByHost || !!(old?.mutedByHost),
                                        cameraOffByHost: !!u.cameraOffByHost || !!(old?.cameraOffByHost),
                                        faceEmoji: u.faceEmoji != null ? u.faceEmoji : (old?.faceEmoji ?? null),
                                        bgRemove: typeof u.bgRemove === "boolean" ? u.bgRemove : (old?.bgRemove ?? false),
                                        stream: currentStream,
                                        screenStream: old?.screenStream ?? null,
                                        isScreenSharing: old?.isScreenSharing ?? false,
                                        reaction: old?.reaction ?? null,
                                        speaking: typeof u.speaking === "boolean" ? u.speaking : (old?.speaking ?? false),
                                        isReconnecting: false,
                                        isLoading: false,
                                        isJoining: false,
                                        lastUpdate: Date.now(),
                                        reconnectStartedAt: undefined
                                    };
                                }
                            }

                            // 변수 선언 순서 수정 (ReferenceError 방지)
                            const isOnline = u.online === true;
                            if (isOnline) everOnlineRef.current.add(peerId);
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

                            // 🔥 새로고침 시: 서버가 online=false로 보내면 타일 유지 + "재접속 중" 스피너 표시
                            // 서버 online=false면 무조건 재접속 스피너 (everOnlineRef 보조), live 스트림이어도 표시
                            const hasLiveStream = currentStream && currentStream.getVideoTracks().some(t => t.readyState === "live");
                            const shouldShowReconnecting = !isMe && !!old && !recentlyCompleted && (isOfflineFromServer || (isOffline && !hasLiveStream));

                            // ✅ 서버 online 플래그가 일시적으로 false로 튀더라도,
                            // SFU/브라우저 쪽 미디어 스트림이 살아있으면 stream을 null로 만들지 않는다.
                            const keepMediaWhileOffline = !!currentStream;
                            // 🔥 스트림이 live 상태면 무조건 유지 (PIP 모드 전환 시 깜빡임 방지)
                            // hasLiveStream은 위에서 이미 선언됨
                            const shouldKeepStream = keepMediaWhileOffline || hasLiveStream || (old?.stream && old.stream.getVideoTracks().some(t => t.readyState === "live"));

                            // 🔥 핵심: live stream이 있으면 절대 null로 설정하지 않음 (검은 화면 방지)
                            // 🔥 핵심 수정: peerStreamsRef의 최신 스트림(currentStream) 직접 사용하여 오디오 트랙 포함 보장
                            const finalStream = hasLiveStream ? (currentStream || old?.stream || null) :
                                ((shouldShowReconnecting && !shouldKeepStream) ? null : (currentStream || old?.stream || null));
                            const finalScreenStream = hasLiveStream ? (old?.screenStream ?? null) :
                                ((shouldShowReconnecting && !shouldKeepStream) ? null : (old?.screenStream ?? null));
                            const finalIsScreenSharing = hasLiveStream ? (old?.isScreenSharing ?? false) :
                                ((shouldShowReconnecting && !shouldKeepStream) ? false : (old?.isScreenSharing ?? false));

                            // 🔥 나(isMe)는 항상 로컬 스트림 사용 (USERS_UPDATE 시 ref가 아직 안 채워졌을 수 있으므로 old?.stream 유지)
                            const myStream = isMe ? (localStreamRef.current ?? old?.stream ?? null) : finalStream;
                            const myScreenStream = isMe ? (screenStreamRef.current || null) : finalScreenStream;
                            const myIsScreenSharing = isMe ? !!screenStreamRef.current : finalIsScreenSharing;

                            const baseUser = {
                                id: participantId,
                                userId: peerId,
                                name: u.userName,
                                joinAt: u.joinAt,
                                isMe,
                                // 👑 방장 여부 (서버에서 받은 값 사용)
                                isHost: typeof u.host === "boolean" ? u.host : (old?.isHost ?? false),
                                // ✅ 서버가 muted/cameraOff를 "항상" 내려주지 않는 경우가 있어,
                                // 값이 없으면 기존 값을 유지해야 아이콘 타일로 튀지 않음.
                                muted: isMe
                                    ? !micOnRef.current
                                    : (typeof u.muted === "boolean" ? u.muted : (old?.muted ?? false)),
                                cameraOff: isMe
                                    ? !camOnRef.current
                                    : (typeof u.cameraOff === "boolean" ? u.cameraOff : (old?.cameraOff ?? true)),
                                mutedByHost: !!u.mutedByHost || !!(old?.mutedByHost),
                                cameraOffByHost: !!u.cameraOffByHost || !!(old?.cameraOffByHost),
                                faceEmoji: u.faceEmoji != null ? u.faceEmoji : (old?.faceEmoji ?? null),
                                bgRemove: typeof u.bgRemove === "boolean" ? u.bgRemove : (old?.bgRemove ?? false),

                                // 🔥 핵심: live stream이 있으면 절대 null로 설정하지 않음 (검은 화면 방지)
                                // 🔥 isMe면 로컬 스트림으로 내 카메라가 보이게 함
                                stream: myStream,
                                screenStream: myScreenStream,
                                isScreenSharing: myIsScreenSharing,

                                reaction: old?.reaction ?? null,
                                // ✅ 서버 USERS_UPDATE의 speaking 사용 → 기존 유저(A)도 새 유저(B) 말할 때 파란 깜빡임 표시
                                speaking: typeof u.speaking === "boolean" ? u.speaking : (old?.speaking ?? false),

                                isJoining: false,
                                isReconnecting: shouldShowReconnecting,
                                isLoading: shouldShowReconnecting,
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

                        // 방장 강제 마이크/카메라 상태 동기화 (본인)
                        const meUser = data.users.find((u) => String(u.userId) === String(userId));
                        if (meUser) {
                            setMutedByHostMe(!!meUser.mutedByHost);
                            setCameraOffByHostMe(!!meUser.cameraOffByHost);
                        }

                        // -------------------------------------------------------------
                        // 2. [서버 목록에서 빠진 사용자 보호] - PIP 모드 전환 시 타일 깜빡임 방지
                        // -------------------------------------------------------------
                        // 🔥 서버 목록에서 빠진 사용자 보호 로직 (3초 유예 시간)
                        const retainedUsers = prev.filter((p) => {
                            const peerId = String(p.id);

                            // 서버에 있으면 당연히 유지 (updatedUsers에서 처리됨)
                            if (newServerIds.has(peerId)) return false;

                            // 나는 절대 제거 안 함
                            if (p.isMe) return true;

                            // 🔥 최우선 보호 규칙: live stream이 있으면 무조건 유지 (PIP 모드 전환 시 깜빡임 방지)
                            const hasLiveStream = p.stream && p.stream.getVideoTracks().some(t => t.readyState === "live");
                            if (hasLiveStream) {
                                // live stream이 있으면 missing 기록 제거하고 유지
                                missingSinceRef.current.delete(peerId);
                                console.log(`🛡️ [LIVE STREAM PROTECTED] ${p.name} (${peerId}) - has live stream, keeping`);
                                return true;
                            }

                            // 🔥 처음 빠진 시점 기록
                            if (!missingSinceRef.current.has(peerId)) {
                                missingSinceRef.current.set(peerId, now);
                                console.log(`⏱️ [MISSING RECORDED] ${p.name} (${peerId}) - first missing, starting timer`);
                                return true;
                            }

                            const missingFor = now - missingSinceRef.current.get(peerId);

                            // 🔥 3초 유예 시간 (PIP / 라우트 전환 보호)
                            if (missingFor < 3000) {
                                console.log(`⏳ [MISSING PROTECTED] ${p.name} (${peerId}) - missing for ${missingFor}ms, keeping`);
                                return true;
                            }

                            // ❌ 진짜 나감 (3초 이상 서버 목록에 없음)
                            missingSinceRef.current.delete(peerId);
                            console.log(`❌ [REMOVING] ${p.name} (${peerId}) - missing for ${missingFor}ms, removing`);
                            return false;
                        });

                        // -------------------------------------------------------------
                        // 3. [Ghost Retention] 서버 목록엔 없지만, 로컬에 있던 유저 살리기 (기존 로직)
                        // -------------------------------------------------------------
                        // 🔥 retainedUsers는 이미 서버 목록에서 빠진 사용자를 보호한 결과이므로
                        // 추가 필터링 없이 그대로 유지 (retainedUsers에서 이미 보호 로직 적용됨)
                        const ghostUsers = retainedUsers.map(p => {
                            // 활성 consumer가 있는지 확인
                            const peerId = String(p.id);
                            const hasActiveConsumer = Array.from(consumersRef.current.values()).some(
                                (c) => String(c.appData?.peerId) === peerId && !c.closed
                            );

                            // 🔥 스트림이 실제로 존재하고 live 상태인지 확인
                            const hasLiveStream = p.stream && p.stream.getVideoTracks().some(t => t.readyState === "live");

                            // 🔥 핵심: live stream이 있으면 절대 stream을 null로 설정하지 않음 (검은 화면 방지)
                            // 🔥 스트림이 live 상태면 재접속 상태 해제 (consumer가 없어도 스트림이 작동 중이면 OK)
                            // 카메라가 꺼져 있으면(cameraOff) 재접속 상태 아님 (정상 상태)
                            const shouldBeReconnecting = p.isMe ? false
                                : (p.isReconnecting && !hasActiveConsumer && !hasLiveStream && !p.cameraOff);

                            return {
                                ...p,
                                // 스트림이 live 상태이거나 consumer가 있으면 재접속 중이 아님
                                isReconnecting: shouldBeReconnecting,
                                // 🔥 핵심: live stream이 있으면 절대 null로 설정하지 않음 (검은 화면 방지)
                                stream: p.isMe ? p.stream : (hasLiveStream ? p.stream : (hasActiveConsumer ? p.stream : null)),
                                screenStream: p.isMe ? p.screenStream : (p.isScreenSharing ? p.screenStream : null),
                                isScreenSharing: p.isMe ? p.isScreenSharing : (p.screenStream ? true : false),
                                reconnectStartedAt: p.isMe ? undefined : (shouldBeReconnecting ? (p.reconnectStartedAt || Date.now()) : undefined)
                            };
                        });

                        // -------------------------------------------------------------
                        // 4. 최종 병합 - 기존 순서 유지 (PiP 시 타일 재마운트/검은화면 방지)
                        // -------------------------------------------------------------
                        // 🔥 [...updatedUsers, ...ghostUsers] 시 서버에서 잠깐 빠진 참가자가 끝으로 밀려
                        //    순서가 바뀌어 타일이 언마운트 후 재마운트되며 검은화면 발생 → prev 순서 유지
                        const updatedMap = new Map(updatedUsers.map((u) => [String(u.id), u]));
                        const ghostMap = new Map(ghostUsers.map((u) => [String(u.id), u]));
                        const mergedUsers = [];
                        const usedIds = new Set();
                        // 1) prev 순서대로: 기존 참가자는 같은 인덱스 유지 (타일 재마운트 방지)
                        for (const p of prev) {
                            const id = String(p.id);
                            const u = updatedMap.get(id) ?? ghostMap.get(id);
                            if (u) {
                                mergedUsers.push(u);
                                usedIds.add(id);
                            }
                        }
                        // 2) 서버에만 있는 신규 참가자 추가
                        for (const u of updatedUsers) {
                            const id = String(u.id);
                            if (!usedIds.has(id)) {
                                mergedUsers.push(u);
                                usedIds.add(id);
                            }
                        }
                        // 3) ghost만 있는 참가자(서버에서 빠졌지만 보호된 경우) 추가
                        for (const u of ghostUsers) {
                            const id = String(u.id);
                            if (!usedIds.has(id)) mergedUsers.push(u);
                        }

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
                    // ✅ cameraOff=true가 명시되면, 상대방 UI는 반드시 "카메라 꺼짐(아바타 타일)"로 전환되어야 함.
                    // stream을 그대로 두면 마지막 프레임이 멈춘 채 남을 수 있으니 consumer/stream도 함께 정리한다.
                    try {
                        if (data?.changes && data.changes.cameraOff === true) {
                            removeVideoConsumer(String(data.userId));

                            // ✅ PiP에서 "카메라 OFF"를 정확히 감지하기 위해 전역 이벤트 발행
                            // (DOM/트랙 기반 판정은 초기 진입 시 레이스로 오판 가능)
                            try {
                                window.dispatchEvent(new CustomEvent("meeting:peer-camera-off", {
                                    detail: { peerId: String(data.userId) }
                                }));
                            } catch { }
                        }
                    } catch { }

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
                    if (peerId === String(userId)) return; // 본인은 무시 (본인 타일에는 스피너 표시 안 함)

                    const reconnecting = data.reconnecting !== false; // 기본값은 true

                    setParticipants(prev =>
                        prev.map(p => {
                            if (String(p.id) !== peerId) return p;

                            // 🔥 스트림이 live 상태면 재접속 상태로 설정하지 않음 (PIP 모드 전환 시 깜빡임 방지)
                            const hasLiveStream = p.stream && p.stream.getVideoTracks().some(t => t.readyState === "live");
                            if (hasLiveStream && reconnecting) {
                                console.log(`[MeetingPage] USER_RECONNECTING 무시: ${peerId} - live stream exists`);
                                return p; // 스트림이 live 상태면 상태 변경하지 않음
                            }

                            return {
                                ...p,
                                isReconnecting: reconnecting,
                                isLoading: reconnecting, // 재접속 중일 때만 로딩 표시
                                reconnectStartedAt: reconnecting ? (p.reconnectStartedAt || Date.now()) : undefined,
                            };
                        })
                    );
                    console.log(`[MeetingPage] USER_RECONNECTING: ${peerId} = ${reconnecting}`);
                    return;
                }

                // ============================================
                // 👑 임시 방장 선정 알림
                // ============================================
                if (data.type === "HOST_CHANGED") {
                    const { newHostUserId, newHostUserName } = data;
                    console.log(`👑 [HOST_CHANGED] 새 방장: ${newHostUserName} (${newHostUserId})`);

                    // 참여자 목록에서 방장 플래그 업데이트
                    setParticipants(prev =>
                        prev.map(p => ({
                            ...p,
                            isHost: String(p.id) === String(newHostUserId)
                        }))
                    );

                    // 토스트 메시지 표시
                    setToastMessage(`${newHostUserName}님이 방장이 되었습니다.`);
                    setShowToast(true);
                    return;
                }

                // ============================================
                // 🔇 방장이 마이크 강제 끄기
                // ============================================
                if (data.type === "FORCE_MUTE") {
                    const { targetUserId, hostName } = data;
                    console.log(`🔇 [FORCE_MUTE] ${hostName}님이 ${targetUserId}의 마이크를 껐습니다.`);

                    // 내가 대상이면 마이크 끄기 + 스스로 켤 수 없음 (로컬 저장으로 재접속 시에도 유지)
                    if (String(targetUserId) === String(userId)) {
                        setMicOn(false);
                        try { localStorage.setItem("micOn", "false"); } catch { }
                        setMutedByHostMe(true);
                        setToastMessage(`${hostName}님이 마이크를 껐습니다.`);
                        setShowToast(true);
                    }

                    // 참여자 목록 업데이트
                    setParticipants(prev =>
                        prev.map(p =>
                            String(p.id) === String(targetUserId)
                                ? { ...p, muted: true, mutedByHost: true }
                                : p
                        )
                    );
                    return;
                }

                // ============================================
                // 📷 방장이 카메라 강제 끄기
                // ============================================
                if (data.type === "FORCE_CAMERA_OFF") {
                    const { targetUserId, hostName } = data;
                    console.log(`📷 [FORCE_CAMERA_OFF] ${hostName}님이 ${targetUserId}의 카메라를 껐습니다.`);

                    // 내가 대상이면 실제로 카메라 끄기(파이프라인/프로듀서 정리) + 스스로 켤 수 없음
                    // turnOffCamera()를 호출해야 나중에 사용자가 켤 때 첫 번째 시도에 정상 켜짐 (stale pipeline 방지)
                    if (String(targetUserId) === String(userId)) {
                        setCameraOffByHostMe(true);
                        setToastMessage(`${hostName}님이 카메라를 껐습니다.`);
                        setShowToast(true);
                        turnOffCamera();
                    }

                    // 참여자 목록 업데이트
                    setParticipants(prev =>
                        prev.map(p =>
                            String(p.id) === String(targetUserId)
                                ? { ...p, cameraOff: true, cameraOffByHost: true }
                                : p
                        )
                    );
                    return;
                }

                // 방장이 마이크 켜기 허용 (참가자에게 허용/거절 확인 모달 — 프라이버시 보호)
                if (data.type === "FORCE_UNMUTE") {
                    const { targetUserId, hostName } = data;
                    console.log(`🔊 [FORCE_UNMUTE] ${hostName}님이 ${targetUserId}의 마이크를 켜 주었습니다.`);

                    setParticipants(prev =>
                        prev.map(p =>
                            String(p.id) === String(targetUserId)
                                ? { ...p, muted: false, mutedByHost: false }
                                : p
                        )
                    );

                    if (String(targetUserId) === String(userId)) {
                        setMutedByHostMe(false);
                        setForceUnmuteRequest({ hostName });
                    }
                    return;
                }

                // 방장이 카메라 켜기 허용 (참가자에게 허용/거절 확인 — 프라이버시 보호)
                if (data.type === "FORCE_CAMERA_ON") {
                    const { targetUserId, hostName } = data;
                    console.log(`📷 [FORCE_CAMERA_ON] ${hostName}님이 ${targetUserId}의 카메라를 켜 주었습니다.`);

                    // 참여자 목록은 먼저 갱신(방장이 켜기 허용 → cameraOffByHost 해제)
                    setParticipants(prev =>
                        prev.map(p =>
                            String(p.id) === String(targetUserId)
                                ? { ...p, cameraOff: false, cameraOffByHost: false }
                                : p
                        )
                    );

                    if (String(targetUserId) === String(userId)) {
                        setCameraOffByHostMe(false);
                        setForceCameraOnRequest({ hostName });
                    }
                    return;
                }

                // ============================================
                // 🚪 방장이 강퇴
                // ============================================
                if (data.type === "KICKED") {
                    const { targetUserId, targetUserName, hostName } = data;
                    console.log(`🚪 [KICKED] ${hostName}님이 ${targetUserName}을 강퇴했습니다.`);

                    // 내가 강퇴당했으면 회의 종료
                    if (String(targetUserId) === String(userId)) {
                        setToastMessage(`${hostName}님이 회의에서 내보냈습니다.`);
                        setShowToast(true);
                        // 잠시 후 회의 종료 - isLeavingRef 설정 후 navigate로 이동
                        setTimeout(() => {
                            isLeavingRef.current = true;
                            try {
                                if (wsRef.current?.readyState === WebSocket.OPEN) {
                                    wsRef.current.send(JSON.stringify({ type: "LEAVE" }));
                                }
                            } catch { }
                            navigate(`/lms/${subjectId}`);
                        }, 1500);
                        return;
                    }

                    // 다른 사람이 강퇴당했으면 토스트 표시
                    setToastMessage(`${targetUserName}님이 회의에서 나갔습니다.`);
                    setShowToast(true);

                    // 참여자 목록에서 제거 (USERS_UPDATE에서도 처리되지만 즉시 반영)
                    setParticipants(prev =>
                        prev.filter(p => String(p.id) !== String(targetUserId))
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
    }, [roomId, subjectId, userId, userName, userEmail, isHostLocal, roomTitle]); // subjectId 포함 시 DB 저장용

    useEffect(() => {
        setParticipants((prev) =>
            prev.map((p) => (p.isMe ? { ...p, speaking: isSpeaking } : p))
        );
    }, [isSpeaking]);

    // 다른 참가자 타일에서 오디오 레벨로 감지한 speaking을 participants 상태에 반영 (파란 테두리 유지)
    const handleSpeakingChange = useCallback((peerId, value) => {
        if (peerId == null) return;
        setParticipants((prev) =>
            prev.map((p) => (String(p.id) === String(peerId) ? { ...p, speaking: !!value } : p))
        );
    }, []);

    // 2️⃣ SFU WebSocket (nginx proxy → wss://onsil.study/sfu , 포트 없음)
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

        // ✅ 재접속 시작: 다른 참가자들에게 알림 (로컬 타일에는 스피너 표시 안 함)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "USER_RECONNECTING",
                userId: userId,
                reconnecting: true,
            }));
            console.log("[MeetingPage] 재접속 시작 알림 전송");
        }

        // 재연결 시 이전 transport/device 정리 (끊김 후 재연결)
        if (sfuWsRef.current != null) {
            try { sendTransportRef.current?.close(); } catch { }
            try { recvTransportRef.current?.close(); } catch { }
            try { sfuDeviceRef.current?.close?.(); } catch { }
            sendTransportRef.current = null;
            recvTransportRef.current = null;
            sfuDeviceRef.current = null;
        }
        const sfuWsUrl = getSfuWsUrl();
        if (process.env.NODE_ENV !== "test") {
            console.log("[SFU] Connecting to", sfuWsUrl, "(no :4000 – nginx proxy)");
        }
        const sfuWs = new WebSocket(sfuWsUrl);
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
            // ✅ 같은 URL이면 같은 방: SFU roomId도 URL의 roomId를 그대로 사용
            const sfuRoomId = roomId;
            safeSfuSend({
                action: "join",
                requestId: safeUUID(),
                data: { roomId: sfuRoomId, peerId: userId },
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

                // RTCPeerConnection에 STUN/TURN 주입 (패턴 A + B 호환)
                const transportOptions = {
                    id: transportId,
                    iceParameters,
                    iceCandidates,
                    dtlsParameters,
                    iceServers: ICE_SERVERS,
                    pcConfig: { iceServers: ICE_SERVERS },
                };

                // ✅ TURN 적용 확인 로그
                if (process.env.NODE_ENV !== "test") {
                    console.log(`[transport] Creating ${direction} transport with ICE_SERVERS:`, {
                        stun: ICE_SERVERS.find(s => s.urls.includes("stun:")),
                        turn: ICE_SERVERS.find(s => Array.isArray(s.urls) && s.urls.some(u => u.includes("turn:"))),
                    });
                }

                if (direction === "send") {
                    const sendTransport = device.createSendTransport(transportOptions);

                    // ⭐ TURN 강제 주입 (mediasoup Transport 생성 후 PC config 고정이므로 setConfiguration 필요)
                    if (sendTransport?._handler?._pc) {
                        const pc = sendTransport._handler._pc;
                        const currentConfig = pc.getConfiguration();
                        pc.setConfiguration({
                            ...currentConfig,
                            iceServers: ICE_SERVERS,
                        });
                        console.log("✅ TURN injected into sendTransport PC");
                    }

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
                    // 로컬 스트림이 아직 없을 수 있으므로 즉시 + 지연 재시도 (상대방에게 카메라/오디오 전달 보장)
                    ensureLocalProducers();
                    setTimeout(() => ensureLocalProducers(), 100);
                    setTimeout(() => ensureLocalProducers(), 500);
                    setTimeout(() => ensureLocalProducers(), 1200);
                }

                if (direction === "recv") {
                    const recvTransport = device.createRecvTransport(transportOptions);

                    // ⭐ TURN 강제 주입 (mediasoup Transport 생성 후 PC config 고정이므로 setConfiguration 필요)
                    if (recvTransport?._handler?._pc) {
                        const pc = recvTransport._handler._pc;
                        const currentConfig = pc.getConfiguration();
                        pc.setConfiguration({
                            ...currentConfig,
                            iceServers: ICE_SERVERS,
                        });
                        console.log("✅ TURN injected into recvTransport PC");
                    }

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

                    // ✅ roomReconnecting 유지 → room:sync useEffect가 recvTransportReady 변경 감지 후 room:sync 전송
                    // room:sync:response 수신 후 setRoomReconnecting(false) 및 hasFinishedInitialSyncRef 설정
                    bumpStreamVersion();
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

                // ⚠️ 중요:
                // producerClosed는 "트랙 교체/재-produce" 과정에서도 자주 발생할 수 있음.
                // 여기서 cameraOff=true + stream=null로 확정해버리면,
                // 새 producer를 놓치거나 지연될 때 아바타 타일로 오래 머무는 현상이 생긴다.
                // ✅ cameraOff/muted는 Spring WS(USERS_UPDATE/USER_STATE_CHANGE) 또는 room:sync에서 "명시적으로" 확인될 때만 변경한다.

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

                        // ✅ 카메라 producer가 닫혀도(재-produce/교체 포함) 기존 스트림을 유지해서
                        // "아바타 타일"로 튀지 않게 한다. (실제 cameraOff는 서버 상태로만 반영)
                        return { ...p, lastUpdate: Date.now() };
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

                console.log(`[SFU] peerLeft received for ${peerId}. Removing immediately.`);

                // ✅ peerLeft는 "실제 퇴장"으로 간주하고 즉시 제거 (재접속 유예 없음)
                for (const [key, c] of consumersRef.current.entries()) {
                    if (String(c?.appData?.peerId) === String(peerId)) {
                        try { c.close(); } catch { }
                        consumersRef.current.delete(key);
                    }
                }
                peerStreamsRef.current.delete(String(peerId));
                bumpStreamVersion();

                setParticipants(prev => prev.filter(p => String(p.id) !== String(peerId)));

                reconnectHistoryRef.current.delete(String(peerId));
                if (reconnectTimeoutRef.current.has(String(peerId))) {
                    clearTimeout(reconnectTimeoutRef.current.get(String(peerId)));
                    reconnectTimeoutRef.current.delete(String(peerId));
                }
                return;
            }
        };

        sfuWs.onerror = (error) => {
            const urlUsed = getSfuWsUrl();
            console.error("❌ SFU WS ERROR", {
                error,
                url: urlUsed,
                expected: "wss://onsil.study/sfu",
                readyState: sfuWs.readyState,
                hint: "1) nginx location /sfu/ 프록시 확인 2) SFU 서버(4000) 실행 확인 3) 빌드 후 재배포 확인",
            });
            setRoomReconnecting(false);
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
            // 통화 중 끊김(프록시/네트워크) 시 재연결 시도 → 검은화면 복구
            if (!isLeavingRef.current) {
                setRoomReconnecting(true);
                setSfuReconnectKey((prev) => prev + 1);
            }
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
    }, [roomId, userId, sfuReconnectKey]); // sfuReconnectKey: SFU 끊김 시 재연결

    useEffect(() => {
        // 로컬스토리지에 저장 (재접속/새로고침 시 복원)
        try {
            localStorage.setItem("meeting.sidebarOpen", String(sidebarOpen));
        } catch (e) {
            console.warn("[MeetingPage] localStorage 저장 실패:", e);
        }
        // 세션스토리지에도 저장 (호환성)
        sessionStorage.setItem("sidebarOpen", String(sidebarOpen));
    }, [sidebarOpen]);

    useEffect(() => {
        // 로컬스토리지에 저장 (재접속/새로고침 시 복원)
        try {
            localStorage.setItem("meeting.sidebarView", sidebarView);
        } catch (e) {
            console.warn("[MeetingPage] localStorage 저장 실패:", e);
        }
        // 세션스토리지에도 저장 (호환성)
        sessionStorage.setItem("sidebarView", sidebarView);
    }, [sidebarView]);

    useEffect(() => {
        // 마운트 직후 첫 렌더링에서는 스크롤하지 않음 (자동 스크롤 방지)
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            return;
        }

        // 메시지가 있고 채팅 영역이 보이는 상태일 때만 스크롤
        if (messages.length > 0 && chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
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

    // 방 경과 시간: 서버가 1초마다 보내는 ROOM_ELAPSED만 사용 → 모두 동일한 시간 표시 (클라이언트 시계/틱 차이 제거)
    // roomStartedAt이 없을 때만 00:00:00 유지 (입장 직후 첫 ROOM_ELAPSED 전)
    useEffect(() => {
        if (roomStartedAt == null) setElapsedTimeDisplay("00:00:00");
    }, [roomStartedAt]);

    // participants 최신 상태를 ref로 추적 (interval 내부 접근용)
    const participantsRef = useRef(participants);
    useEffect(() => { participantsRef.current = participants; }, [participants]);

    // ✅ 중앙 집중식 오디오 모니터링 (VideoTile 개별 분석 대신 통합 관리)
    useEffect(() => {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        // 분석기 상태 저장소: id -> { analyser, source, ema, lastSpeaking, holdOffTimer, trackId }
        const peerAnalysers = new Map();

        // 주기적 오디오 레벨 체크 (100ms)
        const checkAudioLevels = () => {
            if (ctx.state === "suspended") ctx.resume().catch(() => { });

            // 1. 분석 대상 수집 (로컬 + 리모트)
            const targets = [];

            // 로컬 (내 스트림) — 말할 때 '나' 타일에 파란 speaking 표시
            if (localStreamRef.current) {
                // participants에 있는 '나'의 id와 반드시 일치시켜야 setParticipants 시 speaking이 올바른 타일에 반영됨
                const meParticipant = participantsRef.current?.find(p => p.isMe);
                const myId = meParticipant != null ? String(meParticipant.id) : (user?.id != null ? String(user.id) : String(userIdRef.current || ""));
                if (myId) targets.push({ id: myId, stream: localStreamRef.current });
            }

            // 리모트: consumersRef에서 직접 오디오 consumer의 트랙을 가져옴
            // peerStreamsRef가 비어있는 경우가 있어서 consumersRef를 사용하는 것이 더 안정적
            const remoteAudioByPeerId = new Map(); // peerId -> MediaStream (오디오만)

            consumersRef.current.forEach((consumer, producerId) => {
                if (consumer.track?.kind !== "audio" || consumer.track?.readyState !== "live") return;
                const peerId = consumer.appData?.peerId;
                if (!peerId) return;

                // 나 자신은 제외
                if (String(peerId) === String(user?.id) || String(peerId) === String(userIdRef.current)) return;

                // 이미 해당 peer의 오디오가 있으면 스킵 (첫 번째 오디오만 사용)
                if (remoteAudioByPeerId.has(String(peerId))) return;

                const audioStream = new MediaStream([consumer.track]);
                remoteAudioByPeerId.set(String(peerId), audioStream);
            });

            remoteAudioByPeerId.forEach((stream, peerId) => {
                targets.push({ id: peerId, stream });
            });

            // 폴백: peerStreamsRef나 participantsRef에만 있는 경우 (드문 케이스)
            peerStreamsRef.current.forEach((stream, peerId) => {
                if (remoteAudioByPeerId.has(String(peerId))) return; // 이미 추가됨
                if (String(peerId) === String(user?.id)) return;
                targets.push({ id: String(peerId), stream });
            });

            // 🔍 디버그: 분석 대상 확인 (5초마다 로그)
            const shouldLog = Date.now() % 5000 < 150;
            if (shouldLog) {
                console.log('[Audio Debug] Targets:', targets.map(t => ({
                    id: t.id,
                    hasStream: !!t.stream,
                    audioTracks: t.stream?.getAudioTracks()?.length || 0,
                    audioTrackStates: t.stream?.getAudioTracks()?.map(tr => tr.readyState) || []
                })));
                console.log('[Audio Debug] consumersRef:', [...consumersRef.current.entries()].map(([producerId, c]) => ({
                    producerId,
                    kind: c.track?.kind,
                    peerId: c.appData?.peerId,
                    trackState: c.track?.readyState
                })));
                console.log('[Audio Debug] peerStreamsRef size:', peerStreamsRef.current.size);
            }

            const updates = new Map(); // id -> boolean (speaking)
            const now = Date.now();
            let maxVol = 0;
            let currentActiveSpeaker = null;

            targets.forEach(({ id, stream }) => {
                const audioTrack = stream.getAudioTracks().find(t => t.readyState === "live");

                // 트랙 없거나 끝났으면 분석기 제거
                if (!audioTrack) {
                    if (peerAnalysers.has(id)) {
                        const rec = peerAnalysers.get(id);
                        try {
                            rec.source.disconnect();
                            rec.analyser.disconnect();
                        } catch { }
                        peerAnalysers.delete(id);
                        updates.set(id, false);
                    }
                    return;
                }

                let rec = peerAnalysers.get(id);
                // 트랙이 변경되었으면 재설정 (스트림 ID는 무시 - 매번 새로 만들어질 수 있음)
                if (rec && rec.trackId !== audioTrack.id) {
                    try {
                        rec.source.disconnect();
                        rec.analyser.disconnect();
                    } catch { }
                    rec = null;
                }

                if (!rec) {
                    try {
                        const analyser = ctx.createAnalyser();
                        analyser.fftSize = 256;
                        // Clone 제거: 원본 트랙 사용 (CORS 이슈 등 방지)
                        const trackStream = new MediaStream([audioTrack]);
                        const source = ctx.createMediaStreamSource(trackStream);
                        source.connect(analyser);

                        rec = {
                            streamId: stream.id,
                            trackId: audioTrack.id,
                            analyser,
                            source,
                            dataArray: new Uint8Array(analyser.frequencyBinCount),
                            ema: 0,
                            lastSpeaking: false,
                            holdOffTimer: 0
                        };
                        peerAnalysers.set(id, rec);
                    } catch (e) {
                        return;
                    }
                }

                // 레벨 분석
                try {
                    rec.analyser.getByteFrequencyData(rec.dataArray);
                    const sum = rec.dataArray.reduce((a, b) => a + b, 0);
                    const avg = sum / rec.dataArray.length;

                    // EMA (Exponential Moving Average)
                    const ALPHA = 0.25;
                    rec.ema = rec.ema * (1 - ALPHA) + avg * ALPHA;

                    const ON_TH = 10;
                    const OFF_TH = 6;
                    const HOLD = 400;

                    let isSpeaking = rec.lastSpeaking;

                    if (rec.ema > ON_TH) {
                        isSpeaking = true;
                        rec.holdOffTimer = 0;
                        if (rec.ema > maxVol) {
                            maxVol = rec.ema;
                            currentActiveSpeaker = id;
                        }
                    } else if (rec.ema < OFF_TH) {
                        if (isSpeaking) {
                            if (rec.holdOffTimer === 0) {
                                rec.holdOffTimer = now;
                            } else if (now - rec.holdOffTimer > HOLD) {
                                isSpeaking = false;
                                rec.holdOffTimer = 0;
                            }
                        }
                    } else {
                        // 히스테리시스 구간 - 유지
                        // (반등 시 타이머 리셋)
                        if (isSpeaking && rec.holdOffTimer > 0 && rec.ema > OFF_TH + 1) {
                            rec.holdOffTimer = 0;
                        }
                    }

                    if (isSpeaking !== rec.lastSpeaking) {
                        rec.lastSpeaking = isSpeaking;
                        updates.set(id, isSpeaking);
                        console.log(`[Audio] Speaking state changed: ${id} = ${isSpeaking}, EMA: ${rec.ema.toFixed(1)}`);
                    }

                    // 🔍 EMA 값 확인 (말할 때만 출력)
                    if (rec.ema > 5 && shouldLog) {
                        console.log(`[Audio] EMA for ${id}: ${rec.ema.toFixed(1)} (threshold: ${ON_TH})`);
                    }

                    if (isSpeaking && rec.ema > maxVol) {
                        maxVol = rec.ema;
                        currentActiveSpeaker = id;
                    }

                } catch (e) { }
            });

            // 2. 상태 일괄 업데이트 (p.id는 connectionId 또는 userId, consumer.appData.peerId는 서버가 보낸 peerId → 둘 다로 매칭)
            if (updates.size > 0) {
                setParticipants(prev => {
                    let changed = false;
                    const next = prev.map(p => {
                        const idStr = String(p.id);
                        const userIdStr = p.userId != null ? String(p.userId) : null;
                        const matchedKey = updates.has(idStr) ? idStr : (userIdStr && updates.has(userIdStr) ? userIdStr : null);
                        if (matchedKey != null) {
                            const newState = updates.get(matchedKey);
                            if (!!p.speaking !== newState) {
                                changed = true;
                                return { ...p, speaking: newState };
                            }
                        }
                        return p;
                    });
                    return changed ? next : prev;
                });
            }

            // 3. Active Speaker 자동 전환 비활성화 (사용자 경험 개선 - 너무 어지러움)
            // if (currentActiveSpeaker) {
            //     setActiveSpeakerId(String(currentActiveSpeaker));
            // }
        };

        const intervalId = setInterval(checkAudioLevels, 100);

        return () => {
            clearInterval(intervalId);
            peerAnalysers.forEach(rec => {
                try { rec.source.disconnect(); rec.analyser.disconnect(); } catch { }
            });
        };
    }, []); // mount 시 1회 실행

    const orderedParticipants = useMemo(() => {
        // PiP/동기화 시 같은 참가자가 두 번 들어오는 버그 방지: id 기준 중복 제거
        const seenIds = new Set();
        let hasMe = false;
        const uniqueParticipants = participants.filter((p) => {
            const id = String(p.id);
            if (seenIds.has(id)) return false;
            // 🔥 나(isMe)가 userId/connectionId 차이로 중복 들어온 경우 하나만 유지
            if (p.isMe) {
                if (hasMe) return false;
                hasMe = true;
            }
            seenIds.add(id);
            return true;
        });

        const storedOrder = getStoredOrder();
        let orderChanged = false;
        let maxOrder = Math.max(0, ...Object.values(storedOrder));

        // 새 참가자에게 순서 부여
        uniqueParticipants.forEach((p) => {
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
        return [...uniqueParticipants].sort((a, b) => {
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

    // 그리드 전체화면 PiP (동일한 requestBrowserPip/createAvatarStream 사용)
    const handleGridBrowserPip = useCallback(async () => {
        const video = gridFullscreenVideoRef.current;
        if (!video) return;

        if (!document.pictureInPictureElement) {
            const stream = video.srcObject || gridFullscreenStream;
            const peerName = gridFullscreenUser?.name || "참가자";
            const peerId = gridFullscreenUser?.id != null ? String(gridFullscreenUser.id) : "";

            if (!stream || !stream.getVideoTracks().some((t) => t.readyState === "live")) {
                const avatarStream = createAvatarStream(peerName);
                video.srcObject = avatarStream;
                video.muted = true;
                try {
                    await video.play();
                } catch { }
            } else {
                if (!video.srcObject && gridFullscreenStream) {
                    video.srcObject = gridFullscreenStream;
                    video.muted = true;
                    try {
                        await video.play();
                    } catch { }
                }
                if (video.readyState < 2) {
                    await new Promise((resolve) => {
                        const onCanPlay = () => {
                            video.removeEventListener("canplay", onCanPlay);
                            resolve();
                        };
                        video.addEventListener("canplay", onCanPlay);
                        setTimeout(resolve, 1000);
                    });
                }
            }
            const success = await requestBrowserPip(video, video.srcObject || stream, peerName, peerId);
            if (!success) {
                video.requestPictureInPicture().catch((e) => console.warn("[PiP] grid fullscreen failed:", e));
            }
        }
    }, [requestBrowserPip, gridFullscreenUser, gridFullscreenStream, createAvatarStream]);

    // 그리드 일반 모드: 타일별 PiP
    const handleGridTileBrowserPip = useCallback(
        async (p) => {
            const video = gridTileVideoRefsRef.current[String(p.id)];
            if (!video) return;

            if (!document.pictureInPictureElement) {
                const stream =
                    p.isScreenSharing ? p.screenStream : p.isMe ? localStream : p.stream;
                const peerName = p?.name || "참가자";
                const peerId = p?.id != null ? String(p.id) : "";

                if (!stream || !stream.getVideoTracks().some((t) => t.readyState === "live")) {
                    const avatarStream = createAvatarStream(peerName);
                    video.srcObject = avatarStream;
                    video.muted = true;
                    try {
                        await video.play();
                    } catch { }
                } else {
                    if (!video.srcObject && stream) {
                        video.srcObject = stream;
                        video.muted = true;
                        try {
                            await video.play();
                        } catch { }
                    }
                    if (video.readyState < 2) {
                        await new Promise((resolve) => {
                            const onCanPlay = () => {
                                video.removeEventListener("canplay", onCanPlay);
                                resolve();
                            };
                            video.addEventListener("canplay", onCanPlay);
                            setTimeout(resolve, 1000);
                        });
                    }
                }
                const success = await requestBrowserPip(
                    video,
                    video.srcObject || stream,
                    peerName,
                    peerId
                );
                if (!success) {
                    video.requestPictureInPicture().catch((e) =>
                        console.warn("[PiP] grid tile failed:", e)
                    );
                }
            }
        },
        [requestBrowserPip, localStream, createAvatarStream]
    );

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
                        <span>{elapsedTimeDisplay}</span>
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
                                        {/* 🔥 PIP 모드일 때 배너 오버레이 표시 */}
                                        {isBrowserPipMode && (
                                            <div className="pip-mode-overlay">
                                                <div className="pip-mode-banner">
                                                    PiP 모드 이용중
                                                </div>
                                            </div>
                                        )}
                                        {/* 🔥 VideoTile은 항상 렌더링 (언마운트 방지 - 검은화면 깜빡임 방지) */}
                                        {/* 🔥 PIP 모드일 때는 opacity:0으로 숨김 (display:none은 video 디코딩을 중지시켜 producer에 영향) */}
                                        <div style={{
                                            opacity: isBrowserPipMode ? 0 : 1,
                                            pointerEvents: isBrowserPipMode ? 'none' : 'auto',
                                            width: '100%',
                                            height: '100%'
                                        }}>
                                            <VideoTile
                                                user={userForTile(mainUser?.isMe ? { ...mainUser, speaking: isSpeaking } : mainUser)}
                                                isMain
                                                stream={mainStream}
                                                roomReconnecting={roomReconnecting}
                                                isScreen={isMainScreenShare}
                                                reaction={mainUser?.reaction}
                                                videoRef={mainVideoRef}
                                                isFilterPreparing={isFilterPreparing}
                                                isBrowserPipMode={isBrowserPipMode}
                                                onSpeakingChange={handleSpeakingChange}
                                            />
                                        </div>
                                        <button
                                            className="pip-btn"
                                            onClick={handleBrowserPip}
                                            title="PiP"
                                            type="button"
                                        >
                                            <PictureInPicture2 size={22} />
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
                                                            // 🔥 startFaceEmojiFilter 호출 제거 - ref만 업데이트하면 draw loop에서 자동 반영
                                                            // (track 교체 방지 → PiP 안정성 보장)
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
                                                            // 🔥 카메라가 이미 켜져있으면 drawLoop가 배경제거 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
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
                                                                // 🔥 카메라가 이미 켜져있으면 drawLoop가 이모지 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
                                                                if (!canvasPipelineActiveRef.current) {
                                                                    setToastMessage("이모지가 선택되었습니다. 카메라를 켜면 적용됩니다.");
                                                                } else {
                                                                    setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                                                }
                                                                setShowToast(true);
                                                            }}
                                                            className="reaction-btn"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 💬 전체화면 사이드바 (참여자 목록 + 채팅 합침, 비전체화면과 동일) */}
                                            <div className={`fullscreen-sidebar ${sidebarOpen ? "open" : ""}`}>
                                                <div className="fullscreen-sidebar-inner">
                                                    <div className="fullscreen-sidebar-header">
                                                        <h2 className="sidebar-title">참여자 목록</h2>
                                                        <button onClick={() => setSidebarOpen(false)} className="close-btn">
                                                            <X size={20} />
                                                        </button>
                                                    </div>

                                                    <div className="fullscreen-participants-area custom-scrollbar">
                                                        <div className="section-label">참여 중 ({participants.length})</div>
                                                        {participants.map((p) => (
                                                            <div key={p.id} className={`participant-card ${p.isMe ? "me" : ""}`}>
                                                                <div className="p-info">
                                                                    <UserAvatar name={p.name} />
                                                                    <div>
                                                                        <div className={`p-name ${p.isMe ? "me" : ""}`}>
                                                                            {p.name} {p.isMe ? "(나)" : ""} {p.isHost ? "👑" : ""}
                                                                        </div>
                                                                        <div className="p-role">{p.isHost ? "방장" : (p.isMe ? "나" : "참여자")}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="p-status">
                                                                    {p.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} />}
                                                                    {p.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} />}
                                                                    {!p.isMe && amIHost && (
                                                                        <div className="host-menu-container">
                                                                            <button className="more-btn" onClick={() => toggleHostMenu(p.id)}>
                                                                                <MoreHorizontal size={16} />
                                                                            </button>
                                                                            {hostMenuTargetId === p.id && (
                                                                                <div className="host-menu-dropdown">
                                                                                    {!p.muted ? (
                                                                                        <button onClick={() => handleForceMute(p.id)}>
                                                                                            <MicOff size={14} /> 마이크 끄기
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button onClick={() => handleForceUnmute(p.id)}>
                                                                                            <Mic size={14} /> 마이크 켜기
                                                                                        </button>
                                                                                    )}
                                                                                    {!p.cameraOff ? (
                                                                                        <button onClick={() => handleForceCameraOff(p.id)}>
                                                                                            <VideoOff size={14} /> 카메라 끄기
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button onClick={() => handleForceCameraOn(p.id)}>
                                                                                            <Video size={14} /> 카메라 켜기
                                                                                        </button>
                                                                                    )}
                                                                                    <button className="kick-btn" onClick={() => handleKick(p.id)}>
                                                                                        <X size={14} /> 내보내기
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {amIHost && (
                                                            <div className="invite-section">
                                                                <button className="invite-btn" onClick={handleInvite}>
                                                                    <Share size={16} /> 초대하기
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="sidebar-chat-divider">
                                                        <span>채팅</span>
                                                    </div>

                                                    <div className="fullscreen-chat-area custom-scrollbar" ref={chatAreaRef}>
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
                                                    label={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
                                                    icon={sidebarOpen ? PanelRightClose : PanelRightOpen}
                                                    active={sidebarOpen}
                                                    onClick={toggleSidebarOpen}
                                                />
                                                <div className="divider" />
                                                <ButtonControl
                                                    label="통화 종료"
                                                    danger
                                                    icon={Phone}
                                                    onClick={() => setLeaveConfirmModal(true)}
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
                                                                user={userForTile(p)}
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
                                                                isBrowserPipMode={isBrowserPipMode}
                                                                isFilterPreparing={isFilterPreparing}
                                                                onSpeakingChange={handleSpeakingChange}
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
                                <div ref={bottomStripRef} className="bottom-strip">
                                    {orderedParticipants.map((p) => (
                                        <div
                                            key={p.id}
                                            className={`strip-item ${activeSpeakerId === p.id ? "active-strip" : ""
                                                } ${p.isScreenSharing ? "screen-sharing" : ""}`}
                                            onClick={(e) => handleStripItemClick(e, p.id)}
                                        >
                                            <VideoTile
                                                user={userForTile(p)}
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
                                                isFilterPreparing={isFilterPreparing}
                                                onSpeakingChange={handleSpeakingChange}
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
                                            {isBrowserPipMode && String(gridFullscreenUser?.id) === String(customPipData?.peerId) && (
                                                <div className="pip-mode-overlay">
                                                    <div className="pip-mode-banner">PiP 모드 이용중</div>
                                                </div>
                                            )}
                                            <div
                                                style={{
                                                    opacity: isBrowserPipMode && String(gridFullscreenUser?.id) === String(customPipData?.peerId) ? 0 : 1,
                                                    pointerEvents: isBrowserPipMode && String(gridFullscreenUser?.id) === String(customPipData?.peerId) ? "none" : "auto",
                                                    position: "absolute",
                                                    inset: 0,
                                                }}
                                            >
                                                <VideoTile
                                                    user={userForTile(gridFullscreenUser)}
                                                    isMain
                                                    stream={gridFullscreenStream}
                                                    roomReconnecting={roomReconnecting}
                                                    isScreen={isGridScreenShare}
                                                    reaction={gridFullscreenUser?.isMe ? myReaction : gridFullscreenUser?.reaction}
                                                    videoRef={gridFullscreenVideoRef}
                                                    isFilterPreparing={isFilterPreparing}
                                                    isBrowserPipMode={isBrowserPipMode}
                                                    onSpeakingChange={handleSpeakingChange}
                                                />
                                            </div>

                                            <button
                                                className="grid-fullscreen-pip-btn"
                                                onClick={handleGridBrowserPip}
                                                title="PiP"
                                                type="button"
                                            >
                                                <PictureInPicture2 size={22} />
                                            </button>

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
                                                            // 🔥 카메라가 이미 켜져있으면 drawLoop가 배경제거 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
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
                                                                // 🔥 카메라가 이미 켜져있으면 drawLoop가 이모지 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
                                                                if (!canvasPipelineActiveRef.current) {
                                                                    setToastMessage("이모지가 선택되었습니다. 카메라를 켜면 적용됩니다.");
                                                                } else {
                                                                    setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                                                }
                                                                setShowToast(true);
                                                            }}
                                                            className="reaction-btn"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 사이드바 (참여자 목록 + 채팅 합침, 비전체화면과 동일) */}
                                            <div className={`grid-fullscreen-sidebar ${sidebarOpen ? "open" : ""}`}>
                                                <div className="grid-fullscreen-sidebar-inner">
                                                    <div className="grid-fullscreen-sidebar-header">
                                                        <h2 className="sidebar-title">참여자 목록</h2>
                                                        <button onClick={() => setSidebarOpen(false)} className="close-btn">
                                                            <X size={20} />
                                                        </button>
                                                    </div>

                                                    <div className="grid-fullscreen-participants-area custom-scrollbar">
                                                        <div className="section-label">참여 중 ({participants.length})</div>
                                                        {participants.map((part) => (
                                                            <div key={part.id} className={`participant-card ${part.isMe ? "me" : ""}`}>
                                                                <div className="p-info">
                                                                    <UserAvatar name={part.name} />
                                                                    <div>
                                                                        <div className={`p-name ${part.isMe ? "me" : ""}`}>
                                                                            {part.name} {part.isMe ? "(나)" : ""} {part.isHost ? "👑" : ""}
                                                                        </div>
                                                                        <div className="p-role">{part.isHost ? "방장" : (part.isMe ? "나" : "참여자")}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="p-status">
                                                                    {part.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} />}
                                                                    {part.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} />}
                                                                    {!part.isMe && amIHost && (
                                                                        <div className="host-menu-container">
                                                                            <button className="more-btn" onClick={() => toggleHostMenu(part.id)}>
                                                                                <MoreHorizontal size={16} />
                                                                            </button>
                                                                            {hostMenuTargetId === part.id && (
                                                                                <div className="host-menu-dropdown">
                                                                                    {!part.muted ? (
                                                                                        <button onClick={() => handleForceMute(part.id)}>
                                                                                            <MicOff size={14} /> 마이크 끄기
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button onClick={() => handleForceUnmute(part.id)}>
                                                                                            <Mic size={14} /> 마이크 켜기
                                                                                        </button>
                                                                                    )}
                                                                                    {!part.cameraOff ? (
                                                                                        <button onClick={() => handleForceCameraOff(part.id)}>
                                                                                            <VideoOff size={14} /> 카메라 끄기
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button onClick={() => handleForceCameraOn(part.id)}>
                                                                                            <Video size={14} /> 카메라 켜기
                                                                                        </button>
                                                                                    )}
                                                                                    <button className="kick-btn" onClick={() => handleKick(part.id)}>
                                                                                        <X size={14} /> 내보내기
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {amIHost && (
                                                            <div className="invite-section">
                                                                <button className="invite-btn" onClick={handleInvite}>
                                                                    <Share size={16} /> 초대하기
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="sidebar-chat-divider">
                                                        <span>채팅</span>
                                                    </div>

                                                    <div className="grid-fullscreen-chat-area custom-scrollbar" ref={chatAreaRef}>
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
                                                <ButtonControl
                                                    label={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
                                                    icon={sidebarOpen ? PanelRightClose : PanelRightOpen}
                                                    active={sidebarOpen}
                                                    onClick={toggleSidebarOpen}
                                                />
                                                <div className="divider" />
                                                <ButtonControl label="통화 종료" danger icon={Phone} onClick={() => setLeaveConfirmModal(true)} />
                                            </div>

                                            {/* 참가자 스트립 */}
                                            <div className={`grid-fullscreen-strip-wrapper ${gridStripVisible ? "visible" : "hidden"}`}>
                                                <div className="grid-fullscreen-strip">
                                                    {orderedParticipants.map((part) => (
                                                        <div
                                                            key={part.id}
                                                            className={`strip-item ${gridFullscreenId === part.id ? "active-strip" : ""} ${part.isScreenSharing ? "screen-sharing" : ""}`}
                                                            onClick={() => setGridFullscreenId(part.id)}
                                                        >
                                                            <VideoTile
                                                                user={userForTile(part)}
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
                                                                isFilterPreparing={isFilterPreparing}
                                                                isBrowserPipMode={isBrowserPipMode}
                                                                onSpeakingChange={handleSpeakingChange}
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
                                    orderedParticipants.map((p) => {
                                        const isThisTilePip = isBrowserPipMode && String(p.id) === String(customPipData?.peerId);
                                        return (
                                        <div key={p.id} className="grid-tile">
                                            <div className="grid-video-area">
                                                {isThisTilePip && (
                                                    <div className="grid-tile-pip-mode-overlay">
                                                        <span className="pip-mode-banner">PiP 모드 이용중</span>
                                                    </div>
                                                )}
                                                <div
                                                    style={{
                                                        opacity: isThisTilePip ? 0 : 1,
                                                        pointerEvents: isThisTilePip ? "none" : "auto",
                                                        position: "absolute",
                                                        inset: 0,
                                                    }}
                                                >
                                                    <VideoTile
                                                        user={userForTile(p)}
                                                        stream={
                                                            p.isScreenSharing
                                                                ? p.screenStream
                                                                : p.isMe
                                                                    ? localStream
                                                                    : p.stream
                                                        }
                                                        videoRef={getGridTileVideoRef(p.id)}
                                                        roomReconnecting={roomReconnecting}
                                                        isScreen={p.isScreenSharing}
                                                        reaction={p.isMe ? myReaction : null}
                                                        isFilterPreparing={isFilterPreparing}
                                                        isBrowserPipMode={isBrowserPipMode}
                                                        onSpeakingChange={handleSpeakingChange}
                                                    />
                                                </div>

                                                <button
                                                    className="grid-tile-pip-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGridTileBrowserPip(p);
                                                    }}
                                                    title="PiP"
                                                    type="button"
                                                >
                                                    <PictureInPicture2 size={18} />
                                                </button>

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
                                        );
                                    })}
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
                                        // 🔥 카메라가 이미 켜져있으면 drawLoop가 배경제거 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
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
                                            // 🔥 카메라가 이미 켜져있으면 drawLoop가 이모지 적용. 꺼져있으면 설정만 저장(카메라 켤 때 적용)
                                            if (!canvasPipelineActiveRef.current) {
                                                setToastMessage("이모지가 선택되었습니다. 카메라를 켜면 적용됩니다.");
                                            } else {
                                                setToastMessage("얼굴 이모지 필터가 적용되었습니다.");
                                            }
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
                            <ButtonControl
                                label={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
                                icon={sidebarOpen ? PanelRightClose : PanelRightOpen}
                                active={sidebarOpen}
                                onClick={toggleSidebarOpen}
                            />
                            <div className="divider"></div>
                            <ButtonControl label="통화 종료" danger icon={Phone} onClick={() => setLeaveConfirmModal(true)} />
                        </div>
                    </div>
                </main>

                <aside className={`meet-sidebar ${sidebarOpen && !isGridFullscreen && !isFullscreen ? "open" : ""}`}>
                    <div className={`sidebar-inner ${!amIHost ? "sidebar-inner--guest" : ""}`}>
                        <div className="sidebar-header">
                            <h2 className="sidebar-title">참여자 목록</h2>
                        </div>

                        <div className="participants-area">
                            <div className="section-label">참여 중 ({participants.length})</div>
                            {participants.map((p) => (
                                <div key={p.id} className={`participant-card ${p.isMe ? "me" : ""}`}>
                                    <div className="p-info">
                                        <UserAvatar name={p.name} />
                                        <div>
                                            <div className={`p-name ${p.isMe ? "me" : ""}`}>
                                                {p.name} {p.isMe ? "(나)" : ""} {p.isHost ? "👑" : ""}
                                            </div>
                                            <div className="p-role">{p.isHost ? "방장" : (p.isMe ? "나" : "참여자")}</div>
                                        </div>
                                    </div>
                                    <div className="p-status">
                                        {p.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} className="icon-hidden" />}
                                        {p.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} className="icon-hidden" />}
                                        {!p.isMe && amIHost && (
                                            <div className="host-menu-container">
                                                <button className="more-btn" onClick={() => toggleHostMenu(p.id)}>
                                                    <MoreHorizontal size={16} />
                                                </button>
                                                {hostMenuTargetId === p.id && (
                                                    <div className="host-menu-dropdown">
                                                        {!p.muted ? (
                                                            <button onClick={() => handleForceMute(p.id)}>
                                                                <MicOff size={14} /> 마이크 끄기
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleForceUnmute(p.id)}>
                                                                <Mic size={14} /> 마이크 켜기
                                                            </button>
                                                        )}
                                                        {!p.cameraOff ? (
                                                            <button onClick={() => handleForceCameraOff(p.id)}>
                                                                <VideoOff size={14} /> 카메라 끄기
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleForceCameraOn(p.id)}>
                                                                <Video size={14} /> 카메라 켜기
                                                            </button>
                                                        )}
                                                        <button className="kick-btn" onClick={() => handleKick(p.id)}>
                                                            <X size={14} /> 내보내기
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* 방장이 아닌 사람에게는 ... 메뉴 미표시 */}
                                    </div>
                                </div>
                            ))}
                            {amIHost && (
                                <div className="invite-section">
                                    <button className="invite-btn" onClick={handleInvite}>
                                        <Share size={16} /> 초대하기
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="sidebar-chat-divider">
                            <span>채팅</span>
                        </div>

                        <div className="chat-area custom-scrollbar" ref={chatAreaRef}>
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
                    </div>
                </aside>
            </div>

            {/* 통화 종료 확인 모달 */}
            {leaveConfirmModal && (
                <div className="force-camera-on-modal-overlay" onClick={() => setLeaveConfirmModal(false)}>
                    <div className="force-camera-on-modal" onClick={(e) => e.stopPropagation()}>
                        <p className="force-camera-on-modal-title">통화를 종료하시겠습니까?</p>
                        <div className="force-camera-on-modal-actions" style={{ marginTop: "1rem" }}>
                            <button
                                className="force-camera-on-modal-btn allow"
                                onClick={() => {
                                    setLeaveConfirmModal(false);
                                    handleHangup();
                                }}
                            >
                                확인
                            </button>
                            <button
                                className="force-camera-on-modal-btn reject"
                                onClick={() => setLeaveConfirmModal(false)}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 방장 마이크 켜기 요청 확인 모달 */}
            {forceUnmuteRequest && (
                <div className="force-camera-on-modal-overlay" onClick={() => setForceUnmuteRequest(null)}>
                    <div className="force-camera-on-modal" onClick={(e) => e.stopPropagation()}>
                        <p className="force-camera-on-modal-title">
                            {forceUnmuteRequest.hostName}님이 마이크를 켜려고 합니다.
                        </p>
                        <p className="force-camera-on-modal-desc">
                            허용하시겠습니까? 거절하시면 원하실 때 직접 켤 수 있습니다.
                        </p>
                        <div className="force-camera-on-modal-actions">
                            <button
                                className="force-camera-on-modal-btn allow"
                                onClick={() => {
                                    const { hostName } = forceUnmuteRequest;
                                    setForceUnmuteRequest(null);
                                    setMicOn(true);
                                    try { localStorage.setItem("micOn", "true"); } catch { }
                                    setToastMessage(`${hostName}님이 마이크를 켜 주었습니다.`);
                                    setShowToast(true);
                                    const audioProducer = producersRef.current?.get?.("audio");
                                    if (audioProducer?.track) audioProducer.track.enabled = true;
                                    const at = localStreamRef.current?.getAudioTracks?.()[0];
                                    if (at) at.enabled = true;
                                }}
                            >
                                허용
                            </button>
                            <button
                                className="force-camera-on-modal-btn reject"
                                onClick={() => {
                                    setForceUnmuteRequest(null);
                                    setToastMessage("마이크 켜기를 거절했습니다. 원하실 때 직접 켤 수 있습니다.");
                                    setShowToast(true);
                                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                                        wsRef.current.send(JSON.stringify({
                                            type: "USER_STATE_CHANGE",
                                            userId,
                                            changes: { muted: true },
                                        }));
                                    }
                                    setParticipants(prev =>
                                        prev.map(p => (p.isMe ? { ...p, muted: true } : p))
                                    );
                                }}
                            >
                                거절
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 방장 카메라 켜기 요청 확인 모달 (WebSocket 콜백에서는 window.confirm이 차단되므로 인앱 모달 사용) */}
            {forceCameraOnRequest && (
                <div className="force-camera-on-modal-overlay" onClick={() => setForceCameraOnRequest(null)}>
                    <div className="force-camera-on-modal" onClick={(e) => e.stopPropagation()}>
                        <p className="force-camera-on-modal-title">
                            {forceCameraOnRequest.hostName}님이 카메라를 켜려고 합니다.
                        </p>
                        <p className="force-camera-on-modal-desc">
                            허용하시겠습니까? 거절하시면 얼굴을 보여주지 않고 참여할 수 있습니다.
                        </p>
                        <div className="force-camera-on-modal-actions">
                            <button
                                className="force-camera-on-modal-btn allow"
                                onClick={() => {
                                    const { hostName } = forceCameraOnRequest;
                                    setForceCameraOnRequest(null);
                                    setCamOn(true);
                                    try { localStorage.setItem("camOn", "true"); } catch { }
                                    setToastMessage(`${hostName}님이 카메라를 켜 주었습니다.`);
                                    setShowToast(true);
                                    turnOnCamera().catch((e) => console.warn("[FORCE_CAMERA_ON] turnOnCamera failed:", e));
                                }}
                            >
                                허용
                            </button>
                            <button
                                className="force-camera-on-modal-btn reject"
                                onClick={() => {
                                    setForceCameraOnRequest(null);
                                    setToastMessage("카메라 켜기를 거절했습니다. 원하실 때 직접 켤 수 있습니다.");
                                    setShowToast(true);
                                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                                        wsRef.current.send(JSON.stringify({
                                            type: "USER_STATE_CHANGE",
                                            userId,
                                            changes: { cameraOff: true },
                                        }));
                                    }
                                    setParticipants(prev =>
                                        prev.map(p => (p.isMe ? { ...p, cameraOff: true } : p))
                                    );
                                }}
                            >
                                거절
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast
                message={toastMessage}
                visible={showToast}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
}

export default MeetingPage;
