import "./Main.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { toBackendUrl } from "../utils/backendUrl";
import heroImg from "./메인메인.png";
import sampleImg from "./sample.jpg";

function Main() {
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [interestRooms, setInterestRooms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLogin, setIsLogin] = useState(false);

    useEffect(() => {
        fetchRooms();
        fetchCategories();

        const token = sessionStorage.getItem("accessToken");
        if (token) {
            setIsLogin(true);
            fetchInterestRooms();
        }
    }, []);

    // 배열 랜덤 셔플
    const shuffleArray = (array) => {
        return [...array].sort(() => Math.random() - 0.5);
    };

    // 지금 모집 중 스터디 (랜덤 4개)
    const fetchRooms = async () => {
        const res = await api.get("/rooms");

        let data = res.data;

        if (data.length > 4) {
            data = shuffleArray(data).slice(0, 4);
        }

        setRooms(data);
    };

    const fetchCategories = async () => {
        const res = await api.get("/category");
        setCategories(res.data.filter((c) => c.level === 1));
    };

    // 관심 자격증 기반 스터디
    const fetchInterestRooms = async () => {
        try {
            const token = sessionStorage.getItem("accessToken");
            if (!token) return;

            const res = await api.get("/main/interest");

            let data = res.data;

            // 4개 이상이면 랜덤 4개
            if (data.length > 4) {
                data = shuffleArray(data).slice(0, 4);
            }

            // 4개 미만이면 그대로
            setInterestRooms(data);
        } catch (err) {
            console.error("관심 스터디 조회 실패", err);
        }
    };

    const formatStartDate = (dateStr) => {
        if (!dateStr) return "";

        const [y, m, d] = dateStr.split("-");
        return `${y}년 ${m}월 ${d}일 시작`;
    };

    const categoryNameMap = {
        "공무원·공공시험": "공공시험",
        "민간자격·실무능력": "민간자격",
    };

    const getImageUrl = (img) => {
        if (!img) return sampleImg;

        if (img.startsWith("http")) {
            try {
                const url = new URL(img);

                if (url.hostname === window.location.hostname) {
                    return `${window.location.protocol}//${window.location.host}${url.pathname}`;
                }

                return img;
            } catch {
                return img;
            }
        }

        return toBackendUrl(img);
    };

    return (
        <div className="page">
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

            {isLogin && (
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
                                                e.currentTarget.src = sampleImg;
                                            }}
                                        />
                                    </div>

                                    <span className="main-tag">
                                        {room.subCategoryName ??
                                            room.midCategoryName}
                                    </span>

                                    <h5>{room.title}</h5>

                                    <p>{formatStartDate(room.startDate)}</p>

                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/room?open=${room.roomId}`
                                            )
                                        }
                                    >
                                        자세히 보기
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}

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
                                        e.currentTarget.src = sampleImg;
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
