import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import logo from "./메인로고.png";
import { login } from "../api/api";

const Auth = () => {
    const navigate = useNavigate();

    const [showEmailLogin, setShowEmailLogin] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [errors, setErrors] = useState({
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleLogin = async () => {
        const nextErrors = { email: "", password: "" };

        if (!form.email) nextErrors.email = "이메일 주소를 입력해 주세요.";
        if (!form.password) nextErrors.password = "비밀번호를 입력해 주세요.";

        setErrors(nextErrors);
        if (nextErrors.email || nextErrors.password) return;

        try {
            const res = await login(form.email, form.password);

            localStorage.setItem("userId", res.data.userId);
            localStorage.setItem("nickname", res.data.nickname);
            localStorage.setItem("accessToken", res.data.token);

            alert("로그인 성공");
            navigate("/room");
        } catch {
            alert("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
    };

    return (
        <>
            <div className="login-wrapper">
                <div className="login-container">
                    {!showEmailLogin ? (
                        /* ===== 1️⃣ OAuth 시작 화면 ===== */
                        <>
                            <div className="logo-area">
                                <img src={logo} alt="온실 로고" onClick={() => navigate("/")} className="onsil-logo"/>
                            </div>

                            <div className="login-title">
                                <h3>목표에 집중하는 원격 스터디 그룹</h3>
                                <p>시간과 장소에 구애받지 않는 학습 환경</p>
                            </div>

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

                            <button
                                className="email-login"
                                onClick={() => setShowEmailLogin(true)}
                            >
                                이메일로 시작하기 →
                            </button>
                        </>
                    ) : (
                        /* ===== 2️⃣ 이메일 로그인 화면 ===== */
                        <>
                            <h3 className="modal-title">이메일 로그인</h3>

                            <input
                                type="email"
                                name="email"
                                placeholder="이메일"
                                value={form.email}
                                onChange={handleChange}
                                className={`modal-input ${
                                    errors.email ? "error" : ""
                                }`}
                            />
                            {errors.email && (
                                <p className="input-error">{errors.email}</p>
                            )}

                            <input
                                type="password"
                                name="password"
                                placeholder="비밀번호"
                                value={form.password}
                                onChange={handleChange}
                                className={`modal-input ${
                                    errors.password ? "error" : ""
                                }`}
                            />
                            {errors.password && (
                                <p className="input-error">
                                    {errors.password}
                                </p>
                            )}

                            <button
                                className="modal-login-btn"
                                onClick={handleLogin}
                            >
                                로그인
                            </button>

                            <p className="modal-switch">
                                아직 회원이 아니신가요?
                                <span
                                    onClick={() => navigate("/signup")}
                                >
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
        </>
    );
};

export default Auth;
