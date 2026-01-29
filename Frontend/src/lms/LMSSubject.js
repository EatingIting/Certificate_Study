import { createPortal } from "react-dom";
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import ChatModal from "./chat/ChatModal";
import Toast from "../toast/Toast";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";

import Board from "./board/Board";
import BoardWrite from "./board/BoardWrite";
import BoardDetail from "./board/BoardDetail";
import BoardEdit from "./board/BoardEdit";

import Calendar from "./calendar/Calendar";
import StudyMembers from "./study-members/StudyMembers"
import StudyLeave from "./study-leave/StudyLeave"

import RoomMyPage from "./room-my-page/RoomMyPage"

import MeetingPage from "../webrtc/MeetingPage";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";
import FloatingPip from "../webrtc/FloatingPip";
import { LMSProvider } from "./LMSContext";
import ProtectedRoute from "./ProtectedRoute";

import "./LMSSubject.css";

// 브라우저 PIP용 숨겨진 비디오 컴포넌트 (페이지 이동해도 스트림 유지)
const HiddenPipVideo = ({ videoRef }) => {
    return (
        <video
            ref={videoRef}
            style={{
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
            }}
            autoPlay
            playsInline
            muted
        />
    );
};

function LMSSubjectInner() {
    let [activeMenu, setActiveMenu] = useState("dashboard");
    let [toastMessage, setToastMessage] = useState("");
    let [toastVisible, setToastVisible] = useState(false);
    // 커스텀 PiP에서 "나가기" 클릭 시, UI는 즉시 숨김
    const [pipClosing, setPipClosing] = useState(false);
    const pipLeaveTimerRef = useRef(null);

    let location = useLocation();
    let navigate = useNavigate();
    let { subjectId } = useParams();

    useEffect(() => {
        let p = location.pathname;

        if (p.includes("/assignment")) setActiveMenu("assignment");
        else if (p.includes("/attendance")) setActiveMenu("attendance");
        else if (p.includes("/board")) setActiveMenu("board");
        else if (p.includes("/calendar")) setActiveMenu("calendar");
        else setActiveMenu("dashboard");
    }, [location.pathname]);

    // pip ux
    const {
        isInMeeting,
        isPipMode,
        isBrowserPipMode,
        roomId,
        customPipData,
        stopCustomPip,
        endMeeting,
        updateCustomPipData,
        pipVideoRef, // 숨겨진 PIP video ref
    } = useMeeting();

    // 🔥 PiP 진입/복귀 시 상대 타일 검은화면 방지: MeetingPage 단일 인스턴스 유지
    // 라우트와 무관하게 "회의 중"이면 같은 컨테이너에 한 번만 마운트 → WebSocket/프로듀서 유지
    const showMeeting = location.pathname.includes("MeetingRoom") || ((isPipMode || isBrowserPipMode) && !!roomId);
    const meetingContainerRef = useRef(null);
    const [meetingContainerReady, setMeetingContainerReady] = useState(false);
    useEffect(() => {
        if (!showMeeting) setMeetingContainerReady(false);
    }, [showMeeting]);

    // 🔥 커스텀 PiP 복귀 시 검은화면 방지: MeetingRoom 진입 후 2프레임 지연 후 컨테이너 노출
    const isOnMeetingRoom = location.pathname.includes("MeetingRoom");
    const prevPathRef = useRef(location.pathname);
    const [meetingRevealReady, setMeetingRevealReady] = useState(true);
    useEffect(() => {
        const prevPath = prevPathRef.current;
        const justEnteredMeetingRoom = isOnMeetingRoom && !prevPath.includes("MeetingRoom");
        prevPathRef.current = location.pathname;

        if (justEnteredMeetingRoom) {
            setMeetingRevealReady(false);
            let raf1, raf2;
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    setMeetingRevealReady(true);
                });
            });
            return () => {
                if (raf1) cancelAnimationFrame(raf1);
                if (raf2) cancelAnimationFrame(raf2);
            };
        }
        if (isOnMeetingRoom) setMeetingRevealReady(true);
    }, [location.pathname, isOnMeetingRoom]);

    // 커스텀 PIP에서 회의방 복귀 (검은화면 방지: 먼저 이동 → 회의 화면 그려질 시간 뒤 PiP 숨김)
    const handlePipReturn = useCallback(() => {
        console.log("[CustomPiP] 회의방 복귀");
        const savedRoomId = sessionStorage.getItem("pip.roomId");
        const savedSubjectId = sessionStorage.getItem("pip.subjectId");

        if (savedRoomId && savedSubjectId) {
            navigate(`/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`, { replace: true });
            // 🔥 먼저 이동 후 120ms 뒤 PiP 숨김 → 회의 컨테이너가 그려진 뒤 전환되어 검은화면 방지
            setTimeout(() => stopCustomPip(), 120);
        } else {
            stopCustomPip();
        }
    }, [navigate, stopCustomPip]);

    // 커스텀 PIP에서 회의 나가기
    const handlePipLeave = useCallback(() => {
        console.log("[CustomPiP] 회의 나가기");

        // LEAVE 이벤트 발생 (MeetingPage에서 처리)
        window.dispatchEvent(new CustomEvent("meeting:leave-from-pip"));

        // UI는 즉시 숨김 (사용자 체감 즉시 반응)
        setPipClosing(true);

        // 소켓으로 LEAVE가 전달될 시간을 조금 준 뒤 정리/언마운트
        if (pipLeaveTimerRef.current) {
            clearTimeout(pipLeaveTimerRef.current);
        }
        pipLeaveTimerRef.current = setTimeout(() => {
            stopCustomPip();
            endMeeting();

            // 세션 정리
            sessionStorage.removeItem("pip.roomId");
            sessionStorage.removeItem("pip.subjectId");

            setPipClosing(false);
            pipLeaveTimerRef.current = null;
        }, 600);
    }, [stopCustomPip, endMeeting]);

    // cleanup
    useEffect(() => {
        return () => {
            if (pipLeaveTimerRef.current) {
                clearTimeout(pipLeaveTimerRef.current);
                pipLeaveTimerRef.current = null;
            }
        };
    }, []);

    // Sidebar 이동 시
    const handleSidebarNavigate = (path) => {
        navigate(`/lms/${subjectId}/${path}`);
    };

    //Toast 이벤트
    useEffect(() => {
        const handler = (e) => {
            if (!e.detail) return;
            setToastMessage(e.detail);
            setToastVisible(true);
        };

        window.addEventListener("ui:toast", handler);
        return () => window.removeEventListener("ui:toast", handler);
    }, []);


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
                    {/* 🔥 PiP 진입/복귀 시 상대 타일 검은화면 방지: MeetingPage 단일 인스턴스 유지
                        회의 중이면 같은 컨테이너에 한 번만 마운트 → 라우트 이동해도 WebSocket/프로듀서 유지 */}
                    {showMeeting && (
                        <div
                            ref={(el) => {
                                meetingContainerRef.current = el;
                                if (el && showMeeting) setMeetingContainerReady(true);
                                if (!el) setMeetingContainerReady(false);
                            }}
                            className="meeting-persistent-container"
                            style={{
                                display: "block",
                                position: isOnMeetingRoom ? "relative" : "fixed",
                                left: isOnMeetingRoom ? 0 : -9999,
                                top: 0,
                                width: "100%",
                                height: "100%",
                                visibility: isOnMeetingRoom ? "visible" : "hidden",
                                zIndex: isOnMeetingRoom ? 1 : -1,
                                pointerEvents: isOnMeetingRoom ? "auto" : "none",
                                // 🔥 커스텀 PiP 복귀 시 검은화면 방지: 2프레임 지연 후 노출
                                opacity: isOnMeetingRoom ? (meetingRevealReady ? 1 : 0) : 0,
                                transition: meetingRevealReady ? "opacity 0.08s ease-out" : "none",
                            }}
                        />
                    )}
                    {showMeeting && meetingContainerReady && meetingContainerRef.current &&
                        createPortal(<MeetingPage />, meetingContainerRef.current)}

                    {/* MeetingRoom 경로가 아닐 때만 Routes 표시 (회의 중이면 위 컨테이너에 MeetingPage 표시) */}
                    <div style={{ display: isOnMeetingRoom ? "none" : "block", width: "100%" }}>
                        <Routes>
                            <Route index element={<Navigate to="dashboard" replace />} />

                            <Route path="dashboard" element={<Dashboard setActiveMenu={setActiveMenu} />} />
                            <Route path="attendance" element={<Attendance setActiveMenu={setActiveMenu} />} />

                            <Route path="assignment" element={<Assignment setActiveMenu={setActiveMenu} />} />
                            <Route path="assignment/:id" element={<AssignmentDetail />} />

                            <Route path="board" element={<Board setActiveMenu={setActiveMenu} />} />
                            <Route path="board/write" element={<BoardWrite setActiveMenu={setActiveMenu} />} />
                            <Route path="board/:postId" element={<BoardDetail setActiveMenu={setActiveMenu} />} />
                            <Route path="board/:postId/edit" element={<BoardEdit setActiveMenu={setActiveMenu} />} />

                            <Route path="calendar" element={<Calendar setActiveMenu={setActiveMenu} />} />

                            <Route path="study/members" element={<StudyMembers />} />
                            <Route path="study/leave" element={<StudyLeave />} />

                            <Route path="mypage" element={<RoomMyPage />} />

                            {/* MeetingPage는 위 persistent container에만 렌더 (단일 인스턴스) */}
                            <Route path="MeetingRoom/:roomId" element={null} />

                            <Route path="*" element={<Navigate to="dashboard" replace />} />
                        </Routes>
                    </div>
                </main>
            </div>

            {/* 브라우저 PIP용 숨겨진 video */}
            <HiddenPipVideo videoRef={pipVideoRef} />

            {/* 커스텀 PIP (브라우저 PIP가 아닐 때만 표시) */}
            {customPipData && !isBrowserPipMode && !pipClosing && (
                <FloatingPip
                    stream={customPipData.stream}
                    peerName={customPipData.peerName}
                    onReturn={handlePipReturn}
                    onLeave={handlePipLeave}
                    onStreamInvalid={updateCustomPipData} // 스트림 무효 시 업데이트
                />
            )}

            {/* 현재 경로가 'MeetingRoom/' 을 포함하지 않을 때만 렌더링 */}
            {!location.pathname.includes("/MeetingRoom/") && (
                <ChatModal roomId={subjectId} />
            )}
        </>
    );
}

const LMSSubject = () => {
    const { subjectId } = useParams();
    
    return (
        <LMSProvider roomId={subjectId}>
            <ProtectedRoute>
                <MeetingProvider>
                    <LMSSubjectInner />
                </MeetingProvider>
            </ProtectedRoute>
        </LMSProvider>
    );
};

export default LMSSubject;