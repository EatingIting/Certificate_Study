import "./Main.css";
import heroImg from "./메인메인.png"

function Main() {
    return (
        <div className="page">
            {/* Header */}
            <header className="header">
                <div className="logo">ONSIL</div>

                <div className="search-box">
                    <input placeholder="어떤 스터디를 찾고 있나요? (ex. 정보처리기사)" />
                    <button>스터디 검색</button>
                </div>


                <div className="main-actions">
                    <button className="login-btn" onClick={() => navigate("/auth")}>로그인</button>
                    <button className="cr-btn">스터디 만들기</button>
                </div>
            </header>

            {/* Hero */}
            <section className="hero"
                     style={{ "--hero-img": `url(${heroImg})` }}
            >
                <h1>
                    함께라서 끝까지 가는 <br />
                    화상 스터디 플랫폼
                </h1>
                <p>자격증 · 취업 · 개발 스터디를 실시간 화상으로</p>

                </section>

            {/* Category */}
            <section className="main-category">
                <h2>스터디 카테고리</h2>
                <div className="main-list">
                    {["자격증", "취업", "어학", "자기계발"].map((c) => (
                        <div key={c} className="main-item">
                            <div className="circle">{c[0]}</div>
                            <span>{c}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Study List */}
            <section className="study">
                <h2>지금 모집 중인 화상 스터디</h2>
                <div className="study-list">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="card">
                            <div className="thumbnail" />
                            <span className="tag">화상 스터디</span>
                            <h3>정보처리기사 실전반</h3>
                            <p>주 3회 · 최대 10명 </p>
                            <button>자세히 보기</button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default Main;
