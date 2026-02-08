import "./MainHeader.css";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";
import { useEffect, useRef, useState } from "react";
import { FaBell } from "react-icons/fa";
import { toWsBackendUrl } from "../utils/backendUrl";
import { logout } from "../api/api";

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
        if (!nickname) return;

        const userId = sessionStorage.getItem("userId");
        if (!userId) return;

        const socket = new WebSocket(
            toWsBackendUrl(`/ws/notification/${userId}`)
        );

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "NOTIFICATION") {
                setHasNotification(true);
            }
        };

        return () => socket.close();
    }, [nickname]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            // ignore client-side logout failure
        }

        setIsOpen(false);
        setNickname(null);
        setHasNotification(false);
        setLatestJoinId(null);
        window.location.replace("/");
    };

    return (
        <div className="page">
            <header className="header sample-container">
                <div className="logo" onClick={() => navigate("/")}>
                    ONSIL
                </div>

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

                                    navigate("/room/my-applications", {
                                        state: { tab: "received" },
                                    });
                                }}
                            >
                                <FaBell size={18} />
                                {hasNotification && (
                                    <span className="notif-dot"></span>
                                )}
                            </div>

                            <span
                                className="header-nickname clickable"
                                onClick={() => setIsOpen((prev) => !prev)}
                            >
                                {nickname} 님
                            </span>

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
