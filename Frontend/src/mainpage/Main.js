import "./Main.css";

function Main() {
    return (
        <div className="page">
            {/* Header */}
            <header className="header">
                <div className="logo">ONSIL</div>

                <nav className="nav">
                    <span>스터디 찾기</span>
                    <span>자격증</span>
                    <span>커뮤니티</span>
                    <span>내 학습</span>
                </nav>

                <div className="header-actions">
                    <button className="login-btn">로그인</button>
                    <button className="create-btn">스터디 만들기</button>
                </div>
            </header>

            {/* Hero */}
            <section className="hero">
                <h1>
                    함께라서 끝까지 가는 <br />
                    화상 스터디 플랫폼
                </h1>
                <p>자격증 · 취업 · 개발 스터디를 실시간 화상으로</p>

                <div className="search-box">
                    <input placeholder="어떤 스터디를 찾고 있나요? (ex. 정보처리기사)" />
                    <button>스터디 검색</button>
                </div>
            </section>

            {/* Category */}
            <section className="category">
                <h2>스터디 카테고리</h2>
                <div className="category-list">
                    {["자격증", "취업", "어학", "자기계발"].map((c) => (
                        <div key={c} className="category-item">
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
                        <div key={i} className="study-card">
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
