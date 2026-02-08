import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import Auth from "./auth/Auth";
import SignUp from "./auth/SignUp";

import OAuthSuccess from "./auth/OAuthSuccess";
import OAuthFail from "./auth/OAuthFail";
import OAuthCallbackRedirect from "./auth/OAuthCallbackRedirect";

import Create from "./room/roomcategorypage/Create";
import Main from "./mainpage/Main";
import MyApplications from "./room/roomcategorypage/MyApplications";
import MeetingPage from "./webrtc/MeetingPage";
import LMSMain from "./lms/LMSMain";
import LMSSubject from "./lms/LMSSubject";
import { LMSProvider } from "./lms/LMSContext";
import ProtectedRoute from "./lms/ProtectedRoute";
import MainHeader from "./room/MainHeader";
import RoomPage from "./room/roomcategorypage/RoomPage";
import MyPage from "./room/roomcategorypage/MyPage";
import { restoreAuthSession } from "./api/api";

function App() {
    useEffect(() => {
        restoreAuthSession();
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup" element={<SignUp />} />

                <Route path="/oauth-success" element={<OAuthSuccess />} />
                <Route path="/oauth-fail" element={<OAuthFail />} />

                <Route path="/login/*" element={<OAuthCallbackRedirect />} />

                <Route path="/meeting/:roomId" element={<MeetingPage />} />

                <Route path="/lms/:subjectId/*" element={<LMSSubject />} />

                <Route element={<MainHeader />}>
                    <Route path="/" element={<Main />} />
                    <Route path="/room" element={<RoomPage />} />
                    <Route path="/room/mypage" element={<MyPage />} />
                    <Route
                        path="/room/my-applications"
                        element={<MyApplications />}
                    />
                    <Route path="/room/create" element={<Create />} />
                    <Route
                        path="/room/mystudy"
                        element={
                            <LMSProvider>
                                <ProtectedRoute>
                                    <LMSMain />
                                </ProtectedRoute>
                            </LMSProvider>
                        }
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
