// src/lms/LmsMain.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LmsMain.css';
import TestChatroom from '../test/TestChatroom'; 

const LmsMain = () => {
  const [activeMenu, setActiveMenu] = useState('home');
  const [userName, setUserName] = useState("홍길동");
  const navigate = useNavigate();

  // 채팅방 모달 상태
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // [NEW] 채팅방에서 알려준 '안 읽은 메시지 개수'
  const [notificationCount, setNotificationCount] = useState(0);

  // --- 기존 공지/출석/과제 로직 유지 ---
  const [notices, setNotices] = useState([
    { id: 1, text: "이번 주 스터디는 SQL 파트 집중 공략합니다." },
    { id: 2, text: "화상 회의 참여 시 마이크 상태 확인해주세요." },
    { id: 3, text: "오답노트 제출 기한: 이번 주 금요일까지" },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newNoticeText, setNewNoticeText] = useState("");
  const handleAddNotice = () => {
    if (!newNoticeText.trim()) return alert("내용을 입력해주세요!");
    setNotices([{ id: Date.now(), text: newNoticeText }, ...notices]);
    setNewNoticeText("");
    setShowModal(false);
  };
  const [isChecked, setIsChecked] = useState(false);
  const attendanceRate = isChecked ? 88 : 85; 
  const handleCheckIn = () => { if (isChecked) return; setIsChecked(true); alert("🔥 출석 완료!"); };
  const calculateDDay = (dueDate) => {
    const today = new Date(); const due = new Date(dueDate); due.setHours(23, 59, 59);
    const diff = due - today; const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: "마감됨", isExpired: true };
    if (days === 0) return { text: "D-Day", isExpired: false };
    return { text: `D-${days}`, isExpired: false };
  };
  const assignments = [
    { id: 1, title: "1주차 SQLD 기출 문제 풀이 인증", due: "2024.12.30", status: "submitted" },
    { id: 2, title: "정보처리기사 3과목 오답노트", due: "2026.01.22", status: "pending" },
    { id: 3, title: "네트워크 구조도 그리기", due: "2026.02.10", status: "pending" },
  ];

  return (
    <div className="lms-container">
      {/* 헤더 */}
      <header className="lms-header">
        <div style={{width:'120px'}}></div>
        <div className="header-logo" onClick={() => setActiveMenu('home')}>Dev<span>Study</span> LMS</div>
        <div className="header-user-info">
          <span className="user-badge">학생</span>
          <span><strong>{userName}</strong>님 환영합니다!</span>
          <div className="user-avatar-sm">👤</div>
        </div>
      </header>

      {/* 바디 */}
      <div className="lms-body">
        <nav className="lms-sidebar">
          <div className="menu-category">MY CLASS</div>
          <div className={`menu-item ${activeMenu === 'home' ? 'active' : ''}`} onClick={() => setActiveMenu('home')}>🏠 스터디 홈</div>
          <div className={`menu-item ${activeMenu === 'profile' ? 'active' : ''}`} onClick={() => setActiveMenu('profile')}>👤 프로필 관리</div>
          <div className={`menu-item ${activeMenu === 'check' ? 'active' : ''}`} onClick={() => setActiveMenu('check')}>✅ 출석 체크</div>
          <div className={`menu-item ${activeMenu === 'assignment' ? 'active' : ''}`} onClick={() => setActiveMenu('assignment')}>📑 과제 제출</div>
        </nav>

        <main className="lms-content">
          {activeMenu === 'home' && (
            <div className="fade-in">
              <div className="section-header"><h2 className="section-title">스터디 홈 🏠</h2></div>
              <div className="live-section">
                <div className="live-card">
                  <div className="live-info">
                    <div className="live-badge"><div className="red-dot"></div> LIVE ON AIR</div>
                    <h3>정보처리기사 실기 기출풀이 방</h3>
                    <p>🔥 <strong>방장(팀장)</strong>님이 화면 공유를 시작했습니다!</p>
                  </div>
                  <button className="join-btn" onClick={() => navigate('/room/1')}>📹 참여하기</button>
                </div>
              </div>
              <div className="stats-grid">
                 <div className="stat-card" onClick={() => setActiveMenu('check')}><div style={{display:'flex', alignItems:'center'}}><div className="stat-icon" style={{background:'#e8f5e9', color:'#2e7d32'}}>✅</div><div className="stat-info"><h4>출석 달성률</h4><strong>{attendanceRate}%</strong></div></div><div style={{color:'#ccc'}}>➜</div></div>
                 <div className="stat-card" onClick={() => setActiveMenu('assignment')}><div style={{display:'flex', alignItems:'center'}}><div className="stat-icon" style={{background:'#fff3e0', color:'#e67e22'}}>📑</div><div className="stat-info"><h4>과제 제출 현황</h4><strong>1/3</strong></div></div><div style={{color:'#ccc'}}>➜</div></div>
              </div>
              <div className="content-box">
                <div className="section-header"><h3 className="section-title">📢 최근 공지사항</h3><button className="add-notice-btn" onClick={() => setShowModal(true)}>+ 작성</button></div>
                <ul style={{paddingLeft:'20px', color:'#555', lineHeight:'1.8'}}>{notices.map((n) => <li key={n.id}>{n.text}</li>)}</ul>
              </div>
            </div>
          )}
          {/* ... (프로필, 출석, 과제 화면 코드는 너무 기니 생략해도 기존 코드와 동일합니다) ... */}
           {activeMenu === 'profile' && <div className="fade-in"><h2>마이 페이지</h2></div>} 
           {activeMenu === 'check' && <div className="fade-in"><h2>출석 체크</h2><button className="btn-check-in" onClick={handleCheckIn}>출석하기</button></div>} 
           {activeMenu === 'assignment' && <div className="fade-in"><h2>과제 제출</h2></div>} 
        </main>
      </div>

      {/* =======================
          플로팅 채팅 버튼 & 뱃지
         ======================= */}
      <div 
        style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999 }}
      >
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%', 
            backgroundColor: '#ffeb33', border: '1px solid #ddd',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontSize: '30px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s',
            position: 'relative' // 뱃지 위치 기준
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isChatOpen ? '❌' : '💬'}

          {/* [NEW] 알림 뱃지 (채팅방이 닫혀있고, 알림이 1개 이상일 때만 표시) */}
          {!isChatOpen && notificationCount > 0 && (
             <div className="notification-badge">
               {notificationCount > 99 ? '99+' : notificationCount}
             </div>
          )}
        </button>
      </div>

      {/* [핵심 변경] 
          모달을 없애지 않고 display: none으로 숨겨둡니다.
          그래야 닫혀있을 때도 봇이 메시지를 보내고 숫자가 올라갑니다.
      */}
      <div style={{ display: isChatOpen ? 'block' : 'none' }}>
        <TestChatroom 
            onClose={() => setIsChatOpen(false)} 
            isOpen={isChatOpen} // 열림 상태 전달
            onNotificationChange={setNotificationCount} // 알림 개수 전달 함수
        />
      </div>

      {/* 공지 모달 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>📢 새 공지사항 작성</h3>
            <input className="modal-input" value={newNoticeText} onChange={(e) => setNewNoticeText(e.target.value)} />
            <div className="modal-btn-group"><button className="modal-btn btn-cancel" onClick={() => setShowModal(false)}>취소</button><button className="modal-btn btn-save" onClick={handleAddNotice}>등록</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LmsMain;