import "./LMSHeader.css";
import { Bell, MessageCircle, User, Users, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLMS } from "./LMSContext";
import { useMeeting } from "../webrtc/MeetingContext";
import { useEffect, useState, useRef } from "react";
import { toWsBackendUrl } from "../utils/backendUrl";

export default function Header() {
    const { displayName, loading, roomTitle, roomLoading, user, room } = useLMS();
    const { isInMeeting } = useMeeting();
    const navigate = useNavigate();

    const isHost =
        !!(
            user &&
            room &&
            user.email &&
            room.hostUserEmail &&
            String(user.email).trim().toLowerCase() ===
            String(room.hostUserEmail).trim().toLowerCase()
        );

    const [notifications, setNotifications] = useState([]);
    const [openDropdown, setOpenDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const userId = sessionStorage.getItem("userId");

    useEffect(() => {
        if (!userId) return;

        const wsUrl = toWsBackendUrl(`/ws/comment/${userId}`);
        console.log("댓글 WebSocket 연결:", wsUrl);

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log("댓글 WebSocket 연결 성공:", userId);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "COMMENT") {
                console.log("댓글 알림 도착:", data);

                setNotifications((prev) => [
                    {
                        id: Date.now(),
                        roomId: data.roomId,
                        postId: data.postId,
                        postTitle: data.postTitle,
                        content: data.content,
                    },
                    ...prev,
                ]);
            }
        };

        socket.onerror = (e) => {
            console.log("댓글 WebSocket 오류", e);
        };

        socket.onclose = () => {
            console.log("댓글 WebSocket 종료됨");
        };

        return () => socket.close();
    }, [userId]);

    useEffect(() => {
        const handleOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const handleClickNotification = (notif) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        setOpenDropdown(false);

        if (notif.postId && notif.roomId) {
            navigate(`/lms/${notif.roomId}/board/${notif.postId}`);
        }
    };

    return (
        <header className="lms-header">
            <div className="lms-header-left">
                <div className="logo-box" />

                <div className="lms-header-text">
                    <span className="title">
                        {roomLoading ? "로딩 중..." : roomTitle || "undefined"}
                    </span>

                    <p>
                        {loading
                            ? "로딩 중..."
                            : displayName
                                ? `${displayName}님 환영합니다!`
                                : "사용자님 환영합니다!"}
                    </p>
                </div>
            </div>

            <div className="lms-header-right">
                {isHost && (
                    <div className="host-badge">
                        <Star size={18} fill="#fbbf24" color="#fbbf24" />
                        <span className="host-text">스터디장</span>
                    </div>
                )}
                <Users
                    size={18}
                    className="icon-button"
                    onClick={() => {
                        // 회의 중이면 먼저 퇴장(WS/SFU 끊기) 후 이동 → 상대방 화면에서 내 타일 즉시 제거
                        if (isInMeeting) {
                            window.dispatchEvent(new CustomEvent("meeting:leave-and-navigate", { detail: { path: "/room" } }));
                        } else {
                            navigate("/room");
                        }
                    }}
                />

                <MessageCircle size={18} />

                <div
                    className="notif-wrapper"
                    ref={dropdownRef}
                    onClick={() => setOpenDropdown((prev) => !prev)}
                >
                    <Bell size={18} />

                    {notifications.length > 0 && (
                        <span className="notif-badge">{notifications.length}</span>
                    )}

                    {openDropdown && (
                        <div className="notif-dropdown">
                            <h4 className="notif-title">댓글 알림</h4>

                            {notifications.length === 0 ? (
                                <p className="notif-empty">새로운 알림이 없습니다.</p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className="notif-item"
                                        onClick={() => handleClickNotification(n)}
                                    >
                                        <strong>{n.postTitle}</strong>
                                        <p>
                                            {n.content.length > 30
                                                ? n.content.slice(0, 30) + "..."
                                                : n.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="profile">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
