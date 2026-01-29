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
import MainHeader from "./room/MainHeader";
import RoomPage from "./room/roomcategorypage/RoomPage";
import MyPage from "./room/roomcategorypage/MyPage";

function App() {

    // 자동로그인 복원 코드
    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        const expiresAt = localStorage.getItem("expiresAt");

        // localStorage에 토큰 없으면 자동로그인 아님
        if (!token) return;

        // 만료 체크 (30일 지났으면 삭제)
        if (expiresAt && Date.now() > Number(expiresAt)) {
            localStorage.clear();
            return;
        }

        // localStorage → sessionStorage 복원
        sessionStorage.setItem("accessToken", token);
        sessionStorage.setItem("userId", localStorage.getItem("userId"));
        sessionStorage.setItem("nickname", localStorage.getItem("nickname"));

        console.log("자동 로그인 복원 완료");
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* 로그인/회원가입 */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup" element={<SignUp />} />

                {/* OAuth 결과 처리 */}
                <Route path="/oauth-success" element={<OAuthSuccess />} />
                <Route path="/oauth-fail" element={<OAuthFail />} />

                {/* OAuth 콜백 */}
                <Route path="/login/*" element={<OAuthCallbackRedirect />} />

                {/* 화상회의 */}
                <Route path="/meeting/:roomId" element={<MeetingPage />} />

                {/* LMS */}
                <Route path="/lms/:subjectId/*" element={<LMSSubject />} />

                {/* 메인 공통 헤더 */}
                <Route element={<MainHeader />}>
                    <Route path="/" element={<Main />} />
                    <Route path="/room" element={<RoomPage />} />
                    <Route path="/room/mypage" element={<MyPage />} />
                    <Route
                        path="/room/my-applications"
                        element={<MyApplications />}
                    />
                    <Route path="/room/create" element={<Create />} />
                    <Route path="/room/mystudy" element={<LMSMain />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
