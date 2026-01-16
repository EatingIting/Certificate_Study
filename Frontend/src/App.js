import React from "react";
import MeetingPage from "./webrtc/MeetingPage";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/room/test" replace />} />
        <Route path="/room/:roomId" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;