import "./MainHeader.css";
import { useLocation, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";
import { useEffect, useRef, useState } from "react";

const MainHeader = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [nickname, setNickname] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        setNickname(localStorage.getItem("nickname"));
    }, []);

    // 바깥 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        setNickname(null);
        setIsOpen(false);
        navigate("/");
    };

    return (
        <div className="page">
            <header className="header sample-container">
                <div className="logo" onClick={() => navigate("/")}>
                    ONSIL
                </div>

                <div className="search-box">
                    <input placeholder="어떤 스터디를 찾고 있나요? (ex. 정보처리기사)" />
                    <button>스터디 검색</button>
                </div>

                <div className="main-actions">
                    {nickname ? (
                        <div className="profile-wrapper" ref={dropdownRef}>
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
                                        <li onClick={() => navigate("/room/mypage")}>내 프로필 보기</li>
                                        <li onClick={() => navigate("/room/mystudy")}>내 클래스룸</li>
                                        <li onClick={() => navigate("/room/create")}>스터디 만들기</li>
                                    </ul>

                                    <div className="dropdown-footer" onClick={handleLogout}>
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
