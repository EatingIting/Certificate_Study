import "./Main.css";
import { useNavigate } from "react-router-dom";
import heroImg from "./메인메인.png";

/* ============================= */
/* 🔹 [추가] 스터디 카드 데이터 */
/* 👉 컴포넌트 함수 밖에 위치 */
/* ============================= */
const studyList = [
    {
        id: 1,
        tag: "화상 스터디",
        title: "정보처리기사 실전반",
        desc: "주 3회 · 최대 10명",
    },
    {
        id: 2,
        tag: "화상 스터디",
        title: "SQLD 단기 완성",
        desc: "주 2회 · 최대 8명",
    },
    {
        id: 3,
        tag: "화상 스터디",
        title: "리눅스 마스터",
        desc: "주 5회 · 최대 6명",
    },
    {
        id: 4,
        tag: "화상 스터디",
        title: "토익(일반)",
        desc: "주 4회 · 최대 4명",
    },
];

function Main() {
    const navigate = useNavigate();

    return (
        <div className="page">
            {/* Hero */}
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

            {/* Category */}
            <section className="main-category sample-container">
                <h2>스터디 카테고리</h2>
                <div className="main-list">
                    {["기능장", "기사", "산업기사", "자기계발", "자격증","자격증","자격증"].map((c) => (
                        <div key={c} className="main-item">
                            <div className="circle">{c[0]}</div>
                            <span>{c}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Study List */}
            <section className="study sample-container">
                <h2>지금 모집 중인 화상 스터디</h2>
                <div className="study-list">
                    {/* 🔹 [수정] [1,2,3,4].map → studyList.map */}
                    {studyList.map((study) => (
                        <div key={study.id} className="cardbox">
                            <div className="thumbnail" />

                            {/* 🔹 [수정] 하드코딩 제거 → 데이터 사용 */}
                            <span className="tag">{study.tag}</span>
                            <h3>{study.title}</h3>
                            <p>{study.desc}</p>

                            <button>자세히 보기</button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default Main;
