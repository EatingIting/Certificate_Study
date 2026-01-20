import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import { checkEmail, signup, login } from "../api/api.js";

const Auth = () => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [isSignup, setIsSignup] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
        passwordConfirm: "",
        name: "",
        nickname: "",
        birthDate: "",
        gender: "",
        introduction: "",
    });

    const [emailChecked, setEmailChecked] = useState(false);
    const [emailMessage, setEmailMessage] = useState("");

    const [loginErrors, setLoginErrors] = useState({
        email: "",
        password: "",
    });

    const [signupErrors, setSignupErrors] = useState({
        email: "",
        password: "",
        passwordConfirm: "",
        name: "",
        nickname: "",
        birthDate: "",
        gender: "",
    });

    const openModalForLogin = () => {
        setShowModal(true);
        setIsSignup(false);
        setLoginErrors({ email: "", password: "" });
        setSignupErrors({
            email: "",
            password: "",
            passwordConfirm: "",
            name: "",
            nickname: "",
            birthDate: "",
            gender: "",
        });
    };

    const openModalForSignup = () => {
        setShowModal(true);
        setIsSignup(true);
        setEmailChecked(false);
        setEmailMessage("");
        setLoginErrors({ email: "", password: "" });
        setSignupErrors({
            email: "",
            password: "",
            passwordConfirm: "",
            name: "",
            nickname: "",
            birthDate: "",
            gender: "",
        });
    };

    const closeModal = () => {
        setShowModal(false);
        setIsSignup(false);
        setEmailChecked(false);
        setEmailMessage("");
        setLoginErrors({ email: "", password: "" });
        setSignupErrors({
            email: "",
            password: "",
            passwordConfirm: "",
            name: "",
            nickname: "",
            birthDate: "",
            gender: "",
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (name === "email") {
            setEmailChecked(false);
            setEmailMessage("");
        }

        if (!isSignup && (name === "email" || name === "password")) {
            setLoginErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }

        if (isSignup) {
            setSignupErrors((prev) => {
                const nextErrors = { ...prev, [name]: "" };

                if (
                    (name === "password" || name === "passwordConfirm") &&
                    form.password &&
                    form.passwordConfirm &&
                    (name === "password"
                        ? value !== form.passwordConfirm
                        : form.password !== value)
                ) {
                    nextErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
                }

                return nextErrors;
            });
        }
    };

    const checkEmailDuplicate = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.email) {
            setEmailChecked(false);
            setEmailMessage("이메일 주소를 입력해 주세요.");
            return;
        }

        if (!emailRegex.test(form.email)) {
            setEmailChecked(false);
            setEmailMessage("이메일 형식이 올바르지 않습니다.");
            return;
        }

        try {
            const res = await checkEmail(form.email);

            if (res.data.available) {
                setEmailChecked(true);
                setEmailMessage("사용 가능한 이메일입니다.");
            } else {
                setEmailChecked(false);
                setEmailMessage("이미 사용 중인 이메일입니다.");
            }
        } catch {
            setEmailChecked(false);
            setEmailMessage("이메일 중복 확인 중 오류가 발생했습니다.");
        }
    };

    const handleLogin = async () => {
        const errors = { email: "", password: "" };

        if (!form.email) errors.email = "이메일 주소를 입력해 주세요.";
        if (!form.password) errors.password = "비밀번호를 입력해 주세요.";

        setLoginErrors(errors);
        if (errors.email || errors.password) return;

        try {
            const res = await login(form.email, form.password);

            localStorage.setItem("userId", res.data.userId);
            localStorage.setItem("nickname", res.data.nickname);

            alert("로그인 성공");
            closeModal();

            navigate("/roompage"); // 또는 /mypage
        } catch {
            alert("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
    };

    const validateSignup = () => {
        const errors = {
            email: "",
            password: "",
            passwordConfirm: "",
            name: "",
            nickname: "",
            age: "",
            gender: "",
        };

        if (!form.email) errors.email = "이메일 주소를 입력해 주세요.";
        else if (!emailChecked) errors.email = "이메일 중복 확인을 해주세요.";

        if (!form.password) errors.password = "비밀번호를 입력해 주세요.";

        if (!form.passwordConfirm)
            errors.passwordConfirm = "비밀번호 확인을 입력해 주세요.";
        else if (form.password !== form.passwordConfirm)
            errors.passwordConfirm = "비밀번호가 일치하지 않습니다.";

        if (!form.name) errors.name = "이름을 입력해 주세요.";
        if (!form.nickname) errors.nickname = "닉네임을 입력해 주세요.";
        if (!form.birthDate) errors.birthDate = "생년월일을 입력해 주세요.";
        if (!form.gender) errors.gender = "성별을 선택해 주세요.";

        setSignupErrors(errors);
        return !Object.values(errors).some(Boolean);
    };

    const handleSignup = async () => {
        if (
            !form.email ||
            !form.password ||
            !form.passwordConfirm ||
            !form.name ||
            !form.nickname ||
            !form.birthDate ||
            !form.gender
        ) {
            alert("필수 항목을 모두 입력해 주세요.");
            return;
        }

        if (!validateSignup()) return;

        const signupData = {
            email: form.email,
            password: form.password,
            name: form.name,
            nickname: form.nickname,
            birthDate: form.birthDate,
            gender: form.gender,
            introduction: form.introduction || null,
        };

        try {
            await signup(signupData);
            alert("회원가입이 완료되었습니다.");
            closeModal();
        } catch {
            alert("회원가입 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-container">
                <div className="logo-area">
                    <h1 className="logo">온실</h1>
                </div>

                <div className="login-title">
                    <h3>목표에 집중하는 원격 스터디 그룹</h3>
                    <p>시간과 장소에 구애받지 않는 학습 환경</p>
                </div>

                <div className="button-group">
                    <button className="social-btn kakao">카카오로 시작하기</button>
                    <button className="social-btn naver">네이버로 시작하기</button>
                    <button className="social-btn google">구글로 시작하기</button>
                </div>

                <button className="email-login" onClick={openModalForLogin}>
                    이메일로 시작하기 →
                </button>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3 className="modal-title">
                            {isSignup ? "회원가입" : "이메일 로그인"}
                        </h3>

                        <div className="email-check-group">
                            <input
                                type="email"
                                name="email"
                                placeholder="이메일"
                                className={`modal-input ${
                                    isSignup
                                        ? signupErrors.email
                                            ? "error"
                                            : ""
                                        : loginErrors.email
                                            ? "error"
                                            : ""
                                }`}
                                value={form.email}
                                onChange={handleChange}
                            />

                            {isSignup && (
                                <button
                                    type="button"
                                    className="email-check-btn"
                                    onClick={checkEmailDuplicate}
                                >
                                    중복확인
                                </button>
                            )}
                        </div>

                        {isSignup && signupErrors.email && (
                            <p className="input-error">{signupErrors.email}</p>
                        )}

                        {isSignup ? (
                            emailMessage ? (
                                <p className={emailChecked ? "msg-ok" : "msg-error"}>
                                    {emailMessage}
                                </p>
                            ) : null
                        ) : (
                            loginErrors.email && (
                                <p className="input-error">{loginErrors.email}</p>
                            )
                        )}

                        <input
                            type="password"
                            name="password"
                            placeholder="비밀번호"
                            className={`modal-input ${
                                isSignup
                                    ? signupErrors.password
                                        ? "error"
                                        : ""
                                    : loginErrors.password
                                        ? "error"
                                        : ""
                            }`}
                            value={form.password}
                            onChange={handleChange}
                        />

                        {isSignup && signupErrors.password && (
                            <p className="input-error">{signupErrors.password}</p>
                        )}

                        {!isSignup && loginErrors.password && (
                            <p className="input-error">{loginErrors.password}</p>
                        )}

                        {isSignup && (
                            <>
                                <input
                                    type="password"
                                    name="passwordConfirm"
                                    placeholder="비밀번호 확인"
                                    className={`modal-input ${
                                        signupErrors.passwordConfirm ? "error" : ""
                                    }`}
                                    value={form.passwordConfirm}
                                    onChange={handleChange}
                                />
                                {signupErrors.passwordConfirm && (
                                    <p className="input-error">
                                        {signupErrors.passwordConfirm}
                                    </p>
                                )}

                                <input
                                    type="text"
                                    name="name"
                                    placeholder="이름"
                                    className={`modal-input ${
                                        signupErrors.name ? "error" : ""
                                    }`}
                                    value={form.name}
                                    onChange={handleChange}
                                />
                                {signupErrors.name && (
                                    <p className="input-error">{signupErrors.name}</p>
                                )}

                                <input
                                    type="text"
                                    name="nickname"
                                    placeholder="닉네임"
                                    className={`modal-input ${
                                        signupErrors.nickname ? "error" : ""
                                    }`}
                                    value={form.nickname}
                                    onChange={handleChange}
                                />
                                {signupErrors.nickname && (
                                    <p className="input-error">
                                        {signupErrors.nickname}
                                    </p>
                                )}

                                <input
                                    type="date"
                                    name="birthDate"
                                    className="modal-input"
                                    value={form.birthDate}
                                    onChange={handleChange}
                                />

                                <div
                                    className={`gender-group ${
                                        signupErrors.gender ? "error" : ""
                                    }`}
                                >
                                    <span className="gender-label">성별</span>

                                    <label className="gender-radio">
                                        <input
                                            type="radio"
                                            name="gender"
                                            value="MALE"
                                            checked={form.gender === "MALE"}
                                            onChange={handleChange}
                                        />
                                        남성
                                    </label>

                                    <label className="gender-radio">
                                        <input
                                            type="radio"
                                            name="gender"
                                            value="FEMALE"
                                            checked={form.gender === "FEMALE"}
                                            onChange={handleChange}
                                        />
                                        여성
                                    </label>
                                </div>
                                {signupErrors.gender && (
                                    <p className="input-error">
                                        {signupErrors.gender}
                                    </p>
                                )}
                            </>
                        )}

                        <button
                            className="modal-login-btn"
                            onClick={isSignup ? handleSignup : handleLogin}
                            disabled={false}
                        >
                            {isSignup ? "회원가입" : "로그인"}
                        </button>

                        <div className="modal-switch">
                            {isSignup ? (
                                <>
                                    이미 계정이 있으신가요?
                                    <span onClick={openModalForLogin}>로그인</span>
                                </>
                            ) : (
                                <>
                                    아직 회원이 아니신가요?
                                    <span onClick={openModalForSignup}>회원가입</span>
                                </>
                            )}
                        </div>

                        <button className="modal-close" onClick={closeModal}>
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Auth;
