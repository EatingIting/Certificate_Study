import "./MainHeader.css";
import { useLocation, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";
import { useEffect, useState } from "react";

const MainHeader = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [nickname, setNickname] = useState(null);

    useEffect(() => {
        setNickname(localStorage.getItem("nickname"));
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        setNickname(null);
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
                        <>
              <span className="header-nickname">
                {nickname} 님
              </span>
                            <button className="login-btn" onClick={handleLogout}>
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <button
                            className="login-btn"
                            onClick={() => navigate("/auth")}
                        >
                            로그인
                        </button>
                    )}

                    <button
                        className="cr-btn"
                        onClick={() => navigate("/room/create")}
                    >
                        스터디 만들기
                    </button>
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
