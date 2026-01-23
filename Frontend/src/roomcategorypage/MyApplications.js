import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import api from "../api/api";
import "./MyApplications.css";
import onsil from "./온실.png";

const MyApplications = () => {
    const navigate = useNavigate();
    const nickname = localStorage.getItem("nickname");

    useEffect(() => {
        const token = localStorage.getItem("accessToken"); // 또는 nickname

        if (!token) {
            alert("로그인이 필요한 페이지입니다.");
            navigate("/auth");
        }
    }, [navigate]);

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [tab, setTab] = useState("sent");
    const [list, setList] = useState([]);

    const [openApplicationId, setOpenApplicationId] = useState(null);

    useEffect(() => {
        const closeMenu = () => setIsUserMenuOpen(false);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    useEffect(() => {
        const fetchApplications = async () => {
            try {
                if (tab === "sent") {
                    const res = await api.get("/applications/sent");
                    setList(res.data);
                } else {
                    const res = await api.get("/applications/received");
                    setList(res.data);
                }
                setOpenApplicationId(null);
            } catch (e) {
                console.error("신청 목록 조회 실패", e);
            }
        };

        fetchApplications();
    }, [tab]);

    const toggleDetail = (joinId) => {
        setOpenApplicationId((prev) => (prev === joinId ? null : joinId));
    };

    const handleApprove = async (joinId) => {
        try {
            await api.post(`/applications/${joinId}/approve`);
            setList((prev) => prev.filter((item) => item.joinId !== joinId));
            setOpenApplicationId(null);
        } catch (e) {
            console.error("승인 실패", e);
        }
    };

    const handleReject = async (joinId) => {
        try {
            await api.post(`/applications/${joinId}/reject`);
            setList((prev) => prev.filter((item) => item.joinId !== joinId));
            setOpenApplicationId(null);
        } catch (e) {
            console.error("거절 실패", e);
        }
    };

    return (
        <>
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
                        {tab === "sent" && <th>상태</th>}
                        {tab === "received" && <th>관리</th>}
                    </tr>
                    </thead>

                    <tbody>
                    {list.length === 0 ? (
                        <tr>
                            <td colSpan={3} className="empty">
                                신청 내역이 없습니다.
                            </td>
                        </tr>
                    ) : (
                        list.map((item) => (
                            <React.Fragment key={item.joinId}>
                                <tr
                                    className={
                                        tab === "received"
                                            ? "clickable-row"
                                            : ""
                                    }
                                    onClick={() =>
                                        tab === "received" &&
                                        toggleDetail(item.joinId)
                                    }
                                >
                                    <td>{item.studyTitle}</td>
                                    <td>
                                        {tab === "sent"
                                            ? item.ownerNickname
                                            : item.applicantNickname}
                                    </td>

                                    {tab === "sent" && (
                                        <td
                                            className={`status ${item.status}`}
                                        >
                                            {item.status}
                                        </td>
                                    )}

                                    {tab === "received" && (
                                        <td className="actions">
                                            <button
                                                className="approve"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleApprove(item.joinId);
                                                }}
                                            >
                                                승인
                                            </button>
                                            <button
                                                className="reject"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReject(item.joinId);
                                                }}
                                            >
                                                거절
                                            </button>
                                        </td>
                                    )}
                                </tr>

                                {tab === "received" &&
                                    openApplicationId === item.joinId && (
                                        <tr className="application-detail">
                                            <td colSpan={3}>
                                                <div className="detail-box">
                                                    <p>
                                                        <strong>닉네임:</strong>{" "}
                                                        {item.applicantNickname}
                                                    </p>
                                                    <p>
                                                        <strong>성별:</strong>{" "}
                                                        {item.gender === "FEMALE"
                                                            ? "여성"
                                                            : "남성"}
                                                    </p>
                                                    <p>
                                                        <strong>나이:</strong>{" "}
                                                        {item.age}세
                                                    </p>

                                                    <div className="message-box">
                                                        <strong>
                                                            신청 메시지
                                                        </strong>
                                                        <textarea
                                                            readOnly
                                                            value={item.applyMessage}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                            </React.Fragment>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default MyApplications;