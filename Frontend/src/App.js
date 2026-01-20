import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import MyPage from "./roomcategorypage/MyPage";
import Auth from "./auth/Auth";
import Create from "./roomcreate/Create";
import Main from "./mainpage/Main";
import MyApplications from "./roomcategorypage/MyApplications";
import MeetingPage from "./webrtc/MeetingPage";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Main />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/roompage" element={<RoomPage />} />
                <Route path="/mypage" element={<MyPage />} />
                <Route path="/create" element={<Create />} />
                <Route path="/my-applications" element={<MyApplications />} />
                <Route path="/meeting/:roomId" element={<MeetingPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;