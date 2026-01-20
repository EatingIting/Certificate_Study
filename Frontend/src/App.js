import { BrowserRouter, Routes, Route } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import MyPage from "./roomcategorypage/MyPage";
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
                <Route path="/mypage" element={<MyPage />} />
            </Routes>
        </BrowserRouter>
    );
>>>>>>> aa1e911279d165ffb46e0db49eb1995b878a3cd6
}

export default App;