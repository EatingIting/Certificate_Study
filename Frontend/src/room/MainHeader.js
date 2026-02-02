import "./MainHeader.css";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";
import { useEffect, useRef, useState } from "react";
import { FaBell } from "react-icons/fa";
import api from "../api/api";

import { getHostnameWithPort, getWsProtocol } from "../utils/backendUrl";

const MainHeader = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [nickname, setNickname] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [searchText, setSearchText] = useState("");

    const [hasNotification, setHasNotification] = useState(false);
    const [latestJoinId, setLatestJoinId] = useState(null);

    useEffect(() => {
        setNickname(sessionStorage.getItem("nickname"));
    }, [pathname]);


    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const userId = sessionStorage.getItem("userId");
        if (!userId) return;

        const host = getHostnameWithPort();
        const wsProtocol = getWsProtocol();

        const socket = new WebSocket(
            `${wsProtocol}://${host}/ws/notification/${userId}`
        );

        socket.onopen = () => {
            console.log(" 방장 알림 WebSocket 연결됨");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "NOTIFICATION") {
                console.log(" 신청 알림 도착:", data.content);
                setHasNotification(true);
            }
        };

        socket.onerror = (err) => {
            console.error(" WebSocket 오류 발생:", err);
        };

        return () => socket.close();
    }, []);

    const handleLogout = () => {
        sessionStorage.clear();
        localStorage.clear();
        alert("로그아웃 되었습니다.");
        navigate("/auth");
    };

    return (
        <div className="page">
            <header className="header sample-container">
                {/* 로고 */}
                <div className="logo" onClick={() => navigate("/")}>
                    ONSIL
                </div>

                {/* 검색창 */}
                <div className="search-box">
                    <input
                        placeholder="어떤 스터디를 찾고 있나요?"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                navigate(`/room?keyword=${searchText}`);
                                setSearchText("");
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            navigate(`/room?keyword=${searchText}`);
                            setSearchText("");
                        }}
                    >
                        스터디 검색
                    </button>
                </div>

                {/* 우측 메뉴 */}
                <div className="main-actions">
                    {nickname ? (
                        <div className="profile-wrapper" ref={dropdownRef}>

                            <div
                                className="notif-icon"
                                onClick={() => {
                                    if (latestJoinId) {
                                        localStorage.setItem(
                                            "lastCheckedJoinId",
                                            latestJoinId
                                        );
                                    }

                                    setHasNotification(false);
                                    navigate("/room/my-applications");
                                }}
                            >
                                <FaBell size={18} />
                                {hasNotification && (
                                    <span className="notif-dot"></span>
                                )}
                            </div>

                            {/* 닉네임 클릭 */}
                            <span
                                className="header-nickname clickable"
                                onClick={() => setIsOpen((prev) => !prev)}
                            >
                                {nickname} 님
                            </span>

                            {/* 드롭다운 메뉴 */}
                            {isOpen && (
                                <div className="dropdown">
                                    <div className="dropdown-header">
                                        {nickname}
                                    </div>

                                    <ul>
                                        <li onClick={() => navigate("/room/mypage")}>
                                            내 프로필 보기
                                        </li>
                                        <li onClick={() => navigate("/room/mystudy")}>
                                            내 클래스룸
                                        </li>
                                        <li onClick={() => navigate("/room/create")}>
                                            스터디 만들기
                                        </li>
                                    </ul>

                                    <div
                                        className="dropdown-footer"
                                        onClick={handleLogout}
                                    >
                                        로그아웃
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            className="login-btn"
                            onClick={() => navigate("/auth")}
                        >
                            로그인
                        </button>
                    )}
                </div>
            </header>

            {/* 레이아웃 분기 */}
            {pathname.startsWith("/room") ? (
                <div className="sample-container sample-layout">
                    <MainSideBar />
                    <main className="sample-content">
                        <Outlet />
                    </main>
                </div>
            ) : (
                <Outlet />
            )}
        </div>
    );
};

export default MainHeader;
