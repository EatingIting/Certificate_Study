import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import MyPage from "./roomcategorypage/MyPage";
import Auth from "./auth/Auth";
import Create from "./roomcreate/Create";
import Main from "./mainpage/Main";
import MyApplications from "./roomcategorypage/MyApplications";
import MeetingPage from "./webrtc/MeetingPage";
import LMSMain from "./lms/LMSMain";
import LMSSubject from "./lms/LMSSubject";

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
                <Route path="/lmsMain" element={<LMSMain />} />
                <Route path="/lms/:subjectId/*" element={<LMSSubject />}/>
            </Routes>
        </BrowserRouter>
    );
}
export default App;