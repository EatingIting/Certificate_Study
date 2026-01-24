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
    const handleSidebarNavigate = (path) => {
        if (isInMeeting && !document.pictureInPictureElement) {
            setTimeout(() => {
                const video = document.querySelector("video[data-main-video]");
                if (video) {
                    requestBrowserPip(video).catch(() => {});
                }
            }, 100);
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
                            requestBrowserPip(video).catch(() => {});
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
