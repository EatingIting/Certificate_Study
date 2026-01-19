// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 페이지 컴포넌트 불러오기
import LmsMain from './lms/LmsMain';       // LMS 메인 (여기에 채팅 버튼/모달 포함됨)
import MeetingPage from "./webrtc/MeetingPage"; // 화상회의 화면

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. LMS 메인 화면 (기본 경로) */}
        <Route path="/" element={<LmsMain />} />

        {/* 2. 화상 회의 화면 (방 번호에 따라 입장) */}
        <Route path="/room/:roomId" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;