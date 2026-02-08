import "./MainSideBar.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { logout } from "../api/api";

const MainSideBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isLoggedIn = Boolean(sessionStorage.getItem("accessToken"));

    const isExact = (path) => location.pathname === path;
    const isParentActive = (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/");

    const [openKeys, setOpenKeys] = useState(["study", "account"]);

    const toggleParent = (key) => {
        setOpenKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const go = (path) => navigate(path);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            // ignore client-side logout failure
        }

        alert("로그아웃 되었습니다.");

        navigate("/auth");
    };

    return (
        <aside className="sample-sidebar">
            <div className="sb-scroll">
                <ul className="menu-list">
                    <li
                        className={`menu-item menu-single ${isExact("/") ? "active" : ""}`}
                        onClick={() => go("/")}
                    >
                        홈
                    </li>

                    <li className={`menu-group ${openKeys.includes("study") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${
                                isParentActive("/room") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("study")}
                        >
                            <span className="menu-label">스터디</span>
                            <span className="arrow">
                                {openKeys.includes("study") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${isExact("/room") ? "active" : ""}`}
                                onClick={() => go("/room")}
                            >
                                가입 가능한 스터디
                            </li>

                            <li
                                className={`submenu-item ${
                                    isExact("/room/create") ? "active" : ""
                                }`}
                                onClick={() => go("/room/create")}
                            >
                                스터디 만들기
                            </li>
                        </ul>
                    </li>

                    <li className={`menu-group ${openKeys.includes("account") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${
                                isParentActive("/auth") || isParentActive("/mypage")
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() => toggleParent("account")}
                        >
                            <span className="menu-label">계정</span>
                            <span className="arrow">
                                {openKeys.includes("account") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            {isLoggedIn ? (
                                <>
                                    <li
                                        className={`submenu-item ${
                                            isExact("/room/mystudy") ? "active" : ""
                                        }`}
                                        onClick={() => go("/room/mystudy")}
                                    >
                                        내 스터디
                                    </li>

                                    <li
                                        className={`submenu-item ${
                                            isExact("/room/my-applications") ? "active" : ""
                                        }`}
                                        onClick={() => go("/room/my-applications")}
                                    >
                                        스터디 신청현황
                                    </li>
                                    <li
                                        className={`submenu-item ${
                                            isExact("/room/mypage") ? "active" : ""
                                        }`}
                                        onClick={() => go("/room/mypage")}
                                    >
                                        마이페이지
                                    </li>
                                    <li className="submenu-item" onClick={handleLogout}>
                                        로그아웃
                                    </li>
                                </>
                            ) : (
                                <li
                                    className={`submenu-item ${
                                        isExact("/auth") ? "active" : ""
                                    }`}
                                    onClick={() => go("/auth")}
                                >
                                    로그인
                                </li>
                            )}
                        </ul>
                    </li>
                </ul>
            </div>
        </aside>
    );
};

export default MainSideBar;
