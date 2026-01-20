import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "./MyPage.css";
import onsil from "./온실.png";
import Profile from "./기본이미지.jpg";

const MyPage = () => {
    const navigate = useNavigate();

    const [user, setUser] = useState({
        name: "",
        nickname: "",
        email: "",
        birthDate: "",
        gender: "",
        introduction: "",
        created_at: "",
        profileImage: null,
    });

    const [previewImage, setPreviewImage] = useState(Profile);

    const nickname = localStorage.getItem("nickname");
    const userId = localStorage.getItem("userId");

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    /* ===== 로그인 체크 ===== */
    useEffect(() => {
        if (!userId) {
            alert("로그인이 필요합니다.");
            navigate("/auth");
        }
    }, [userId, navigate]);

    /* ===== 유저 정보 로딩 ===== */
    useEffect(() => {
        if (!userId) return;

        const fetchMyPage = async () => {
            try {
                const res = await api.get("/users/me");
                const data = res.data;

                setUser({
                    name: data.name ?? "",
                    nickname: data.nickname ?? "",
                    email: data.email ?? "",
                    birthDate: data.birthDate ?? "",
                    gender: data.gender ?? "",
                    introduction: data.introduction ?? "",
                    created_at: data.createdAt ?? "",
                    profileImage: null,
                });

                if (data.profileImg) {
                    setPreviewImage(`http://172.30.1.61:8080${data.profileImg}`);
                } else {
                    setPreviewImage(Profile);
                }
            } catch (error) {
                console.error("마이페이지 조회 실패", error);
                alert("세션이 만료되었습니다. 다시 로그인해주세요.");
                localStorage.clear();
                navigate("/auth");
            }
        };

        fetchMyPage();
    }, [userId, navigate]);

    /* ===== 드롭다운 닫기 ===== */
    useEffect(() => {
        const closeMenu = () => setIsUserMenuOpen(false);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    /* ===== 프로필 이미지 변경 ===== */
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUser((prev) => ({ ...prev, profileImage: file }));
        setPreviewImage(URL.createObjectURL(file));
    };

    /* ===== 저장 ===== */
    const handleSave = async () => {
        if (!userId) return;

        const formData = new FormData();
        formData.append("name", user.name);
        formData.append("nickname", user.nickname);
        formData.append("birthDate", user.birthDate);
        formData.append("introduction", user.introduction ?? "");

        if (user.profileImage) {
            formData.append("profileImage", user.profileImage);
        }

        try {
            await api.put("/users/me", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            alert("회원 정보가 수정되었습니다.");
        } catch (error) {
            console.error("저장 실패", error);
            alert("저장에 실패했습니다.");
        }
    };

    return (
        <>
            {/* ===== 헤더 ===== */}
            <header className="top-header">
                <div className="page-container header-inner">
                    <div className="header-logo">
                        <img
                            src={onsil}
                            alt="온실"
                            onClick={() => navigate("/")}
                            style={{ cursor: "pointer" }}
                        />
                    </div>

                    {nickname ? (
                        <div className="user-menu-wrapper">
                            <button
                                className="auth-btns"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsUserMenuOpen((prev) => !prev);
                                }}
                            >
                                {nickname} 님 ▾
                            </button>

                            {isUserMenuOpen && (
                                <div
                                    className="user-dropdown"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ul>
                                        <li onClick={() => navigate("/mypage")}>
                                            마이페이지
                                        </li>
                                        <li onClick={() => navigate("/lms")}>
                                            내 클래스
                                        </li>
                                        <li onClick={() => navigate("/my-applications")}>
                                            스터디 신청 현황
                                        </li>
                                        <li
                                            className="logout"
                                            onClick={() => {
                                                localStorage.clear();
                                                navigate("/auth");
                                            }}
                                        >
                                            로그아웃
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            className="auth-btns"
                            onClick={() => navigate("/auth")}
                        >
                            로그인 / 회원가입
                        </button>
                    )}
                </div>
            </header>

            {/* ===== 본문 ===== */}
            <div className="page-container">
                <div className="mypage-wrapper">
                    <h2>마이페이지</h2>

                    <div className="profile-card">
                        <div className="profile-image">
                            <label htmlFor="profileUpload">
                                <img src={previewImage} alt="프로필" />
                                <span className="edit-text">사진 변경</span>
                            </label>
                            <input
                                id="profileUpload"
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleImageChange}
                            />
                        </div>

                        <div className="profile-info">
                            <div className="info-row">
                                <label>이름</label>
                                <input
                                    value={user.name}
                                    onChange={(e) =>
                                        setUser({ ...user, name: e.target.value })
                                    }
                                />
                            </div>

                            <div className="info-row">
                                <label>닉네임</label>
                                <input
                                    value={user.nickname}
                                    onChange={(e) =>
                                        setUser({
                                            ...user,
                                            nickname: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="info-row">
                                <label>이메일</label>
                                <span>{user.email}</span>
                            </div>

                            <div className="info-row">
                                <label>생년월일</label>
                                <span>{user.birthDate}</span>
                            </div>

                            <div className="info-row">
                                <label>성별</label>
                                <span>
                                    {user.gender === "MALE"
                                        ? "남성"
                                        : user.gender === "FEMALE"
                                            ? "여성"
                                            : ""}
                                </span>
                            </div>

                            <div className="info-row">
                                <label>가입일</label>
                                <span>{user.created_at?.substring(0, 10)}</span>
                            </div>

                            <div className="info-row">
                                <label>자기소개</label>
                                <textarea
                                    value={user.introduction}
                                    onChange={(e) =>
                                        setUser({
                                            ...user,
                                            introduction: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mypage-actions">
                        <button className="save-btn" onClick={handleSave}>
                            저장하기
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MyPage;
