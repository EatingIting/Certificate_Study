import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";

function Dashboard({ setActiveMenu }) {
    let navigate = useNavigate();
    let params = useParams();

    // ✅ 라우트 파라미터 이름이 프로젝트마다 달라질 수 있어서 안전하게 처리
    // 예: /lms/:roomId/dashboard  또는 /lms/:subjectId/dashboard  또는 /lms/:id/dashboard
    let subjectId =
        params.roomId ||
        params.subjectId ||
        params.id ||
        window.location.pathname.split("/")[2]; // /lms/1/dashboard -> "1"

    let go = (menu) => {
        // setActiveMenu는 있을 수도/없을 수도 있으니 안전하게
        if (typeof setActiveMenu === "function") {
            setActiveMenu(menu);
        }

        // ✅ 라우트 기반 이동
        // menu 예: "board", "attendance", "assignment"
        navigate(`/lms/${subjectId}/${menu}`);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-layout">
                {/* LEFT COLUMN */}
                <div className="col left-col">
                    {/* 자격증 카드 */}
                    <div className="card study-card-back">
                        <div className="card study-card">
                            <div className="study-info">
                                <h3>정보처리기사</h3>
                                <hr />
                                <p>
                                    2026.04.27 <br />
                                    D-23
                                </p>

                                <div className="progress-bar">
                                    <div className="progress" />
                                </div>
                            </div>

                            <div className="study-icon">🔥</div>
                        </div>
                    </div>

                    {/* 게시판 카드 */}
                    <div
                        className="card clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => go("board")}
                        onKeyDown={(e) => e.key === "Enter" && go("board")}
                    >
                        <div className="card-header line">
                            <span className="card-title">게시판</span>
                        </div>

                        <ul className="table-list">
                            <li className="trow plain">
                                <span className="row-text">[자료] 2024 기출 자료 공유합니다!</span>
                            </li>
                            <li className="trow plain">
                                <span className="row-text">[자료] 필기 요약본입니다</span>
                            </li>
                            <li className="trow plain">
                                <span className="row-text">[공지] 오늘 저녁 스터디 예정입니다</span>
                            </li>
                        </ul>

                        <div className="card-footer">
                            <button
                                className="more-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    go("board");
                                }}
                            >
                                더보기 &gt;
                            </button>
                        </div>
                    </div>
                </div>

                {/* MIDDLE COLUMN : 출석 */}
                <div className="col">
                    <div
                        className="card attendance-card clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => go("attendance")}
                        onKeyDown={(e) => e.key === "Enter" && go("attendance")}
                    >
                        <div className="card-header line">
                            <span className="card-title">출석 현황</span>
                        </div>

                        <ul className="table-list">
                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[1회차]</span>
                  <span className="row-text">2026.01.01 (월)</span>
                </span>
                                <span className="tright">
                  <span className="status ok">출석</span>
                </span>
                            </li>

                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[2회차]</span>
                  <span className="row-text">2026.01.03 (수)</span>
                </span>
                                <span className="tright">
                  <span className="status ok">출석</span>
                </span>
                            </li>

                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[3회차]</span>
                  <span className="row-text">2026.01.05 (금)</span>
                </span>
                                <span className="tright">
                  <span className="status ok">출석</span>
                </span>
                            </li>
                        </ul>

                        <div className="card-footer">
                            <button
                                className="more-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    go("attendance");
                                }}
                            >
                                더보기 &gt;
                            </button>
                        </div>

                        <div className="attendance-rate-box">
                            <div className="rate-top">
                                <div className="rate-left">
                                    <img src="/calendar.png" alt="출석률" className="rate-badge" />
                                    <span className="rate-label">출석률</span>
                                </div>
                                <span className="rate-value">83.3%</span>
                            </div>

                            <div className="rate-bar">
                                <div className="rate-progress" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN : 과제 */}
                <div className="col">
                    <div
                        className="card clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => go("assignment")}
                        onKeyDown={(e) => e.key === "Enter" && go("assignment")}
                    >
                        <div className="card-header line">
                            <span className="card-title">과제</span>
                        </div>

                        <ul className="table-list">
                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[1회차]</span>
                  <span className="row-text">2024 기출 풀기</span>
                </span>
                                <span className="tright">
                  <span className="pill done">제출</span>
                </span>
                            </li>

                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[2회차]</span>
                  <span className="row-text">2023 기출 풀기</span>
                </span>
                                <span className="tright">
                  <span className="pill done">제출</span>
                </span>
                            </li>

                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[3회차]</span>
                  <span className="row-text">2022 기출 풀기</span>
                </span>
                                <span className="tright">
                  <span className="pill done">제출</span>
                </span>
                            </li>

                            <li className="trow tinted">
                <span className="tleft">
                  <span className="round">[4회차]</span>
                  <span className="row-text">2021 기출 풀기</span>
                </span>
                                <span className="tright">
                  <span className="pill pending">제출하기</span>
                </span>
                            </li>
                        </ul>

                        <div className="card-footer">
                            <button
                                className="more-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    go("assignment");
                                }}
                            >
                                더보기 &gt;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;