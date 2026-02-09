import { createPortal } from "react-dom";
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import ChatModal from "./chat/ChatModal";
import Toast from "../toast/Toast";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import AttendanceAll from "./attendance/AttendanceAll";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";

import AnswerNote from "./answernote/AnswerNote";

import Board from "./board/Board";
import BoardWrite from "./board/BoardWrite";
import BoardDetail from "./board/BoardDetail";
import BoardEdit from "./board/BoardEdit";

import Calendar from "./calendar/Calendar";
import StudyMembers from "./study-members/StudyMembers";
import StudyLeave from "./study-leave/StudyLeave";

import RoomMyPage from "./room-my-page/RoomMyPage";

import MeetingPage from "../webrtc/MeetingPage";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";
import FloatingPip from "../webrtc/FloatingPip";
import { LMSProvider, useLMS } from "./LMSContext";
import ProtectedRoute from "./ProtectedRoute";

import "./LMSSubject.css";

// 브라우저 PiP용 숨김 비디오
const HiddenPipVideo = ({ videoRef }) => {
    return (
        <video
            ref={videoRef}
            style={{
                position: "fixed",
                top: "-9999px",
                left: "-9999px",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
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
    const [forcedKickModalOpen, setForcedKickModalOpen] = useState(false);
    const accessDeniedHandledRef = useRef(false);

    const [pipClosing, setPipClosing] = useState(false);
    const pipLeaveTimerRef = useRef(null);

    let location = useLocation();
    let navigate = useNavigate();
    let { subjectId } = useParams();
    const { roomLoading, accessDenied, accessDeniedReason, roomTitle } = useLMS();

    // 비멤버 접근 차단 처리
    useEffect(() => {
        if (!subjectId || roomLoading) return;

        if (!accessDenied) {
            accessDeniedHandledRef.current = false;
            setForcedKickModalOpen(false);
            return;
        }

        if (accessDeniedHandledRef.current) return;
        accessDeniedHandledRef.current = true;

        if (String(accessDeniedReason || "").toUpperCase() === "KICK") {
            setForcedKickModalOpen(true);
            return;
        }

        alert("스터디원만 접근할 수 있습니다.");
        navigate("/", { replace: true });
    }, [subjectId, roomLoading, accessDenied, accessDeniedReason, navigate]);

    // URL에서 MeetingRoom roomId 추출
    const meetingRoomIdFromPath = useMemo(() => {
        const match = location.pathname.match(/\/MeetingRoom\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    useEffect(() => {
        let p = location.pathname;

        if (p.includes("/assignment")) setActiveMenu("assignment");
        else if (p.includes("/attendance")) setActiveMenu("attendance");
        else if (p.includes("/board")) setActiveMenu("board");
        else if (p.includes("/answernote/problem")) setActiveMenu("answernote/problem");
        else if (p.includes("/answernote/summary")) setActiveMenu("answernote/summary");
        else if (p.includes("/answernote")) setActiveMenu("answernote/all");
        else if (p.includes("/calendar")) setActiveMenu("calendar");
        else setActiveMenu("dashboard");
    }, [location.pathname]);

    const {
        isInMeeting,
        isPipMode,
        isBrowserPipMode,
        roomId,
        customPipData,
        stopCustomPip,
        endMeeting,
        updateCustomPipData,
        pipVideoRef,
    } = useMeeting();

    // MeetingPage를 단일 인스턴스로 유지
    const showMeeting = location.pathname.includes("MeetingRoom") || ((isPipMode || isBrowserPipMode) && !!roomId);
    const meetingContainerRef = useRef(null);
    const [meetingContainerReady, setMeetingContainerReady] = useState(false);

    useEffect(() => {
        if (!showMeeting) setMeetingContainerReady(false);
    }, [showMeeting]);

    const isOnMeetingRoom = location.pathname.includes("MeetingRoom");
    const prevPathRef = useRef(location.pathname);
    const [meetingRevealReady, setMeetingRevealReady] = useState(true);

    useEffect(() => {
        const prevPath = prevPathRef.current;
        const justEnteredMeetingRoom = isOnMeetingRoom && !prevPath.includes("MeetingRoom");
        prevPathRef.current = location.pathname;

        if (justEnteredMeetingRoom) {
            setMeetingRevealReady(false);
            let raf1;
            let raf2;
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

    // 커스텀 PiP -> 회의 복귀
    const handlePipReturn = useCallback(() => {
        console.log("[CustomPiP] 회의방 복귀");
        const savedRoomId = sessionStorage.getItem("pip.roomId");
        const savedSubjectId = sessionStorage.getItem("pip.subjectId");
        const savedScheduleId = sessionStorage.getItem("pip.scheduleId");

        if (savedRoomId && savedSubjectId) {
            const targetPath = savedScheduleId
                ? `/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}?scheduleId=${encodeURIComponent(savedScheduleId)}`
                : `/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`;
            navigate(targetPath, { replace: true });
            setTimeout(() => stopCustomPip(), 120);
        } else {
            stopCustomPip();
        }
    }, [navigate, stopCustomPip]);

    // 커스텀 PiP -> 회의 종료
    const handlePipLeave = useCallback(() => {
        console.log("[CustomPiP] leave meeting");

        window.dispatchEvent(new CustomEvent("meeting:leave-from-pip"));
        setPipClosing(true);

        if (pipLeaveTimerRef.current) {
            clearTimeout(pipLeaveTimerRef.current);
        }

        pipLeaveTimerRef.current = setTimeout(() => {
            stopCustomPip();
            endMeeting();

            sessionStorage.removeItem("pip.roomId");
            sessionStorage.removeItem("pip.subjectId");
            sessionStorage.removeItem("pip.scheduleId");

            setPipClosing(false);
            pipLeaveTimerRef.current = null;
        }, 120);
    }, [stopCustomPip, endMeeting]);

    useEffect(() => {
        return () => {
            if (pipLeaveTimerRef.current) {
                clearTimeout(pipLeaveTimerRef.current);
                pipLeaveTimerRef.current = null;
            }
        };
    }, []);

    const handleSidebarNavigate = (path) => {
        navigate(`/lms/${subjectId}/${path}`);
    };

    useEffect(() => {
        const handler = (e) => {
            if (!e.detail) return;
            setToastMessage(e.detail);
            setToastVisible(true);
        };

        window.addEventListener("ui:toast", handler);
        return () => window.removeEventListener("ui:toast", handler);
    }, []);

    if (accessDenied && subjectId) {
        return (
            <div className="lms-access-denied-wrap">
                <div className="lms-access-denied-text">접근 권한이 없습니다. 메인으로 이동합니다...</div>
                {forcedKickModalOpen && (
                    <div className="lms-kick-modal-overlay" role="dialog" aria-modal="true">
                        <div className="lms-kick-modal">
                            <p className="lms-kick-modal-title">안내</p>
                            <p className="lms-kick-modal-message">스터디장에 의하여 LMS에서 강제퇴장 되었습니다.</p>
                            <button
                                type="button"
                                className="lms-kick-modal-confirm"
                                onClick={() => {
                                    setForcedKickModalOpen(false);
                                    navigate("/", { replace: true });
                                }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <Toast
                message={toastMessage}
                visible={toastVisible}
                onClose={() => setToastVisible(false)}
            />

            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar onNavigate={handleSidebarNavigate} />

                <main className="subject-content">
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
                                opacity: isOnMeetingRoom ? (meetingRevealReady ? 1 : 0) : 0,
                                transition: meetingRevealReady ? "opacity 0.08s ease-out" : "none",
                            }}
                        />
                    )}

                    {showMeeting &&
                        meetingContainerReady &&
                        meetingContainerRef.current &&
                        createPortal(<MeetingPage portalRoomId={meetingRoomIdFromPath} />, meetingContainerRef.current)}

                    <div style={{ display: isOnMeetingRoom ? "none" : "block", width: "100%" }}>
                        <Routes>
                            <Route index element={<Navigate to="dashboard" replace />} />

                            <Route path="dashboard" element={<Dashboard setActiveMenu={setActiveMenu} />} />
                            <Route path="attendance" element={<Attendance setActiveMenu={setActiveMenu} />} />
                            <Route path="attendance/all" element={<AttendanceAll setActiveMenu={setActiveMenu} />} />

                            <Route path="assignment" element={<Assignment setActiveMenu={setActiveMenu} />} />
                            <Route path="assignment/:id" element={<AssignmentDetail />} />

                            <Route path="board" element={<Board setActiveMenu={setActiveMenu} />} />
                            <Route path="board/write" element={<BoardWrite setActiveMenu={setActiveMenu} />} />
                            <Route path="board/:postId" element={<BoardDetail setActiveMenu={setActiveMenu} />} />
                            <Route path="board/:postId/edit" element={<BoardEdit setActiveMenu={setActiveMenu} />} />

                            <Route path="answernote" element={<AnswerNote mode="all" />} />
                            <Route path="answernote/summary" element={<AnswerNote mode="summary" />} />
                            <Route path="answernote/problem" element={<AnswerNote mode="problem" />} />

                            <Route path="calendar" element={<Calendar setActiveMenu={setActiveMenu} />} />

                            <Route path="study/members" element={<StudyMembers />} />
                            <Route path="study/leave" element={<StudyLeave />} />

                            <Route path="mypage" element={<RoomMyPage />} />

                            <Route path="MeetingRoom/:roomId" element={null} />

                            <Route path="*" element={<Navigate to="dashboard" replace />} />
                        </Routes>
                    </div>
                </main>
            </div>

            <HiddenPipVideo videoRef={pipVideoRef} />

            {customPipData && !isBrowserPipMode && !pipClosing && (
                <FloatingPip
                    stream={customPipData.stream}
                    peerName={customPipData.peerName}
                    onReturn={handlePipReturn}
                    onLeave={handlePipLeave}
                    onStreamInvalid={updateCustomPipData}
                />
            )}

            {!location.pathname.includes("/MeetingRoom/") && (
                <ChatModal roomId={subjectId} roomName={roomTitle} />
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
