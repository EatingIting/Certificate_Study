import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import ChatModal from "./chat/ChatModal";
import Toast from "../toast/Toast";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";
import Board from "./board/Board";
import Calendar from "./calendar/Calendar";

import MeetingPage from "../webrtc/MeetingPage";
import MeetingPortal from "../webrtc/MeetingPagePortal";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";

import "./LMSSubject.css";

const LMSSubjectInner = () => {
    const navigate = useNavigate();
    const { subjectId } = useParams();

    /* =========================
       Toast
    ========================= */
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    /* =========================
       PiP UX
    ========================= */
    const [showPipReopenButton, setShowPipReopenButton] = useState(false);

    const {
        isInMeeting,
        isPipMode,
        roomId,
        requestBrowserPip,
    } = useMeeting();

    const prevPipRef = useRef(false);

    /* =========================
       Sidebar 이동 시 PiP 강제
    ========================= */
    const handleSidebarNavigate = async (path) => {
        if (isInMeeting && !document.pictureInPictureElement) {
            const video = document.querySelector("video[data-main-video]");
            if (video) {
                try {
                    await requestBrowserPip(video);
                } catch (e) {
                    // PiP 실패해도 네비게이션은 진행
                }
            }
        }

        navigate(`/lms/${subjectId}/${path}`);
    };

    /* =========================
       Toast 이벤트
    ========================= */
    useEffect(() => {
        const handler = (e) => {
            if (!e.detail) return;
            setToastMessage(e.detail);
            setToastVisible(true);
        };

        window.addEventListener("ui:toast", handler);
        return () => window.removeEventListener("ui:toast", handler);
    }, []);

    /* =========================
       🔥 PiP 요청 이벤트 (Sidebar에서 발생)
       - MeetingPage가 언마운트되어도 여기서 리스닝
    ========================= */
    useEffect(() => {
        const handlePipRequest = async () => {
            console.log("[LMSSubject] meeting:request-pip 이벤트 수신");
            
            // 이미 PiP 모드면 스킵
            if (document.pictureInPictureElement) {
                console.log("[LMSSubject] 이미 PiP 모드임");
                return;
            }

            const video = document.querySelector("video[data-main-video]");
            if (video) {
                try {
                    await requestBrowserPip(video);
                    console.log("[LMSSubject] PiP 활성화 성공");
                } catch (e) {
                    console.warn("[LMSSubject] PiP 요청 실패:", e);
                }
            } else {
                console.warn("[LMSSubject] video[data-main-video] 요소를 찾을 수 없음");
            }
        };

        window.addEventListener("meeting:request-pip", handlePipRequest);
        return () => window.removeEventListener("meeting:request-pip", handlePipRequest);
    }, [requestBrowserPip]);

    /* =========================
       🔥 PiP POLLING (핵심)
    ========================= */
    useEffect(() => {
        const interval = setInterval(() => {
            const nowPip = !!document.pictureInPictureElement;

            /* PiP → 일반 화면 복귀 감지 */
            if (prevPipRef.current && !nowPip) {
                const savedRoomId = sessionStorage.getItem("pip.roomId");
                const savedSubjectId = sessionStorage.getItem("pip.subjectId");

                if (savedRoomId && savedSubjectId) {
                    navigate(
                        `/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`,
                        { replace: true }
                    );
                }
            }

            prevPipRef.current = nowPip;

            /* PiP 재진입 가능 여부 판단 */
            const video = document.querySelector("video[data-main-video]");
            const track = video?.srcObject?.getVideoTracks?.()[0];

            const canReopen =
                !nowPip &&
                track &&
                track.readyState === "live";

            setShowPipReopenButton(!!canReopen);
        }, 300);

        return () => clearInterval(interval);
    }, [navigate]);

    /* =========================
       🔥 PiP 비디오 트랙 모니터링
       - 상대방이 카메라를 끄면 PiP 자동 종료
       - MeetingPage가 언마운트되어도 여기서 감시
       - document.pictureInPictureElement를 직접 사용 (DOM에서 video가 제거되어도 접근 가능)
       - Canvas 기반 프레임 비교로 frozen 감지
    ========================= */
    const frozenCountRef = useRef(0);
    const lastFrameDataRef = useRef(null);
    const pipTrackListenersRef = useRef(null);
    const pipCanvasRef = useRef(null);

    useEffect(() => {
        console.log("[LMSSubject] PiP 비디오 모니터링 시작");

        const exitPipWithMessage = (message) => {
            console.log(`[LMSSubject] ${message} - PiP 자동 종료`);
            document.exitPictureInPicture().catch(() => {});
            
            setToastMessage("상대방이 카메라를 껐습니다");
            setToastVisible(true);
            
            window.dispatchEvent(
                new CustomEvent("pip:auto-closed-by-camera-off")
            );
            
            // 리셋
            frozenCountRef.current = 0;
            lastFrameDataRef.current = null;
        };

        const cleanupTrackListeners = () => {
            if (pipTrackListenersRef.current) {
                const { track, onEnded, onMute } = pipTrackListenersRef.current;
                track.removeEventListener("ended", onEnded);
                track.removeEventListener("mute", onMute);
                pipTrackListenersRef.current = null;
            }
        };

        // Canvas로 현재 프레임의 해시값 계산 (간단한 픽셀 샘플링)
        const getFrameSignature = (video) => {
            if (!pipCanvasRef.current) {
                pipCanvasRef.current = document.createElement("canvas");
            }
            const canvas = pipCanvasRef.current;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            
            // 작은 사이즈로 샘플링 (성능 최적화)
            const sampleSize = 16;
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            
            try {
                ctx.drawImage(video, 0, 0, sampleSize, sampleSize);
                const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
                
                // 픽셀 데이터의 간단한 해시
                let sum = 0;
                for (let i = 0; i < imageData.data.length; i += 16) {
                    sum += imageData.data[i];
                }
                return sum;
            } catch (e) {
                return null;
            }
        };

        const interval = setInterval(() => {
            // PiP 모드가 아니면 리셋하고 스킵
            if (!document.pictureInPictureElement) {
                frozenCountRef.current = 0;
                lastFrameDataRef.current = null;
                cleanupTrackListeners();
                return;
            }

            // 🔥 핵심 수정: document.pictureInPictureElement를 직접 사용
            // MeetingPage가 언마운트되어 DOM에서 video가 제거되어도
            // PiP 창에 있는 video 요소는 이 속성으로 접근 가능
            const video = document.pictureInPictureElement;
            if (!video) {
                console.log("[LMSSubject PiP Monitor] PiP video 요소 없음");
                return;
            }

            const stream = video.srcObject;
            const track = stream?.getVideoTracks?.()[0];

            console.log("[LMSSubject PiP Monitor] 상태:", {
                hasStream: !!stream,
                hasTrack: !!track,
                trackState: track?.readyState,
                trackEnabled: track?.enabled,
                trackMuted: track?.muted,
                frozenCount: frozenCountRef.current
            });

            // 1. 스트림이 아예 없는 경우
            if (!stream) {
                exitPipWithMessage("스트림 없음");
                return;
            }

            // 2. 비디오 트랙이 없는 경우 (오디오만 있을 때)
            if (!track) {
                exitPipWithMessage("비디오 트랙 없음");
                return;
            }

            // 3. 트랙이 완전히 종료된 경우
            if (track.readyState === "ended") {
                exitPipWithMessage("트랙 ended 상태");
                return;
            }

            // 4. 트랙 이벤트 리스너 설정 (한 번만)
            if (!pipTrackListenersRef.current || pipTrackListenersRef.current.track !== track) {
                cleanupTrackListeners();
                
                const onEnded = () => {
                    console.log("[LMSSubject PiP Monitor] track.onended 이벤트 발생!");
                    exitPipWithMessage("트랙 ended 이벤트");
                };
                const onMute = () => {
                    console.log("[LMSSubject PiP Monitor] track.onmute 이벤트 발생!");
                    // mute 이벤트 후 잠시 대기하고 체크 (일시적 mute 제외)
                    setTimeout(() => {
                        if (track.muted && document.pictureInPictureElement) {
                            exitPipWithMessage("트랙 mute 이벤트");
                        }
                    }, 500);
                };

                track.addEventListener("ended", onEnded);
                track.addEventListener("mute", onMute);
                pipTrackListenersRef.current = { track, onEnded, onMute };
                console.log("[LMSSubject PiP Monitor] 트랙 리스너 설정 완료");
            }

            // 5. 트랙이 muted 상태인 경우 (enabled=false 또는 muted=true)
            if (!track.enabled) {
                exitPipWithMessage("트랙 enabled=false");
                return;
            }
            if (track.muted) {
                exitPipWithMessage("트랙 muted=true");
                return;
            }

            // 6. Canvas 기반 프레임 frozen 감지
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA 이상
                const currentSignature = getFrameSignature(video);
                
                if (currentSignature !== null) {
                    // 디버그 로그 감소 (필요시 주석 해제)
                    // console.log("[LMSSubject PiP Monitor] frame signature:", currentSignature, "prev:", lastFrameDataRef.current);
                    
                    if (lastFrameDataRef.current === currentSignature) {
                        frozenCountRef.current++;
                        console.log("[LMSSubject PiP Monitor] 동일 프레임 감지, count:", frozenCountRef.current);
                        
                        // 2초 동안 프레임이 안 바뀌면 (500ms * 4)
                        if (frozenCountRef.current >= 4) {
                            exitPipWithMessage("비디오 프레임 frozen 감지");
                            return;
                        }
                    } else {
                        frozenCountRef.current = 0;
                    }
                    
                    lastFrameDataRef.current = currentSignature;
                }
            }

        }, 500); // 500ms 간격으로 체크

        return () => {
            clearInterval(interval);
            cleanupTrackListeners();
        };
    }, []);

    return (
        <>
            {/* Toast */}
            <Toast
                message={toastMessage}
                visible={toastVisible}
                onClose={() => setToastVisible(false)}
            />

            {/* PiP 다시 보기 */}
            {showPipReopenButton && (
                <button
                    className="pip-reopen-btn"
                    onClick={() => {
                        const video = document.querySelector("video[data-main-video]");
                        if (video) {
                            requestBrowserPip(video).catch(() => { });
                        }
                    }}
                >
                    PiP 다시 보기
                </button>
            )}

            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar onNavigate={handleSidebarNavigate} />

                <main className="subject-content">
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="attendance" element={<Attendance />} />
                        <Route path="assignment" element={<Assignment />} />
                        <Route path="assignment/:id" element={<AssignmentDetail />} />
                        <Route path="board" element={<Board />} />
                        <Route path="calendar" element={<Calendar />} />
                        <Route path="MeetingRoom/:roomId" element={<MeetingPage />} />
                        <Route
                            path="*"
                            element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />}
                        />
                    </Routes>
                </main>
            </div>

            {(isInMeeting || isPipMode) && roomId && <MeetingPortal />}
            <ChatModal />
        </>
    );
};

const LMSSubject = () => (
    <MeetingProvider>
        <LMSSubjectInner />
    </MeetingProvider>
);

export default LMSSubject;
