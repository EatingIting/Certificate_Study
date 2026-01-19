// src/lms/ClassRoom.js
import React, { useState } from "react";
import "./ClassRoom.css"; // 아래에서 만들 CSS

// 하위 페이지들
import Dashboard from "./dashboard/Dashboard";
// import Board from "./board/Board";      // (나중에 만드실 것)
// import Attendance from "./attendance/Attendance"; 
// import Assignment from "./assignment/Assignment";

// 채팅방 (여기서 불러옵니다!)
import ChatModal from "./chat/ChatModal"; 

const ClassRoom = () => {
  // 1. 현재 선택된 메뉴 (기본값: 대시보드)
  const [activeMenu, setActiveMenu] = useState("dashboard");
  
  // 2. 채팅방 상태 (부모가 관리하므로 탭이 바뀌어도 유지됨!)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  // 메뉴에 따라 본문 내용을 결정하는 함수
  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard setActiveMenu={setActiveMenu} />;
      case "attendance":
        return <div className="page-placeholder">출석 페이지 (준비중)</div>;
      case "assignment":
        return <div className="page-placeholder">과제 페이지 (준비중)</div>;
      case "board":
        return <div className="page-placeholder">게시판 페이지 (준비중)</div>;
      default:
        return <Dashboard setActiveMenu={setActiveMenu} />;
    }
  };

  return (
    <div className="classroom-container">
      {/* --- 1. 사이드바 (왼쪽) --- */}
      <aside className="sidebar">
        <div className="sidebar-title">내 클래스룸</div>
        <nav className="sidebar-menu">
          <button 
            className={activeMenu === 'dashboard' ? 'active' : ''} 
            onClick={() => setActiveMenu('dashboard')}
          >
            대시보드
          </button>
          <button 
            className={activeMenu === 'attendance' ? 'active' : ''} 
            onClick={() => setActiveMenu('attendance')}
          >
            출석
          </button>
          <button 
            className={activeMenu === 'assignment' ? 'active' : ''} 
            onClick={() => setActiveMenu('assignment')}
          >
            과제
          </button>
          <button 
            className={activeMenu === 'board' ? 'active' : ''} 
            onClick={() => setActiveMenu('board')}
          >
            게시판
          </button>
        </nav>
      </aside>

      {/* --- 2. 메인 컨텐츠 (오른쪽) --- */}
      <main className="main-content">
        {/* 상단 헤더 (제목 등) */}
        <header className="content-header">
           <div className="room-badge"></div> 
           <h2>스터디룸</h2>
           {/* 우측 상단 아이콘들 (알림, 프로필 등) */}
           <div className="header-actions">
              <span>💬</span><span>🔔</span><span>👤</span>
           </div>
        </header>

        {/* 실제 페이지 내용 (Dashboard 등이 여기에 뜸) */}
        <div className="content-body">
            {renderContent()}
        </div>
      </main>


      {/* --- 3. 채팅방 (화면 전체에 고정됨) --- */}
      {/* 여기에 두면 탭이 바뀌어도 절대 사라지지 않음! */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999 }}>
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%', 
            backgroundColor: '#97c793', border: 'none',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', color: 'white', position: 'relative'
          }}
        >
          {isChatOpen ? '✕' : '💬'}
          {!isChatOpen && badgeCount > 0 && (
             <div style={{
               position: 'absolute', top: '-2px', right: '-2px',
               backgroundColor: '#ff3b30', color: 'white', fontSize: '12px', fontWeight: 'bold',
               minWidth: '20px', height: '20px', borderRadius: '10px',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               border: '2px solid white'
             }}>
               {badgeCount}
             </div>
          )}
        </button>
      </div>

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

export default ClassRoom;