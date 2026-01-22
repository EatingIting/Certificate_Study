import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import ChatModal from "./chat/ChatModal";

import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import AssignmentDetail from "./assignment/AssignmentDetail";

import Board from "./board/Board";
import BoardWrite from "./board/BoardWrite";
import BoardDetail from "./board/BoardDetail";
// import BoardEdit from "./board/BoardEdit"; // 나중에 필요하면

import Calendar from "./calendar/Calendar";
import StudyMembers from "./study-members/StudyMembers"
import StudyLeave from "./study-leave/StudyLeave"

import "./LMSSubject.css";

function LMSSubject() {
    let [activeMenu, setActiveMenu] = useState("dashboard");
    let location = useLocation();
    let { subjectId } = useParams();

    // ✅ URL이 바뀌면 사이드바 active도 자동으로 맞추기
    useEffect(() => {
        let p = location.pathname;

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

                        {/* 과제 목록 / 상세 */}
                        <Route path="assignment" element={<Assignment setActiveMenu={setActiveMenu} />} />
                        <Route path="assignment/:id" element={<AssignmentDetail />} />

                        {/* ✅ 게시판: 목록 / 글쓰기 / 상세 */}
                        <Route path="board" element={<Board setActiveMenu={setActiveMenu} />} />
                        <Route path="board/write" element={<BoardWrite setActiveMenu={setActiveMenu} />} />
                        <Route path="board/:postId" element={<BoardDetail setActiveMenu={setActiveMenu} />} />
                        {/* <Route path="board/:postId/edit" element={<BoardEdit setActiveMenu={setActiveMenu} />} /> */}

                        <Route path="calendar" element={<Calendar setActiveMenu={setActiveMenu} />} />

                        <Route path="study/members" element={<StudyMembers />}  />
                        <Route path="study/leave" element={<StudyLeave />} />

                        {/* ✅ 없는 경로는 (상대경로) 대시보드로 */}
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </main>
            </div>

            <ChatModal />
        </>
    );
}

export default LMSSubject;
