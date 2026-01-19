import "./Dashboard.css";

const Dashboard = ({ setActiveMenu }) => {
    return (
        <div className="dashboard-container">
            {/* 상단 카드 */}
            <div className="dashboard-top">
                <div className="card study-card">
                    <div className="study-info">
                        <h3>정보처리기사</h3>
                        <p>2026.04.27 D-23</p>
                        <div className="progress-bar">
                            <div className="progress" />
                        </div>
                    </div>
                    <div className="study-icon">🔥</div>
                </div>
            </div>

            {/* 하단 카드들 */}
            <div className="dashboard-grid">
                {/* 게시판 */}
                <div className="card">
                    <div className="card-header">
                        <span>게시판</span>
                        <span className="more" onClick={() => setActiveMenu("board")}>
                            더보기 &gt;
                        </span>
                    </div>
                    <ul className="list">
                        <li>[자료] 2024 기출 자료 공유합니다!</li>
                        <li>[자료] 필기 요약본입니다</li>
                        <li>[공지] 오늘 저녁 스터디 예정입니다</li>
                    </ul>
                </div>

                {/* 출석 */}
                <div className="card grid-attendance">
                    <div className="card-header">
                        <span>출석 현황</span>
                        <span className="more" onClick={() => setActiveMenu("attendance")}>
                            더보기 &gt;
                        </span>
                    </div>

                    <ul className="attendance-list">
                        <li><span>[1회차] 2026.01.01 (월)</span><span className="ok">출석</span></li>
                        <li><span>[2회차] 2026.01.03 (수)</span><span className="ok">출석</span></li>
                        <li><span>[3회차] 2026.01.05 (금)</span><span className="ok">출석</span></li>
                        <li><span>[4회차] 2026.01.08 (일)</span><span className="fail">결석</span></li>
                        <li><span>[5회차] 2026.01.10 (수)</span><span className="ok">출석</span></li>
                    </ul>

                    {/* ✅ 초록색 출석률 박스 */}
                    <div className="attendance-rate-box">
                        <div className="rate-top">
                            <span className="rate-label">출석률</span>
                            <span className="rate-value">83.3%</span>
                        </div>
                        <div className="rate-bar">
                            <div className="rate-progress" />
                        </div>
                    </div>
                </div>


                {/* 과제 */}
                <div className="card">
                    <div className="card-header">
                        <span>과제</span>
                        <span className="more" onClick={() => setActiveMenu("assignment")}>
                            더보기 &gt;
                        </span>
                    </div>
                    <ul className="task-list">
                        <li>
                            [1회차] 2024 기출 풀기
                            <span className="badge done">제출</span>
                        </li>
                        <li>
                            [2회차] 2023 기출 풀기
                            <span className="badge done">제출</span>
                        </li>
                        <li>
                            [3회차] 2022 기출 풀기
                            <span className="badge done">제출</span>
                        </li>
                        <li>
                            [4회차] 2021 기출 풀기
                            <span className="badge pending">제출하기</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
