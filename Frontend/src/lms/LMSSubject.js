import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";

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
// import BoardEdit from "./board/BoardEdit"; // 나중에 필요하면

import Calendar from "./calendar/Calendar";
import StudyMembers from "./study-members/StudyMembers"
import StudyLeave from "./study-leave/StudyLeave"

import RoomMyPage from "./room-my-page/RoomMyPage"

import MeetingPage from "../webrtc/MeetingPage";
import MeetingPortal from "../webrtc/MeetingPagePortal";
import { MeetingProvider, useMeeting } from "../webrtc/MeetingContext";
import FloatingPip from "../webrtc/FloatingPip";

import "./LMSSubject.css";

// 🔥 PIP 모드에서 MeetingPortal을 숨긴 상태로 렌더링 (WebSocket/스트림 유지용)
const MeetingPortalHidden = ({ show }) => {
    useEffect(() => {
        const meetingRoot = document.getElementById("meeting-root");
        if (meetingRoot) {
            if (show) {
                // 🔥 display:none 금지 (비디오/트랙이 멈출 수 있음) → 화면 밖으로 숨김
                meetingRoot.style.display = "block";
                meetingRoot.style.position = "fixed";
                meetingRoot.style.left = "-10000px";
                meetingRoot.style.top = "-10000px";
                meetingRoot.style.width = "1px";
                meetingRoot.style.height = "1px";
                meetingRoot.style.opacity = "0";
                meetingRoot.style.pointerEvents = "none";
                meetingRoot.style.zIndex = "-1";
            } else {
                meetingRoot.style.display = "";
                meetingRoot.style.position = "";
                meetingRoot.style.left = "";
                meetingRoot.style.top = "";
                meetingRoot.style.width = "";
                meetingRoot.style.height = "";
                meetingRoot.style.opacity = "";
                meetingRoot.style.pointerEvents = "";
                meetingRoot.style.zIndex = "";
            }
        }
        return () => {
            if (meetingRoot) {
                meetingRoot.style.display = "";
                meetingRoot.style.position = "";
                meetingRoot.style.left = "";
                meetingRoot.style.top = "";
                meetingRoot.style.width = "";
                meetingRoot.style.height = "";
                meetingRoot.style.opacity = "";
                meetingRoot.style.pointerEvents = "";
                meetingRoot.style.zIndex = "";
            }
        };
    }, [show]);

    if (!show) return null;
    return <MeetingPortal />;
};

// 🔥 브라우저 PIP용 숨겨진 비디오 컴포넌트 (페이지 이동해도 스트림 유지)
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
    
    let location = useLocation();
    let navigate = useNavigate();
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

    /* =========================
       PiP UX (커스텀 PIP)
    ========================= */
    const {
        isInMeeting,
        isPipMode,
        isBrowserPipMode,
        roomId,
        customPipData,
        stopCustomPip,
        endMeeting,
        updateCustomPipData,
        pipVideoRef, // 🔥 숨겨진 PIP video ref
    } = useMeeting();

    // 커스텀 PIP에서 회의방 복귀
    const handlePipReturn = useCallback(() => {
        console.log("[CustomPiP] 회의방 복귀");
        stopCustomPip();

        const savedRoomId = sessionStorage.getItem("pip.roomId");
        const savedSubjectId = sessionStorage.getItem("pip.subjectId");

        if (savedRoomId && savedSubjectId) {
            navigate(`/lms/${savedSubjectId}/MeetingRoom/${savedRoomId}`, { replace: true });
        }
    }, [navigate, stopCustomPip]);

    // 커스텀 PIP에서 회의 나가기
    const handlePipLeave = useCallback(() => {
        console.log("[CustomPiP] 회의 나가기");
        
        // LEAVE 이벤트 발생 (MeetingPage에서 처리)
        window.dispatchEvent(new CustomEvent("meeting:leave-from-pip"));
        
        stopCustomPip();
        endMeeting();

        // 세션 정리
        sessionStorage.removeItem("pip.roomId");
        sessionStorage.removeItem("pip.subjectId");
    }, [stopCustomPip, endMeeting]);

    /* =========================
       Sidebar 이동 시 (PIP는 LMSSidebar에서 처리)
    ========================= */
    const handleSidebarNavigate = (path) => {
        // PIP 요청은 LMSSidebar에서 직접 처리하므로 여기서는 네비게이션만
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

                        <Route path="mypage" element={<RoomMyPage />} />

                        <Route path="MeetingRoom/:roomId" element={<MeetingPage />} />

                        {/* ✅ 없는 경로는 (상대경로) 대시보드로 */}
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </main>
            </div>

            {/* 🔥 브라우저 PIP용 숨겨진 video (스트림 동기화용) */}
            <HiddenPipVideo videoRef={pipVideoRef} />

            {/* MeetingPortal: 브라우저 PIP/커스텀 PIP 모두에서 렌더링 (RTCPeerConnection 유지) */}
            <MeetingPortalHidden
                show={(isPipMode || isBrowserPipMode) && !!roomId && !location.pathname.includes("/MeetingRoom/")}
            />

            {/* 커스텀 PIP (브라우저 PIP가 아닐 때만 표시) */}
            {customPipData && !isBrowserPipMode && (
                <FloatingPip
                    stream={customPipData.stream}
                    peerName={customPipData.peerName}
                    onReturn={handlePipReturn}
                    onLeave={handlePipLeave}
                    onStreamInvalid={updateCustomPipData} // 🔥 추가: 스트림 무효 시 업데이트
                />
            )}

            <ChatModal />
        </>
    );
}

const LMSSubject = () => (
    <MeetingProvider>
        <LMSSubjectInner />
    </MeetingProvider>
);

export default LMSSubject;