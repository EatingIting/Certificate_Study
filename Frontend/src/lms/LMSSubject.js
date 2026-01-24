import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

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
import MeetingPortal from "../webrtc/MeetingPagePortal";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";

import "./LMSSubject.css";

const LMSSubjectInner = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { subjectId } = useParams();

    const {
        isInMeeting,
        isPipMode,
        roomId,
        requestBrowserPip,
    } = useMeeting();

    const isMeetingRoute = location.pathname.includes("/MeetingRoom/");

    // =========================
    // 🔥 사이드바 이동 핸들러
    // =========================
    const handleSidebarNavigate = (path) => {
        if (isInMeeting && !document.pictureInPictureElement) {
            // 비디오 요소 찾기 (약간의 지연을 두어 DOM 업데이트 대기)
            setTimeout(() => {
                const video = document.querySelector("video[data-main-video]");
                if (video && video.readyState >= 1) { // HAVE_METADATA 이상
                    requestBrowserPip(video).catch((err) => {
                        console.warn("[PiP] 사이드바 이동 시 PiP 요청 실패:", err);
                    });
                } else if (video) {
                    // 메타데이터가 아직 로드되지 않았으면 requestBrowserPip 내부에서 대기
                    requestBrowserPip(video).catch((err) => {
                        console.warn("[PiP] 사이드바 이동 시 PiP 요청 실패:", err);
                    });
                }
            }, 100); // DOM 업데이트 대기
        }

        navigate(`/lms/${subjectId}/${path}`);
    };

    // =========================
    // 🔁 PiP 종료 감지 → 회의방 복귀
    // =========================
    useEffect(() => {
        let prevPip = !!document.pictureInPictureElement;

        const interval = setInterval(() => {
            const nowPip = !!document.pictureInPictureElement;

            if (prevPip && !nowPip) {
                const savedRoomId = sessionStorage.getItem("pip.roomId");
                const savedSubjectId = sessionStorage.getItem("pip.subjectId");

                if (!savedRoomId || !savedSubjectId) return;

                const meetingPath = `/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`;

                if (location.pathname !== meetingPath) {
                    navigate(meetingPath, { replace: true });
                }
            }

            prevPip = nowPip;
        }, 300);

        return () => clearInterval(interval);
    }, [location.pathname, navigate]);

    return (
        <>
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

                        {/* 회의 라우트 */}
                        <Route path="MeetingRoom/:roomId" element={<MeetingPage />} />

                        <Route
                            path="*"
                            element={<Navigate to={`/lms/${subjectId}/dashboard`} replace />}
                        />
                    </Routes>
                </main>
            </div>

            {/* 🔥 회의 화면은 Portal로 항상 유지 */}
            {(isInMeeting || isPipMode) && roomId && <MeetingPortal />}

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
