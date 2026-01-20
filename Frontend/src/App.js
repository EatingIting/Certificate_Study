import { BrowserRouter, Routes, Route } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import Auth from "./auth/Auth";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
<<<<<<< HEAD
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/room/test" replace />} />
        <Route path="/room/:roomId" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
=======
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/roompage" element={<RoomPage />} />
            </Routes>
        </BrowserRouter>
    );
>>>>>>> 2b74310 (스터디 모집방, 로그인 UI 수정중)
}

export default App;