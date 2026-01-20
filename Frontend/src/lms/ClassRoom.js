import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import "./ClassRoom.css"; 

// ❌ 아직 없는 파일들은 주석 처리! (에러 방지)
// import Dashboard from "./dashboard/Dashboard";
// import Attendance from "./attendance/Attendance";
// import Assignment from "./assignment/Assignment";
import ChatModal from "./chat/ChatModal"; 

const ClassRoom = () => {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const navigate = useNavigate(); 

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard": 
        // return <Dashboard setActiveMenu={setActiveMenu} />;
        return <div className="page-placeholder">📊 대시보드 (팀원 작업중)</div>;
      
      case "attendance": 
        // return <Attendance />;
        return <div className="page-placeholder">✅ 출석 (팀원 작업중)</div>;
      
      case "assignment": 
        // return <Assignment />;
        return <div className="page-placeholder">📝 과제 (팀원 작업중)</div>;
      
      case "board": 
        return <div className="page-placeholder">📋 게시판 (팀원 작업중)</div>;
        
      default: 
        return <div className="page-placeholder">준비중입니다</div>;
    }
  };

  return (
    <div className="classroom-container">
      {/* 1. 사이드바 */}
      <aside className="sidebar">
        <div>
            <div className="sidebar-title">내 클래스룸</div>
            <nav className="sidebar-menu">
              <button className={activeMenu === 'dashboard' ? 'active' : ''} onClick={() => setActiveMenu('dashboard')}>대시보드</button>
              <button className={activeMenu === 'attendance' ? 'active' : ''} onClick={() => setActiveMenu('attendance')}>출석</button>
              <button className={activeMenu === 'assignment' ? 'active' : ''} onClick={() => setActiveMenu('assignment')}>과제</button>
              <button className={activeMenu === 'board' ? 'active' : ''} onClick={() => setActiveMenu('board')}>게시판</button>
            </nav>
        </div>
        <div className="sidebar-bottom">
            <button className="video-chat-btn" onClick={() => navigate('/meeting')}>📹 화상 채팅방 입장하기</button>
        </div>
      </aside>

      {/* 2. 메인 컨텐츠 */}
      <main className="main-content">
        <header className="content-header">
           <div style={{display:'flex', alignItems:'center'}}>
             <div className="room-badge"></div><h2>스터디룸</h2>
           </div>
           <div className="header-actions"><span>🔔</span><span>👤</span></div>
        </header>
        <div className="content-body">{renderContent()}</div>
      </main>

      {/* 3. 채팅 모달 */}
      <ChatModal />
      
    </div>
  );
};

export default ClassRoom;