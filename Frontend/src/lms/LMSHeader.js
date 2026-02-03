import "./LMSHeader.css";
import { Bell, MessageCircle, User, Star } from "lucide-react";
import { useLMS } from "./LMSContext";

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { getHostnameWithPort, getWsProtocol } from "../utils/backendUrl";

export default function Header() {
    const { displayName, loading, roomTitle, roomLoading, user, room } = useLMS();
    const navigate = useNavigate();

    // ==========================
    // ✅ 방장 여부
    // ==========================
    const isHost =
        !!(
            user &&
            room &&
            user.email &&
            room.hostUserEmail &&
            String(user.email).trim().toLowerCase() ===
            String(room.hostUserEmail).trim().toLowerCase()
        );

    // ==========================
    // ✅ 알림 리스트 상태
    // ==========================
    const [notifications, setNotifications] = useState([]);

    // 드롭다운 열림 여부
    const [openDropdown, setOpenDropdown] = useState(false);

    // 바깥 클릭 감지용 ref
    const dropdownRef = useRef(null);

    // ==========================
    // ✅ WebSocket 연결
    // ==========================
    useEffect(() => {
        const userId = sessionStorage.getItem("userId");
        if (!userId) return;

        const host = getHostnameWithPort();
        const wsProtocol = getWsProtocol();

        console.log("🔥 notification 연결 시도 URL:",
            `${wsProtocol}://${host}/ws/notification/${userId}`
        );

        const socket = new WebSocket(
            `${wsProtocol}://${host}/ws/notification/${userId}`
        );

        socket.onopen = () => {
            console.log("✅ 댓글 알림 WebSocket 연결됨");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "NOTIFICATION") {
                console.log("🔔 댓글 알림 도착:", data);

                // ✅ 새 알림 추가
                setNotifications((prev) => [
                    {
                        id: Date.now(),
                        content: data.content,
                        postId: data.postId,
                    },
                    ...prev,
                ]);
            }
        };

        socket.onerror = (err) => {
            console.error("❌ WebSocket 오류:", err);
        };

        return () => socket.close();
    }, []);

    // ==========================
    // ✅ 바깥 클릭하면 닫기
    // ==========================
    useEffect(() => {
        const handleOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    // ==========================
    // ✅ 알림 클릭 → 이동 + 삭제
    // ==========================
    const handleClickNotification = (notif) => {
        // 클릭한 알림 제거
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));

        // 드롭다운 닫기
        setOpenDropdown(false);

        // ✅ 게시글 상세로 이동
        if (notif.postId) {
            navigate(`/room/board/detail/${notif.postId}`);
        }
    };

    return (
        <header className="lms-header">
            {/* ========================== */}
            {/* ✅ 왼쪽 */}
            {/* ========================== */}
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

            {/* ========================== */}
            {/* ✅ 오른쪽 */}
            {/* ========================== */}
            <div className="lms-header-right">
                {/* 방장 배지 */}
                {isHost && (
                    <div className="host-badge" title="스터디장">
                        <Star size={18} fill="#fbbf24" color="#fbbf24" />
                        <span className="host-text">(스터디장)</span>
                    </div>
                )}

                {/* 채팅 아이콘 */}
                <MessageCircle size={18} />

                {/* ========================== */}
                {/* ✅ Bell 알림 */}
                {/* ========================== */}
                <div
                    className="notif-wrapper"
                    ref={dropdownRef}
                    onClick={() => setOpenDropdown((prev) => !prev)}
                >
                    <Bell size={18} />

                    {/* ✅ 숫자 배지 */}
                    {notifications.length > 0 && (
                        <span className="notif-badge">{notifications.length}</span>
                    )}

                    {/* ========================== */}
                    {/* ✅ 알림 드롭다운 */}
                    {/* ========================== */}
                    {openDropdown && (
                        <div className="notif-dropdown">
                            <h4 className="notif-title">댓글 알림</h4>

                            {/* 알림 없음 */}
                            {notifications.length === 0 ? (
                                <p className="notif-empty">새로운 알림이 없습니다.</p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className="notif-item"
                                        onClick={() => handleClickNotification(n)}
                                    >
                                        <strong>게시글 댓글</strong>
                                        <p>{n.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* 프로필 */}
                <div className="profile">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
