import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";

function Dashboard({ setActiveMenu }) {
    let navigate = useNavigate();
    let params = useParams();

    // ✅ 라우트 파라미터 이름이 프로젝트마다 달라질 수 있어서 안전하게 처리
    let subjectId =
        params.roomId ||
        params.subjectId ||
        params.id ||
        window.location.pathname.split("/")[2]; // /lms/1/dashboard -> "1"

    let go = (menu) => {
        if (typeof setActiveMenu === "function") {
            setActiveMenu(menu);
        }
        navigate(`/lms/${subjectId}/${menu}`);
    };

    // ✅ 일정 더미 (많아져도 레이아웃 안 깨지게: 카드 내부만 스크롤)
    let upcomingSchedules = [
        { date: "01.20", title: "정보처리기사 접수 시작", dday: "D-1" },
        { date: "01.22", title: "서류 준비", dday: "D-3" },
        { date: "02.02", title: "SQLD 시험", dday: "D-14" },
        { date: "02.10", title: "면접 준비", dday: "D-22" },
        { date: "02.15", title: "프로젝트 발표", dday: "D-27" },
        { date: "02.18", title: "서류 제출 마감", dday: "D-30" },

        // 예시: "스터디 회의" 같은 건 일반 일정으로 내려가야 함
        { date: "02.25", title: "스터디 회의", dday: "D-37" },

        // 예시: 회차형 스터디 일정
        { date: "01.21", title: "스터디 1회차", dday: "D-2" },
        { date: "01.28", title: "스터디 2회차", dday: "D-9" },
        { date: "02.04", title: "스터디 3회차", dday: "D-16" },
    ];

    // ✅ 스터디 일정 = "스터디 n회차" 만 위로
    let isStudyRound = (title) => /^스터디\s*\d+\s*회차/.test(title);

    let studySchedules = upcomingSchedules.filter((it) => isStudyRound(it.title));
    let normalSchedules = upcomingSchedules.filter((it) => !isStudyRound(it.title));

    return (
        <div className="dashboard-container">
            <div className="dashboard-grid">
                {/* 1) 시험 카드 (이동 버튼 없음) */}
                <div className="card study-card-back dashStudy">
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

                {/* 2) 출석 카드 (제목 옆 버튼으로만 이동) */}
                <div className="card attendance-card dashAttendance">
                    <div className="card-header line">
                        <span className="card-title">출석 현황</span>

                        <button
                            type="button"
                            className="card-linkBtn"
                            onClick={() => go("attendance")}
                        >
                            출석으로 이동 →
                        </button>
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
                        <button type="button" className="more-btn" onClick={() => go("attendance")}>
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

                {/* 3) 게시판 카드 (제목 옆 버튼으로만 이동) */}
                <div className="card dashBoard">
                    <div className="card-header line">
                        <span className="card-title">게시판</span>

                        <button
                            type="button"
                            className="card-linkBtn"
                            onClick={() => go("board")}
                        >
                            게시판으로 이동 →
                        </button>
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
                        <button type="button" className="more-btn" onClick={() => go("board")}>
                            더보기 &gt;
                        </button>
                    </div>
                </div>

                {/* 4) 과제 카드 (제목 옆 버튼으로만 이동) */}
                <div className="card dashAssignment">
                    <div className="card-header line">
                        <span className="card-title">과제</span>

                        <button
                            type="button"
                            className="card-linkBtn"
                            onClick={() => go("assignment")}
                        >
                            과제로 이동 →
                        </button>
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
                        <button type="button" className="more-btn" onClick={() => go("assignment")}>
                            더보기 &gt;
                        </button>
                    </div>
                </div>

                {/* 5) 일정 카드 (오른쪽 2칸 세로 span / 제목 옆 버튼으로만 이동) */}
                <div className="card dashCalendar">
                    <div className="card-header line">
                        <span className="card-title">일정</span>

                        <button
                            type="button"
                            className="card-linkBtn"
                            onClick={() => go("calendar")}
                        >
                            일정으로 이동 →
                        </button>
                    </div>

                    {/* ✅ 여기만 세로 2칸 */}
                    <div className="dashCalBody dashCalSplit">
                        {/* 위: 스터디 일정 */}
                        <div className="dashCalSection">
                            <div className="dashCalSectionTitle">스터디 일정</div>

                            <div className="dashCalSectionList">
                                <ul className="table-list dashCalListTight">
                                    {studySchedules.map((it, idx) => {
                                        return (
                                            <li key={`study-${idx}`} className="trow tinted">
                                                <span className="tleft">
                                                    <span className="round">[{it.date}]</span>
                                                    <span className="row-text">{it.title}</span>
                                                </span>
                                                <span className="tright">
                                                    <span className="status ok">{it.dday}</span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>

                        {/* 아래: 일반 일정 */}
                        <div className="dashCalSection">
                            <div className="dashCalSectionTitle">일정</div>

                            <div className="dashCalSectionList">
                                <ul className="table-list dashCalListTight">
                                    {normalSchedules.map((it, idx) => {
                                        return (
                                            <li key={`normal-${idx}`} className="trow tinted">
                                                <span className="tleft">
                                                    <span className="round">[{it.date}]</span>
                                                    <span className="row-text">{it.title}</span>
                                                </span>
                                                <span className="tright">
                                                    <span className="status ok">{it.dday}</span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="card-footer">
                        <button type="button" className="more-btn" onClick={() => go("calendar")}>
                            더보기 &gt;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
