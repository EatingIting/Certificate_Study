import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import { login } from "../api/api";
import { getBackendOrigin } from "../utils/backendUrl";

const logo = require("./메인로고.png");

const Auth = () => {
    const navigate = useNavigate();

    const [showEmailLogin, setShowEmailLogin] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [autoLogin, setAutoLogin] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async () => {
        try {
            const res = await login(form.email, form.password);

            let token = res.data.token;
            if (token.startsWith("Bearer ")) {
                token = token.replace("Bearer ", "");
            }

            sessionStorage.setItem("userId", res.data.userId);
            sessionStorage.setItem("nickname", res.data.nickname);
            sessionStorage.setItem("accessToken", token);

            if (autoLogin) {
                localStorage.setItem("userId", res.data.userId);
                localStorage.setItem("nickname", res.data.nickname);
                localStorage.setItem("accessToken", token);

                const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
                localStorage.setItem("expiresAt", expiresAt);
            }

            alert("로그인 성공");
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
                                카카오로 시작하기
                            </button>

                            <button
                                className="social-btn naver"
                                onClick={() => handleOAuthLogin("naver")}
                            >
                                네이버로 시작하기
                            </button>

                            <button
                                className="social-btn google"
                                onClick={() => handleOAuthLogin("google")}
                            >
                                구글로 시작하기
                            </button>
                        </div>

                        <button
                            className="email-login"
                            onClick={() => setShowEmailLogin(true)}
                        >
                            이메일로 시작하기 →
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
                                    onChange={(e) =>
                                        setAutoLogin(e.target.checked)
                                    }
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
                            ← 뒤로가기
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default Auth;
