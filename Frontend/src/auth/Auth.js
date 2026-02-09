import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import { login } from "../api/api";
import { getBackendOrigin } from "../utils/backendUrl";

<<<<<<< HEAD
import logo from "./main-logo.png";
import kakaoIcon from "./kakao-icon.png";
import naverIcon from "./naver-icon.png";
import googleIcon from "./google-icon.png";

const Auth = () => {
    const navigate = useNavigate();
=======
const logo = require("./메인로고 2.png");

const Auth = () => {
    const navigate = useNavigate();
    const kakaoIcon = require("./카카오 2.png");
    const naverIcon = require("./네이버 2.png");
    const googleIcon = require("./구글 2.png");
>>>>>>> 8d18f89cb1a03d77d42ece5129a9bbe1f3ada719

    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [autoLogin, setAutoLogin] = useState(false);
    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async () => {
        try {
            const res = await login(form.email, form.password, autoLogin);

            let token = res.data.accessToken || res.data.token;
            if (token?.startsWith("Bearer ")) {
                token = token.replace("Bearer ", "");
            }

            sessionStorage.setItem("userId", res.data.userId);
            sessionStorage.setItem("nickname", res.data.nickname);
            sessionStorage.setItem("accessToken", token);
            sessionStorage.setItem("userEmail", form.email);

            localStorage.setItem("userId", res.data.userId);
            localStorage.setItem("userName", res.data.nickname || res.data.name || "");

            if (autoLogin) {
                localStorage.setItem("rememberMe", "true");
                localStorage.setItem("userId", res.data.userId);
                localStorage.setItem("nickname", res.data.nickname);
                localStorage.setItem("accessToken", token);
            } else {
                localStorage.setItem("rememberMe", "false");
                localStorage.removeItem("accessToken");
            }

            navigate("/");
        } catch {
            alert("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
    };

    const handleOAuthLogin = (provider) => {
        const backendOrigin = getBackendOrigin();
        const frontendOrigin = window.location.origin;
        window.location.href = `${backendOrigin}/oauth2/authorization/${provider}?redirect_origin=${encodeURIComponent(
            frontendOrigin
        )}`;
    };

    return (
        <div className="login-wrapper">
            <div className="login-container">
                {!showEmailLogin ? (
                    <>
                        <div className="logo-area">
                            <img
                                src={logo}
                                alt="온실 로고"
                                onClick={() => navigate("/")}
                                className="onsil-logo"
                            />
                        </div>

                        <div className="button-group">
                            <button
                                className="social-btn kakao"
                                onClick={() => handleOAuthLogin("kakao")}
                            >
                                <img src={kakaoIcon} alt="카카오" className="social-icon" />
                                카카오로 시작하기
                            </button>

                            <button
                                className="social-btn naver"
                                onClick={() => handleOAuthLogin("naver")}
                            >
                                <img src={naverIcon} alt="네이버" className="social-icon" />
                                네이버로 시작하기
                            </button>

                            <button
                                className="social-btn google"
                                onClick={() => handleOAuthLogin("google")}
                            >
                                <img src={googleIcon} alt="구글" className="social-icon" />
                                구글로 시작하기
                            </button>
                        </div>

                        <button
                            className="email-login"
                            onClick={() => setShowEmailLogin(true)}
                        >
                            이메일로 시작하기
                        </button>
                    </>
                ) : (
                    <>
                        <h3 className="modal-title">이메일 로그인</h3>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleLogin();
                            }}
                        >
                            <input
                                type="email"
                                name="email"
                                placeholder="이메일"
                                value={form.email}
                                onChange={handleChange}
                                className="modal-input"
                            />

                            <input
                                type="password"
                                name="password"
                                placeholder="비밀번호"
                                value={form.password}
                                onChange={handleChange}
                                className="modal-input"
                            />

                            <label className="auto-login">
                                <input
                                    type="checkbox"
                                    checked={autoLogin}
                                    onChange={(e) => setAutoLogin(e.target.checked)}
                                />
                                자동 로그인
                            </label>

                            <button type="submit" className="modal-login-btn">
                                로그인
                            </button>
                        </form>

                        <p className="modal-switch">
                            아직 회원이 아니신가요?
                            <span onClick={() => navigate("/signup")}>
                                회원가입
                            </span>
                        </p>

                        <button
                            className="modal-close"
                            onClick={() => setShowEmailLogin(false)}
                        >
                            뒤로 가기
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default Auth;
