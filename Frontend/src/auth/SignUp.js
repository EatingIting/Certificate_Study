import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Auth.css";
import { checkEmail, signup } from "../api/api";
import api from "../api/api";

const Signup = () => {
    const navigate = useNavigate();

    const [params] = useSearchParams();
    const oauthEmail = params.get("email");
    const oauthProvider = params.get("provider");

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
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    const [allCategories, setAllCategories] = useState([]);
    const [mainCategories, setMainCategories] = useState([]);
    const [midCategories, setMidCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    const [selectedMain, setSelectedMain] = useState(null);
    const [selectedMid, setSelectedMid] = useState(null);
    const [selectedSub, setSelectedSub] = useState(null);

    const [interestCategories, setInterestCategories] = useState([]);

    useEffect(() => {
        api.get("/category").then((res) => setAllCategories(res.data));
        api.get("/category/main").then((res) => setMainCategories(res.data));
    }, []);

    useEffect(() => {
        if (oauthEmail) {
            setForm((prev) => ({
                ...prev,
                email: oauthEmail,
            }));

            setEmailChecked(true);

            if (oauthProvider === "kakao") {
                setEmailMessage("카카오 로그인 이메일입니다.");
            } else if (oauthProvider === "naver") {
                setEmailMessage("네이버 로그인 이메일입니다.");
            } else if (oauthProvider === "google") {
                setEmailMessage("구글 로그인 이메일입니다.");
            } else {
                setEmailMessage("OAuth 로그인 이메일입니다.");
            }
        }
    }, [oauthEmail, oauthProvider]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));

        if (name === "email") {
            setEmailChecked(false);
            setEmailMessage("");
        }

        if (name === "password" || name === "passwordConfirm") {
            setPasswordError("");
        }
    };

    const checkEmailDuplicate = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.email) {
            setEmailMessage("이메일 주소를 입력해 주세요.");
            return;
        }

        if (!emailRegex.test(form.email)) {
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
            setEmailMessage("이메일 확인 중 오류가 발생했습니다.");
        }
    };

    const validateSignup = () => {
        if (!form.email) {
            alert("이메일을 입력해 주세요.");
            return false;
        }

        if (!emailChecked) {
            alert("이메일 중복 확인을 해주세요.");
            return false;
        }

        if (!form.password) {
            alert("비밀번호를 입력해 주세요.");
            return false;
        }

        if (!form.passwordConfirm) {
            alert("비밀번호 확인을 입력해 주세요.");
            return false;
        }

        if (form.password !== form.passwordConfirm) {
            setPasswordError("비밀번호가 일치하지 않습니다.");
            return false;
        }

        if (!form.name) {
            alert("이름을 입력해 주세요.");
            return false;
        }

        if (!form.nickname) {
            alert("닉네임을 입력해 주세요.");
            return false;
        }

        if (!form.birthDate) {
            alert("생년월일을 입력해 주세요.");
            return false;
        }

        if (!form.gender) {
            alert("성별을 선택해 주세요.");
            return false;
        }

        return true;
    };

    const handleMainChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMain(id);
        setSelectedMid(null);
        setSelectedSub(null);
        setMidCategories([]);
        setSubCategories([]);

        if (!id) return;

        setMidCategories(
            allCategories.filter((c) => c.level === 2 && c.parentId === id)
        );
    };

    const handleMidChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMid(id);
        setSelectedSub(null);
        setSubCategories([]);

        if (!id) return;

        setSubCategories(
            allCategories.filter((c) => c.level === 3 && c.parentId === id)
        );
    };

    const addCategory = () => {
        const categoryId = selectedSub ?? selectedMid;

        if (!categoryId) {
            alert("카테고리를 선택해주세요.");
            return;
        }

        if (interestCategories.includes(categoryId)) {
            alert("이미 추가된 관심 자격증입니다.");
            return;
        }

        if (interestCategories.length >= 4) {
            alert("관심 자격증은 최대 4개까지 가능합니다.");
            return;
        }

        setInterestCategories([...interestCategories, categoryId]);
    };

    const handleSignup = async () => {
        if (!validateSignup()) return;

        if (!agreeTerms) {
            alert("약관에 동의해야 가입할 수 있습니다.");
            return;
        }

        try {
            await signup({
                email: form.email,
                password: form.password,
                name: form.name,
                nickname: form.nickname,
                birthDate: form.birthDate,
                gender: form.gender,
                introduction: form.introduction || null,
                interestCategoryIds: interestCategories,
            });
            alert("회원가입이 완료되었습니다.");
            navigate("/auth");
        } catch {
            alert("회원가입 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="signup-wrapper">
            <div className="login-container">
                <h2>회원가입</h2>

                <div className="email-check-group">
                    <input
                        type="email"
                        name="email"
                        placeholder="이메일"
                        value={form.email}
                        onChange={handleChange}
                        disabled={!!oauthEmail}
                        className="modal-input"
                    />
                    {!oauthEmail && (
                        <button
                            type="button"
                            className="email-check-btn"
                            onClick={checkEmailDuplicate}
                        >
                            중복확인
                        </button>
                    )}
                </div>

                {emailMessage && (
                    <p className={emailChecked ? "msg-ok" : "msg-error"}>
                        {emailMessage}
                    </p>
                )}

                <input
                    type="password"
                    name="password"
                    placeholder="비밀번호"
                    value={form.password}
                    onChange={handleChange}
                    className="modal-input"
                />

                <input
                    type="password"
                    name="passwordConfirm"
                    placeholder="비밀번호 확인"
                    value={form.passwordConfirm}
                    onChange={handleChange}
                    className="modal-input"
                />

                {passwordError && <p className="input-error">{passwordError}</p>}

                <input
                    type="text"
                    name="name"
                    placeholder="이름"
                    value={form.name}
                    onChange={handleChange}
                    className="modal-input"
                />

                <input
                    type="text"
                    name="nickname"
                    placeholder="닉네임"
                    value={form.nickname}
                    onChange={handleChange}
                    className="modal-input"
                />

                <p className="signup-section-label">생년월일</p>
                <input
                    type="date"
                    name="birthDate"
                    value={form.birthDate}
                    onChange={handleChange}
                    className="modal-input"
                />

                <div className="gender-group">
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

                <p className="signup-section-label">관심 자격증 (최대 4개)</p>

                <select value={selectedMain ?? ""} onChange={handleMainChange}>
                    <option value="">대분류 선택</option>
                    {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedMid ?? ""}
                    onChange={handleMidChange}
                    disabled={!selectedMain}
                >
                    <option value="">중분류 선택</option>
                    {midCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedSub ?? ""}
                    onChange={(e) =>
                        setSelectedSub(Number(e.target.value) || null)
                    }
                    disabled={!selectedMid || subCategories.length === 0}
                >
                    <option value="">소분류 선택 (선택)</option>
                    {subCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <button type="button" onClick={addCategory}>
                    관심 자격증 추가
                </button>

                <div className="chip-row">
                    {interestCategories.length === 0 ? (
                        <div className="empty">
                            등록된 관심 자격증이 없어요.
                        </div>
                    ) : (
                        interestCategories.map((id) => {
                            const category = allCategories.find(
                                (c) => c.id === id
                            );

                            return (
                                <span className="chip" key={id}>
                                    {category?.name}
                                    <button
                                        className="chip-x"
                                        onClick={() =>
                                            setInterestCategories(
                                                interestCategories.filter(
                                                    (c) => c !== id
                                                )
                                            )
                                        }
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })
                    )}
                </div>

                <div className="terms-group">
                    <label className="terms-checkbox">
                        <input
                            className="terms-checkbox-input"
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                        />
                        <span className="agree-text">
                            회원 가입 및 회원 관리 등의 목적으로 이메일,
                            비밀번호 등의 정보를 수집 및 이용하고 있습니다.
                        </span>
                    </label>
                </div>

                <button
                    type="button"
                    className="modal-login-btn"
                    onClick={handleSignup}
                >
                    회원가입
                </button>

                <p className="modal-switch">
                    이미 계정이 있으신가요?
                    <span onClick={() => navigate("/auth")}>로그인</span>
                </p>
            </div>
        </div>
    );
};

export default Signup;
