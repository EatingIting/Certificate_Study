import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import api from "../api/api";
import "./MyApplications.css";
import onsil from "./온실.png";

const MyApplications = () => {
    const navigate = useNavigate();
    const nickname = localStorage.getItem("nickname");

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [tab, setTab] = useState("sent");
    const [list, setList] = useState([]);

    useEffect(() => {
        const closeMenu = () => setIsUserMenuOpen(false);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    useEffect(() => {
        if (tab === "sent") {
            setList([
                {
                    applicationId: 1,
                    studyTitle: "정보처리기사 스터디",
                    owner: "스터디장1",
                    status: "신청중",
                },
                {
                    applicationId: 2,
                    studyTitle: "공무원 스터디",
                    owner: "스터디장2",
                    status: "승인",
                },
                {
                    applicationId: 3,
                    studyTitle: "토익 스터디",
                    owner: "스터디장3",
                    status: "거절",
                }
            ]);
        } else {
            setList([
                {
                    applicationId: 2,
                    studyTitle: "토익 스터디",
                    applicant: "user23",
                    status: "신청중",
                },
            ]);
        }
    }, [tab]);

    return (
        <>
            {/* ===== 헤더 (RoomPage 동일) ===== */}
            <header className="top-header">
                <div className="page-container header-inner">
                    <div className="header-logo">
                        <img
                            src={onsil}
                            alt="온실"
                            onClick={() => navigate("/")}
                            style={{ cursor: "pointer" }}
                        />
                    </div>

                    {nickname ? (
                        <div className="user-menu-wrapper">
                            <button
                                className="auth-btns"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsUserMenuOpen(prev => !prev);
                                }}
                            >
                                {nickname} 님 ▾
                            </button>

                            {isUserMenuOpen && (
                                <div
                                    className="user-dropdown"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ul>
                                        <li onClick={() => navigate("/mypage")}>마이페이지</li>
                                        <li onClick={() => navigate("/lmsMain")}>내 클래스</li>
                                        <li onClick={() => navigate("/my-applications")}>
                                            스터디 신청 현황
                                        </li>
                                        <li
                                            className="logout"
                                            onClick={() => {
                                                localStorage.clear();
                                                window.location.reload();
                                            }}
                                        >
                                            로그아웃
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className="auth-btns" onClick={() => navigate("/auth")}>
                            로그인 / 회원가입
                        </button>
                    )}
                </div>
            </header>

            {/* ===== 본문 ===== */}
            <div className="page-container my-applications">
                <div className="application-header">
                    <h2>스터디 신청 현황</h2>

                    <div className="tabs">
                        <button
                            className={tab === "sent" ? "active" : ""}
                            onClick={() => setTab("sent")}
                        >
                            내가 신청한 스터디
                        </button>
                        <button
                            className={tab === "received" ? "active" : ""}
                            onClick={() => setTab("received")}
                        >
                            신청 받은 스터디
                        </button>
                    </div>
                </div>

                <table className="application-table">
                    <thead>
                    <tr>
                        <th>스터디명</th>
                        <th>{tab === "sent" ? "스터디장" : "신청자"}</th>
                        <th>상태</th>
                        {tab === "received" && <th>관리</th>}
                    </tr>
                    </thead>
                    <tbody>
                    {list.length === 0 ? (
                        <tr>
                            <td colSpan={tab === "received" ? 4 : 3} className="empty">
                                신청 내역이 없습니다.
                            </td>
                        </tr>
                    ) : (
                        list.map(item => (
                            <tr key={item.applicationId}>
                                <td>{item.studyTitle}</td>
                                <td>{tab === "sent" ? item.owner : item.applicant}</td>
                                <td className={`status ${item.status?.toLowerCase()}`}>
                                    {item.status}
                                </td>
                                {tab === "received" && (
                                    <td className="actions">
                                        <button className="approve">승인</button>
                                        <button className="reject">거절</button>
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default MyApplications;
