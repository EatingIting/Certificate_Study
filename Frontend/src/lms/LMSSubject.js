import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation, useParams, useNavigate, useMatch } from "react-router-dom";

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

// 내부 컴포넌트 - MeetingContext 사용
const LMSSubjectInner = () => {
    const [activeMenu, setActiveMenu] = useState("dashboard");
    const location = useLocation();
    const { subjectId } = useParams();
    const navigate = useNavigate();
    const { isInMeeting, meetingUrl, roomId: contextRoomId } = useMeeting();

    // 현재 회의 페이지에 있는지 확인
    const isOnMeetingPage = location.pathname.includes("/meeting/");

    // URL에서 roomId 추출 (회의 페이지가 아닐 때도 MeetingPage 유지용)
    const meetingMatch = useMatch("/lms/:subjectId/meeting/:roomId");
    const urlRoomId = meetingMatch?.params?.roomId;

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

    // ✅ PIP 복귀 이벤트 리스너 - LMSSubject 레벨에서 관리
    useEffect(() => {
        const handlePipLeave = () => {
            console.log("[LMSSubject] PIP left, isInMeeting:", isInMeeting, "isOnMeetingPage:", isOnMeetingPage);

            // 회의 중이고 현재 회의 페이지가 아니면 회의 페이지로 이동
            if (isInMeeting && !location.pathname.includes("/meeting/")) {
                const targetUrl = meetingUrl || `/lms/${subjectId}/meeting/${contextRoomId}`;
                console.log("[LMSSubject] Navigating to meeting page:", targetUrl);
                navigate(targetUrl);
            }
        };

        document.addEventListener("leavepictureinpicture", handlePipLeave);
        return () => {
            document.removeEventListener("leavepictureinpicture", handlePipLeave);
        };
    }, [isInMeeting, meetingUrl, contextRoomId, subjectId, navigate, location.pathname]);

    // MeetingPage를 표시할지 여부 (회의 중이거나 회의 페이지에 있을 때)
    const showMeetingPage = isOnMeetingPage || isInMeeting;
    // 실제 사용할 roomId (URL 우선, 없으면 context)
    const effectiveRoomId = urlRoomId || contextRoomId;

    return (
        <>
            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

                <main className="subject-content">
                    {/* ✅ MeetingPage를 Routes 밖에서 조건부 렌더링 (PIP 모드에서도 언마운트 방지) */}
                    {showMeetingPage && effectiveRoomId && (
                        <div style={{ display: isOnMeetingPage ? 'block' : 'none', height: '100%' }}>
                            <MeetingPage key={effectiveRoomId} roomId={effectiveRoomId} subjectId={subjectId} />
                        </div>
                    )}

                    <div style={{ display: isOnMeetingPage ? 'none' : 'block', height: '100%' }}>
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

                            {/* 화상 채팅은 위에서 별도로 렌더링 */}
                            <Route path="meeting/:roomId" element={<div />} />

                            {/* 없는 경로는 대시보드로 */}
                            <Route path="*" element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />} />
                        </Routes>
                    </div>
                </main>
            </div>

            {/* 채팅 모달 - 모든 페이지에서 표시 */}
            <ChatModal />
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
