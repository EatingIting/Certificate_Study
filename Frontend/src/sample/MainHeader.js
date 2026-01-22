import "./MainHeader.css";
import { useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";

const MainHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="sample-page">
      <header className="header">
        <div className="sample-container header-inner">
          <div className="logo" onClick={() => navigate("/")}>ONSIL</div>

          <nav className="nav">
            <span onClick={() => navigate("/sample/room")}>스터디 찾기</span>
            <span>자격증</span>
            <span>커뮤니티</span>
            <span>내 학습</span>
          </nav>

          <div className="header-actions">
            <button className="login-btn" onClick={() => navigate("/auth")}>
              로그인
            </button>
            <button className="create-btn" onClick={() => navigate("/create")}>
              스터디 만들기
            </button>
          </div>
        </div>
      </header>

      <div className="sample-container sample-layout">
        <MainSideBar />

        <main className="sample-content">
          {/* ✅ 여기만 페이지별로 갈아끼워짐 */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainHeader;
