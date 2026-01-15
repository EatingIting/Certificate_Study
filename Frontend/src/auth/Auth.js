import React from "react";
import "./Auth.css";

const LoginPage = () => {
    const handleLogin = (provider) => {
        console.log(`${provider} 로그인`);
        // TODO: 카카오 / 네이버 / 구글 OAuth 연동
    };

    return (
        <div className="login-container">
            <h1 className="logo">온실 <br/>(로고 사진이면 조켄네)</h1>

            <h3>목표에 집중하는 원격 스터디 그룹</h3>
            <p>시간과 장소에 구애받지 않는 학습 환경</p>

            <div className="button-group">
                <button
                    className="login-button kakao"
                    onClick={() => handleLogin("kakao")}
                >
                    <span className="icon">💬</span>
                    카카오로 시작하기
                </button>

                <button
                    className="login-button naver"
                    onClick={() => handleLogin("naver")}
                >
                    <span className="icon">N</span>
                    네이버로 시작하기
                </button>

                <button
                    className="login-button google"
                    onClick={() => handleLogin("google")}
                >
                    <span className="icon">G</span>
                    구글로 시작하기
                </button>
            </div>

            <button className="email-login">이메일로 시작하기 &gt;</button>
        </div>
    );
};

export default LoginPage;
