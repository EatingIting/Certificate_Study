import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import ChatModal from "./chat/ChatModal";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";
import Board from "./board/Board";
import Calendar from "./calendar/Calendar";

import MeetingPage from "../webrtc/MeetingPage";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";

import "./LMSSubject.css";

const LMSSubjectInner = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { subjectId } = useParams();
    const { isInMeeting, isPipMode, exitPipMode, roomId } = useMeeting();

    const isMeetingRoute = location.pathname.includes("/MeetingRoom/");

    const handleReturnToMeeting = () => {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
        }
        exitPipMode();
        navigate(`/lms/${subjectId}/MeetingRoom/${roomId}`);
    };

    return (
        <>
            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar />

                <main className="subject-content">
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="attendance" element={<Attendance />} />
                        <Route path="assignment" element={<Assignment />} />
                        <Route path="assignment/:id" element={<AssignmentDetail />} />
                        <Route path="board" element={<Board />} />
                        <Route path="calendar" element={<Calendar />} />

                        {/* 회의 라우트는 URL 용도만 */}
                        <Route path="MeetingRoom/:roomId" element={<MeetingPage />} />

                        <Route
                            path="*"
                            element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />}
                        />
                    </Routes>
                </main>
            </div>

            {/* 🔥 MeetingPage는 항상 마운트 유지 */}
            {(isInMeeting || isPipMode) && roomId && (
                <div
                    className={`meeting-floating-layer ${
                        isMeetingRoute ? "show" : "hide"
                    }`}
                >
                    <MeetingPage />
                </div>
            )}

            {/* PiP 상태에서 복귀 버튼 */}
            {(isInMeeting || isPipMode) && !isMeetingRoute && (
                <button
                    className="return-to-meeting-btn"
                    onClick={handleReturnToMeeting}
                >
                    화상 채팅방으로 복귀
                </button>
            )}

            <ChatModal />
        </>
    );
};

const LMSSubject = () => {
    return (
        <MeetingProvider>
            <LMSSubjectInner />
        </MeetingProvider>
    );
};

export default LMSSubject;
