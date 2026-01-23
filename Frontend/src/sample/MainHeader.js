import "./MainHeader.css";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import { Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";

const MainHeader = () => {
  const navigate = useNavigate();

  const {pathname} = useLocation();

  return (
    <div className="page">
      <header className="header sample-container">
        <div className="logo">ONSIL</div>

        <div className="search-box">
          <input placeholder="어떤 스터디를 찾고 있나요? (ex. 정보처리기사)" />
          <button>스터디 검색</button>
        </div>


        <div className="main-actions">
          <button className="login-btn" onClick={() => navigate("/auth")}>로그인</button>
          <button className="cr-btn" onClick={() => navigate("/create")}>스터디 만들기</button>
        </div>
      </header>
        {
            pathname === '/room' ?
                <div className="sample-container sample-layout">
                    <MainSideBar />
                    <main className="sample-content">
                        {/* ✅ 여기만 페이지별로 갈아끼워짐 */}
                        <Outlet />
                    </main>
                </div>
            :
            <Outlet/>
        }
    </div>
  );
};

export default MainHeader;
