import "./Main.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import heroImg from "./메인메인.png";
import { toBackendUrl } from "../utils/backendUrl";

function Main() {
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchRooms();
        fetchCategories();
    }, []);

    const fetchRooms = async () => {
        const res = await api.get("/rooms");

        setRooms(
            [...res.data]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 4)
        );
    };

    const fetchCategories = async () => {
        const res = await api.get("/category");

        setCategories(res.data.filter((c) => c.level === 1));
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
        if (!img) return "/기본이미지.jpg";

        if (img.startsWith("http")) return img;

        return `http://localhost:8080${img}`;
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

            <section className="study sample-container">
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
                                        e.currentTarget.src = "/기본이미지.jpg";
                                    }}
                                />
                            </div>

                            <span className="main-tag">
                                {room.subCategoryName ?? room.midCategoryName}
                            </span>

                            <h3>{room.title}</h3>

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
