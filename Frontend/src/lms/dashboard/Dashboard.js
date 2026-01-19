import "./Dashboard.css";
import "../chat/ChatModal"; // 채팅방 모달 추가
import { useState } from "react";
import ChatModal from "../chat/ChatModal";

const Dashboard = ({ setActiveMenu }) => {

    // 채팅방 상태 관리
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [badgeCount, setBadgeCount] = useState(0);

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

            {/* 채팅방 플로팅버튼 모달 */}

            {/* 우측 하단 플로팅 버튼 */}
            <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999 }}>
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  style={{
                    width: '60px', height: '60px', borderRadius: '50%', 
                    backgroundColor: '#97c793', /* 초록 테마 */
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '30px', color: 'white', position: 'relative',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isChatOpen ? '✕' : '💬'}

                  {/* 빨간색 알림 뱃지 */}
                  {!isChatOpen && badgeCount > 0 && (
                     <div style={{
                       position: 'absolute', top: '-5px', right: '-5px',
                       backgroundColor: '#ff3b30', color: 'white',
                       fontSize: '12px', fontWeight: 'bold',
                       minWidth: '20px', height: '20px', borderRadius: '10px',
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       padding: '0 4px', border: '2px solid white',
                       animation: 'popIn 0.3s'
                     }}>
                       {badgeCount > 99 ? '99+' : badgeCount}
                     </div>
                  )}
                </button>
            </div>

            {/* 채팅 모달 (숨김 처리로 백그라운드 유지) */}
            <div style={{ display: isChatOpen ? 'block' : 'none' }}>
                <ChatModal 
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    onNotificationChange={setBadgeCount}
                />
            </div>

        </div>
    );
};

export default Dashboard;
