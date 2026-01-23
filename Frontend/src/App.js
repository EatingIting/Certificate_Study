import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./auth/Auth";
import Create from "./room/roomcategorypage/Create";
import Main from "./mainpage/Main";
import MyApplications from "./room/roomcategorypage/MyApplications";
import MeetingPage from "./webrtc/MeetingPage";
import LMSMain from "./lms/LMSMain";
import LMSSubject from "./lms/LMSSubject";
import MainHeader from "./room/MainHeader";
import RoomPage from "./room/roomcategorypage/RoomPage";
import SignUp from "./auth/SignUp";
import MyPage from "./room/roomcategorypage/MyPage";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/meeting/:roomId" element={<MeetingPage />} />
                <Route path="/lms/:subjectId/*" element={<LMSSubject />}/>
                {/* 임시*/}
                <Route element={<MainHeader />}>
                    <Route path="/room" element={<RoomPage />} />
                    <Route path="/" element={<Main />} />
                    <Route path="/room/mypage" element={<MyPage />} />
                    <Route path="/room/my-applications" element={<MyApplications />} />
                    <Route path="/room/create" element={<Create />} />
                    <Route path="/room/mystudy" element={<LMSMain />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;