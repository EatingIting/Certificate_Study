import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";

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
    const {
        isInMeeting,
        isPipMode,
        roomId,
    } = useMeeting();

    const prevPipRef = useRef(false);

    /* =========================
       🔥 PiP 시스템 (Canvas 없이 직접 비디오 사용)
       - WebRTC cross-origin 문제 해결
       - 카메라 off 감지 시 토스트 표시
       - 원본 video의 srcObject 변경 감지하여 동기화
    ========================= */
    const sourceVideoRef = useRef(null);   // PiP용 비디오
    const originalVideoRef = useRef(null); // 원본 video 요소 참조
    const pipAnimationRef = useRef(null);  // 모니터링 타이머
    const sourceStreamRef = useRef(null);  // MediaStream 저장 (원본)
    const sourceTrackRef = useRef(null);   // 🔥 원본 video track 직접 저장
    const peerNameRef = useRef("참가자");
    const isPipCameraOffRef = useRef(false);
    const pipActiveRef = useRef(false);    // 모니터링 활성화 플래그

    // 🔥 직접 비디오 PiP 초기화 (Canvas 없이 - cross-origin 문제 해결)
    const initCanvasPip = useCallback(async (originalVideo, peerName) => {
        const mediaStream = originalVideo?.srcObject;
        
        console.log("[PiP] ======= 초기화 시작 =======", { 
            hasOriginalVideo: !!originalVideo,
            hasMediaStream: !!mediaStream,
            videoTracks: mediaStream?.getVideoTracks?.()?.length,
            trackState: mediaStream?.getVideoTracks?.()?.[0]?.readyState,
            peerName 
        });

        if (!mediaStream) {
            console.error("[PiP] MediaStream이 없습니다!");
            return false;
        }

        // 기존 정리
        pipActiveRef.current = false;
        if (pipAnimationRef.current) {
            clearTimeout(pipAnimationRef.current);
            pipAnimationRef.current = null;
        }
        if (sourceVideoRef.current) {
            sourceVideoRef.current.srcObject = null;
            sourceVideoRef.current.remove();
            sourceVideoRef.current = null;
        }

        // 상태 초기화
        originalVideoRef.current = originalVideo;  // 🔥 원본 video 참조 저장
        sourceStreamRef.current = mediaStream;
        sourceTrackRef.current = mediaStream.getVideoTracks()[0];  // 🔥 track 직접 저장
        peerNameRef.current = peerName || "참가자";
        isPipCameraOffRef.current = false;
        
        console.log("[PiP] track 저장:", {
            trackId: sourceTrackRef.current?.id,
            enabled: sourceTrackRef.current?.enabled,
            readyState: sourceTrackRef.current?.readyState
        });

        // 🔥 PiP용 비디오 생성
        const pipVideo = document.createElement("video");
        pipVideo.autoplay = true;
        pipVideo.playsInline = true;
        pipVideo.muted = true;
        pipVideo.setAttribute("data-pip-video", "true");
        pipVideo.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:640px;height:480px;";
        document.body.appendChild(pipVideo);
        sourceVideoRef.current = pipVideo;

        // 🔥 MediaStream 직접 연결 (Canvas 거치지 않음)
        pipVideo.srcObject = mediaStream;
        
        try {
            await pipVideo.play();
            console.log("[PiP] 비디오 재생 성공, readyState:", pipVideo.readyState);
        } catch (e) {
            console.warn("[PiP] 비디오 재생 실패:", e);
        }

        // 비디오 데이터 로드 대기 (최대 2초)
        await new Promise((resolve) => {
            if (pipVideo.readyState >= 2) {
                resolve();
            } else {
                const onCanPlay = () => {
                    pipVideo.removeEventListener("canplay", onCanPlay);
                    resolve();
                };
                pipVideo.addEventListener("canplay", onCanPlay);
                setTimeout(resolve, 2000);
            }
        });

        console.log("[PiP] 비디오 준비 완료, readyState:", pipVideo.readyState);

        // 🔥 트랙 상태 모니터링 (저장된 스트림의 track 이벤트 사용)
        pipActiveRef.current = true;
        
        // 원본 스트림의 track에 이벤트 리스너 추가
        const videoTrack = mediaStream.getVideoTracks()[0];
        
        // 🔥 track 이벤트로 카메라 꺼짐 감지 → PiP 종료
        const handleUnmute = () => {
            console.log("[PiP] track unmute 이벤트");
        };
        
        const handleMute = () => {
            console.log("[PiP] track mute 이벤트 → PiP 종료");
            if (pipActiveRef.current && !isPipCameraOffRef.current) {
                isPipCameraOffRef.current = true;
                setToastMessage("상대방이 카메라를 껐습니다");
                setToastVisible(true);
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(() => {});
                }
            }
        };
        
        const handleEnded = () => {
            console.log("[PiP] track ended 이벤트 → PiP 종료");
            if (pipActiveRef.current && !isPipCameraOffRef.current) {
                isPipCameraOffRef.current = true;
                setToastMessage("상대방이 카메라를 껐습니다");
                setToastVisible(true);
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(() => {});
                }
            }
        };
        
        if (videoTrack) {
            videoTrack.addEventListener("unmute", handleUnmute);
            videoTrack.addEventListener("mute", handleMute);
            videoTrack.addEventListener("ended", handleEnded);
            console.log("[PiP] track 이벤트 리스너 등록 완료", {
                trackId: videoTrack.id,
                enabled: videoTrack.enabled,
                muted: videoTrack.muted,
                readyState: videoTrack.readyState
            });
        }
        
        // 🔥 주기적 모니터링 (백업 - 원본 스트림의 track 상태 확인)
        // 초기 2초간은 카메라 off 감지 비활성화 (일시적인 muted 상태 무시)
        let monitorStartTime = Date.now();
        let prevEnabled = videoTrack?.enabled;
        
        const monitorTrack = () => {
            if (!pipActiveRef.current) return;

            // 🔥 저장된 track 직접 사용 (MediaStream에서 다시 가져오지 않음)
            const origTrack = sourceTrackRef.current;
            
            // 🔥 enabled 상태만 체크 (muted는 일시적일 수 있음)
            const isCameraOff = !origTrack || 
                origTrack.readyState === "ended" || 
                !origTrack.enabled;
            
            // 초기 2초간은 off 감지 무시 (스트림 안정화 대기)
            const elapsed = Date.now() - monitorStartTime;
            const canDetect = elapsed > 2000;
            
            // enabled 상태 변화 로그
            if (origTrack && origTrack.enabled !== prevEnabled) {
                console.log("[PiP] track.enabled 변경:", prevEnabled, "→", origTrack.enabled);
                prevEnabled = origTrack.enabled;
            }

            // 상태 변경 감지 - 카메라 꺼지면 Toast + PiP 종료
            if (canDetect && isCameraOff && !isPipCameraOffRef.current) {
                console.log("[PiP] 카메라 꺼짐 감지 → PiP 종료", {
                    hasTrack: !!origTrack,
                    readyState: origTrack?.readyState,
                    enabled: origTrack?.enabled
                });
                
                isPipCameraOffRef.current = true;
                
                // Toast 표시
                setToastMessage("상대방이 카메라를 껐습니다");
                setToastVisible(true);
                
                // PiP 종료
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().catch(() => {});
                }
                
                return; // 모니터링 중단
            }

            pipAnimationRef.current = setTimeout(monitorTrack, 500);
        };
        
        monitorTrack();
        
        // cleanup 시 이벤트 리스너 제거를 위해 저장
        pipVideo._trackListeners = { videoTrack, handleUnmute, handleMute, handleEnded };

        // PiP 요청
        try {
            await pipVideo.requestPictureInPicture();
            console.log("[PiP] ======= PiP 활성화 성공 =======");
            return true;
        } catch (e) {
            console.error("[PiP] PiP 요청 실패:", e);
            pipActiveRef.current = false;
            return false;
        }
    }, []);

    // PiP 정리
    const cleanupCanvasPip = useCallback(() => {
        console.log("[PiP] 정리");
        pipActiveRef.current = false;
        
        if (pipAnimationRef.current) {
            clearTimeout(pipAnimationRef.current);
            pipAnimationRef.current = null;
        }
        
        // 🔥 track 이벤트 리스너 제거
        if (sourceVideoRef.current?._trackListeners) {
            const { videoTrack, handleUnmute, handleMute, handleEnded } = sourceVideoRef.current._trackListeners;
            if (videoTrack) {
                videoTrack.removeEventListener("unmute", handleUnmute);
                videoTrack.removeEventListener("mute", handleMute);
                videoTrack.removeEventListener("ended", handleEnded);
                console.log("[PiP] track 이벤트 리스너 제거 완료");
            }
            sourceVideoRef.current._trackListeners = null;
        }
        
        originalVideoRef.current = null;
        sourceStreamRef.current = null;
        sourceTrackRef.current = null;
        isPipCameraOffRef.current = false;
    }, []);

    /* =========================
       Sidebar 이동 시 PiP 강제
    ========================= */
    const handleSidebarNavigate = async (path) => {
        if (isInMeeting && !document.pictureInPictureElement) {
            const video = document.querySelector("video[data-main-video]");
            if (video) {
                try {
                    // Canvas 기반 PiP 사용
                    const peerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
                    await initCanvasPip(video, peerName);
                } catch (e) {
                    // PiP 실패해도 네비게이션은 진행
                    console.warn("[Sidebar] Canvas PiP 실패:", e);
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
       - Canvas 기반 PiP로 처리
    ========================= */
    useEffect(() => {
        // 기본 PiP 요청 (video 자동 감지)
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
                    // Canvas 기반 PiP 사용
                    const peerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
                    await initCanvasPip(video, peerName);
                    console.log("[LMSSubject] Canvas PiP 활성화 성공");
                } catch (e) {
                    console.warn("[LMSSubject] Canvas PiP 요청 실패:", e);
                }
            } else {
                console.warn("[LMSSubject] video[data-main-video] 요소를 찾을 수 없음");
            }
        };

        // Canvas PiP 요청 (video와 peerName을 직접 전달받음)
        const handleCanvasPipRequest = async (e) => {
            console.log("[LMSSubject] meeting:request-canvas-pip 이벤트 수신");
            
            // 이미 PiP 모드면 스킵
            if (document.pictureInPictureElement) {
                console.log("[LMSSubject] 이미 PiP 모드임");
                return;
            }

            const { video, peerName } = e.detail || {};
            if (video) {
                try {
                    await initCanvasPip(video, peerName);
                    console.log("[LMSSubject] Canvas PiP 활성화 성공");
                } catch (err) {
                    console.warn("[LMSSubject] Canvas PiP 요청 실패:", err);
                }
            } else {
                console.warn("[LMSSubject] Canvas PiP 요청에 video가 없음");
            }
        };

        window.addEventListener("meeting:request-pip", handlePipRequest);
        window.addEventListener("meeting:request-canvas-pip", handleCanvasPipRequest);
        
        return () => {
            window.removeEventListener("meeting:request-pip", handlePipRequest);
            window.removeEventListener("meeting:request-canvas-pip", handleCanvasPipRequest);
        };
    }, [initCanvasPip]);

    /* =========================
       🔥 PiP POLLING (핵심)
    ========================= */
    useEffect(() => {
        const interval = setInterval(() => {
            const nowPip = !!document.pictureInPictureElement;

            /* PiP → 일반 화면 복귀 감지 */
            if (prevPipRef.current && !nowPip) {
                // 🔥 카메라 off로 종료된 경우 네비게이션 하지 않음
                const closedByCameraOff = isPipCameraOffRef.current;
                
                // Canvas PiP 정리
                cleanupCanvasPip();

                // 카메라 off가 아닌 경우에만 회의실로 이동
                if (!closedByCameraOff) {
                    const savedRoomId = sessionStorage.getItem("pip.roomId");
                    const savedSubjectId = sessionStorage.getItem("pip.subjectId");

                    if (savedRoomId && savedSubjectId) {
                        navigate(
                            `/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`,
                            { replace: true }
                        );
                    }
                }
            }

            prevPipRef.current = nowPip;
        }, 300);

        return () => {
            clearInterval(interval);
            // 🔥 useEffect cleanup에서는 cleanupCanvasPip 호출하지 않음
            // PiP가 닫힐 때만 정리 (위의 polling에서 처리)
        };
    }, [navigate, cleanupCanvasPip]);

    return (
        <>
            {/* Toast */}
            <Toast
                message={toastMessage}
                visible={toastVisible}
                onClose={() => setToastVisible(false)}
            />

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
