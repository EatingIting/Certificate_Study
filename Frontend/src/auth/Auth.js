import React from "react";
import "./Auth.css";
import kakaoIcon from "./카카오.png";
import naverIcon from "./네이버.png";
import googleIcon from "./구글.png";

const LoginPage = () => {
    return (
        <div className="login-wrapper">
            <div className="login-container">
                {/* 로고 영역 */}
                <div className="logo-area">
                    {/* 나중에 이미지 로고로 교체 가능 */}
                    <h1 className="logo">온실</h1>
                </div>

                {/* 타이틀 */}
                <div className="login-title">
                    <h3>목표에 집중하는 원격 스터디 그룹</h3>
                    <p>시간과 장소에 구애받지 않는 학습 환경</p>
                </div>

                {/* 소셜 로그인 */}
                <div className="button-group">
                    <button className="social-btn kakao">
                        카카오로 시작하기
                    </button>

                    <button className="social-btn naver">
                        네이버로 시작하기
                    </button>

                    <button className="social-btn google">
                        구글로 시작하기
                    </button>
                </div>

                {/* 이메일 로그인 */}
                <button className="email-login">
                    이메일로 시작하기 →
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
