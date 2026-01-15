import React from "react";
import "./Auth.css";
import kakaoIcon from "./카카오.png";
import naverIcon from "./네이버.png";
import googleIcon from "./구글.png";

const LoginPage = () => {
    const handleLogin = (provider) => {
        console.log(`${provider} 로그인`);
        // TODO: 카카오 / 네이버 / 구글 OAuth 연동
    };

    return (
        <div className="login-container">
            <h1 className="logo">온실 <br/>(로고 사진이면 조켄네)</h1>

            <div className="login-title">
                <h3>목표에 집중하는 원격 스터디 그룹</h3>
                <p>시간과 장소에 구애받지 않는 학습 환경</p>
            </div>


            <div className="button-group">
                <a href="#">
                    <img src={kakaoIcon} className="kakao" alt="카카오 로그인" />
                </a>

                <a href="##">
                    <img src={naverIcon} className="naver" alt="네이버 로그인" />
                </a>
                <a href="###">
                    <img src={googleIcon} className="google" alt="구글 로그인" />
                </a>


            </div>

            <button className="email-login">이메일로 시작하기 &gt;</button>
        </div>
    );
};

export default LoginPage;
