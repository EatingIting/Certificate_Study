import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import "./ClassRoom.css"; 
import ChatModal from "./chat/ChatModal"; 
import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import Board from "./board/Board";
import Calendar from "./calendar/Calendar";

const ClassRoom = () => {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const navigate = useNavigate(); 

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard": 
        return <Dashboard setActiveMenu={setActiveMenu} />;
      
      case "attendance": 
        return <Attendance setActiveMenu={setActiveMenu} />;
      
      case "assignment": 
        return <Assignment setActiveMenu={setActiveMenu} />;
      
      case "board":
        return <Board setActiveMenu={setActiveMenu} />;

      case "calendar":
        return <Calendar setActiveMenu={setActiveMenu} />;

      case "profile":
        return <div className="page-placeholder">👤 프로필 (준비중)</div>;

      default:
        return <div className="page-placeholder">준비중입니다</div>;
    }
  };

  return (
    <>
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
                <button className={activeMenu === 'calendar' ? 'active' : ''} onClick={() => setActiveMenu('calendar')}>일정</button>
                <button className={activeMenu === 'profile' ? 'active' : ''} onClick={() => setActiveMenu('profile')}>프로필</button>
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
      </div>

      {/* 3. 채팅 모달 - classroom-container 바깥에 위치 */}
      <ChatModal />
    </>
  );
};

export default ClassRoom;