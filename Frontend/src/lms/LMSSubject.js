import { useEffect, useState } from "react";
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
import PipFloatingWindow from "../webrtc/PipFloatingWindow";

import "./LMSSubject.css";

// 내부 컴포넌트 - MeetingContext 사용
const LMSSubjectInner = () => {
    const [activeMenu, setActiveMenu] = useState("dashboard");
    const location = useLocation();
    const navigate = useNavigate();
    const { subjectId } = useParams();
    const { isInMeeting, isPipMode, enterPipMode, exitPipMode, roomId } = useMeeting();

    // URL이 바뀌면 사이드바 active도 자동으로 맞추기
    useEffect(() => {
        const p = location.pathname;

        if (p.includes("/assignment")) setActiveMenu("assignment");
        else if (p.includes("/attendance")) setActiveMenu("attendance");
        else if (p.includes("/board")) setActiveMenu("board");
        else if (p.includes("/calendar")) setActiveMenu("calendar");
        else if (p.includes("/meeting")) setActiveMenu("meeting");
        else setActiveMenu("dashboard");
    }, [location.pathname]);

    // 회의 중 다른 페이지로 이동하면 자동으로 PiP 모드로 전환
    useEffect(() => {
        const isMeetingPage = location.pathname.includes("/meeting/");

        if (isInMeeting && !isMeetingPage && !isPipMode) {
            enterPipMode();
        }
    }, [location.pathname, isInMeeting, isPipMode, enterPipMode]);

    // PiP에서 회의로 돌아가기
    const handleReturnToMeeting = () => {
        exitPipMode();
        navigate(`/lms/${subjectId}/meeting/${roomId}`);
    };

    return (
        <>
            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

                <main className="subject-content">
                    <Routes>
                        {/* /lms/:subjectId 로 오면 대시보드로 */}
                        <Route index element={<Navigate to="dashboard" replace />} />

                        <Route path="dashboard" element={<Dashboard setActiveMenu={setActiveMenu} />} />
                        <Route path="attendance" element={<Attendance setActiveMenu={setActiveMenu} />} />

                        {/* 과제 목록 / 상세 */}
                        <Route path="assignment" element={<Assignment setActiveMenu={setActiveMenu} />} />
                        <Route path="assignment/:id" element={<AssignmentDetail />} />

                        <Route path="board" element={<Board setActiveMenu={setActiveMenu} />} />
                        <Route path="calendar" element={<Calendar setActiveMenu={setActiveMenu} />} />

                        {/* 화상 채팅 */}
                        <Route path="meeting/:roomId" element={<MeetingPage />} />

                        {/* 없는 경로는 대시보드로 */}
                        <Route path="*" element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />} />
                    </Routes>
                </main>
            </div>

            {/* 채팅 모달 - 모든 페이지에서 표시 */}
            <ChatModal />

            {/* PiP 플로팅 창 - 회의 중 다른 페이지에서 표시 */}
            {isPipMode && (
                <PipFloatingWindow onReturnToMeeting={handleReturnToMeeting} />
            )}
        </>
    );
};

// 외부 래퍼 컴포넌트 - MeetingProvider 제공
const LMSSubject = () => {
    return (
        <MeetingProvider>
            <LMSSubjectInner />
        </MeetingProvider>
    );
};

export default LMSSubject;
