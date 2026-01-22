import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";
import Board from "./board/Board";
import Calendar from "./calendar/Calendar"
import ChatModal from "./chat/ChatModal";

import "./LMSSubject.css";
import {Cable} from "lucide-react";

const LMSSubject = () => {
    const [activeMenu, setActiveMenu] = useState("dashboard");
    const location = useLocation();
    const { subjectId } = useParams();

    // ✅ URL이 바뀌면 사이드바 active도 자동으로 맞추기 (최소 수정 포인트)
    useEffect(() => {
        const p = location.pathname;

        if (p.includes("/assignment")) setActiveMenu("assignment");
        else if (p.includes("/attendance")) setActiveMenu("attendance");
        else if (p.includes("/board")) setActiveMenu("board");
        else if (p.includes("/calendar")) setActiveMenu("calendar");
        else setActiveMenu("dashboard");
    }, [location.pathname]);

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

                        {/* ✅ 과제 목록 / 상세 */}
                        <Route path="assignment" element={<Assignment setActiveMenu={setActiveMenu} />} />
                        <Route path="assignment/:id" element={<AssignmentDetail />} />

                        <Route path="board" element={<Board setActiveMenu={setActiveMenu} />} />
                        <Route path="calendar" element={<Calendar setActiveMenu={setActiveMenu} />} />

                        {/* 없는 경로는 대시보드로 */}
                        <Route path="*" element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />} />
                    </Routes>
                </main>
            </div>

            {/* 채팅 모달 - 모든 페이지에서 표시 */}
            <ChatModal />
        </>
    );
};

export default LMSSubject;
