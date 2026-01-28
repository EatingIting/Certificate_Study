import "./Main.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import heroImg from "./메인메인.png";

function Main() {
    const navigate = useNavigate();

    // 최신 모집 스터디
    const [rooms, setRooms] = useState([]);

    // 관심 자격증 기반 추천 스터디
    const [interestRooms, setInterestRooms] = useState([]);

    // 메인 카테고리 목록
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchRooms();
        fetchCategories();
        fetchInterestRooms();
    }, []);

    // 최신 모집 스터디 조회
    const fetchRooms = async () => {
        const res = await api.get("/rooms");

        setRooms(
            [...res.data]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 4)
        );
    };

    // 메인 카테고리 조회
    const fetchCategories = async () => {
        const res = await api.get("/category");

        setCategories(res.data.filter((c) => c.level === 1));
    };

    // 관심 자격증 기반 스터디 조회
    const fetchInterestRooms = async () => {
        try {
            const token = sessionStorage.getItem("accessToken");

            if (!token) return;

            const res = await api.get("/main/interest");

            let data = res.data;

            while (data.length > 0 && data.length < 4) {
                data = [...data, ...data];
            }

            data = data.slice(0, 4);

            setInterestRooms(data);

        } catch (err) {
            console.error("관심 스터디 조회 실패", err);
        }
    };

    // 날짜 출력 포맷
    const formatStartDate = (dateStr) => {
        if (!dateStr) return "";

        const [y, m, d] = dateStr.split("-");
        return `${y}년 ${m}월 ${d}일 시작`;
    };

    // 카테고리 이름 축약
    const categoryNameMap = {
        "공무원·공공시험": "공공시험",
        "민간자격·실무능력": "민간자격",
    };

    // 이미지 URL 처리
    const getImageUrl = (img) => {
        if (!img) return "/sample.jpg";

        if (img.startsWith("http")) return img;

        return `http://localhost:8080${img}`;
    };

    return (
        <div className="page">
            {/* HERO */}
            <section
                className="hero sample-container"
                style={{ "--hero-img": `url(${heroImg})` }}
            >
                <h1>
                    함께라서 끝까지 가는 <br />
                    화상 스터디 플랫폼
                </h1>
                <p>자격증 · 취업 · 개발 스터디를 실시간 화상으로</p>
            </section>

            {/* 메인 카테고리 */}
            <section className="main-category sample-container">
                <h2>스터디 카테고리</h2>

                <div className="main-list">
                    {categories.map((c) => (
                        <div
                            key={c.id}
                            className="main-item"
                            onClick={() => navigate(`/room?cat=${c.name}`)}
                            style={{ cursor: "pointer" }}
                        >
                            <div className="circle">
                                {(categoryNameMap[c.name] ?? c.name)[0]}
                            </div>

                            <span>{categoryNameMap[c.name] ?? c.name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* 관심 자격증 화상 스터디 */}
            <section className="study-sample-container">
                <h2>관심 자격증 화상 스터디</h2>

                <div className="study-list">
                    {interestRooms.length === 0 ? (
                        <div className="empty">
                            관심 자격증 기반 스터디가 없습니다.
                        </div>
                    ) : (
                        interestRooms.map((room, idx) => (
                            <div key={idx} className="cardbox">
                                <div className="thumbnail">
                                    <img
                                        src={getImageUrl(room.roomImg)}
                                        alt="스터디 썸네일"
                                        className="thumb-img"
                                        onError={(e) => {
                                            e.currentTarget.src = "/sample.jpg";
                                        }}
                                    />
                                </div>

                                <span className="main-tag">
                                    {room.subCategoryName ?? room.midCategoryName}
                                </span>

                                <h5>{room.title}</h5>

                                <p>{formatStartDate(room.startDate)}</p>

                                <button
                                    onClick={() =>
                                        navigate(`/room?open=${room.roomId}`)
                                    }
                                >
                                    자세히 보기
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* 최신 모집 중인 스터디 */}
            <section className="study-sample-container">
                <h2>지금 모집 중인 화상 스터디</h2>

                <div className="study-list">
                    {rooms.map((room) => (
                        <div key={room.roomId} className="cardbox">
                            <div className="thumbnail">
                                <img
                                    src={getImageUrl(room.roomImg)}
                                    alt="스터디 썸네일"
                                    className="thumb-img"
                                    onError={(e) => {
                                        e.currentTarget.src = "/sample.jpg";
                                    }}
                                />
                            </div>

                            <span className="main-tag">
                                {room.subCategoryName ?? room.midCategoryName}
                            </span>

                            <h5>{room.title}</h5>

                            <p>{formatStartDate(room.startDate)}</p>

                            <button
                                onClick={() =>
                                    navigate(`/room?open=${room.roomId}`)
                                }
                            >
                                자세히 보기
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default Main;
