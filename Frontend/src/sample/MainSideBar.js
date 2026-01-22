import "./MainSideBar.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

const MainSideBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ 로그인 여부 (토큰이 있으면 로그인 상태)
  const isLoggedIn = Boolean(localStorage.getItem("accessToken"));

  // ✅ active 판별
  const isActive = (path) => location.pathname.startsWith(path);

  // ✅ 초기값: 전부 열림
  const [openKeys, setOpenKeys] = useState(["study", "my", "community", "account"]);

  const toggleParent = (key) => {
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const go = (path) => navigate(path);

  // ✅ 로그아웃 처리
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    // 필요하면 refreshToken 등도 지워줘
    // localStorage.removeItem("refreshToken");

    alert("로그아웃 되었습니다.");
    navigate("/auth"); // 로그아웃 후 이동
  };

  return (
    <aside className="sample-sidebar">
      <div className="sb-scroll">
        <ul className="menu-list">
          {/* 홈 */}
          <li
            className={`menu-item menu-single ${isActive("/sample") ? "active" : ""}`}
            onClick={() => go("/sample")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && go("/sample")}
          >
            홈
          </li>

          {/* 스터디 */}
          <li className={`menu-group ${openKeys.includes("study") ? "open" : ""}`}>
            <div
              className={`menu-item menu-parent ${
                isActive("/roompage") || isActive("/study") ? "active" : ""
              }`}
              onClick={() => toggleParent("study")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggleParent("study")}
            >
              <span className="menu-label">스터디</span>
              <span className="arrow">{openKeys.includes("study") ? "▾" : "▸"}</span>
            </div>

            <ul className="submenu">
                <li
                className={`submenu-item ${isActive("/sample/room") ? "active" : ""}`}
                onClick={() => go("/room")}
                >
                가입 가능한 스터디
                </li>


              <li
                className={`submenu-item ${isActive("/study/create") ? "active" : ""}`}
                onClick={() => go("/create")}
              >
                스터디 만들기
              </li>

              {/* ✅ 로그인했을 때만 내 스터디 보여주기 */}
              {isLoggedIn && (
                <li
                  className={`submenu-item ${isActive("/study/my") ? "active" : ""}`}
                  onClick={() => go("/study/my")}
                >
                  내 스터디
                </li>
              )}
            </ul>
          </li>

          {/* 내 학습 (로그인 했을 때만 보이게 추천) */}
          {isLoggedIn && (
            <li className={`menu-group ${openKeys.includes("my") ? "open" : ""}`}>
              <div
                className={`menu-item menu-parent ${isActive("/my") ? "active" : ""}`}
                onClick={() => toggleParent("my")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && toggleParent("my")}
              >
                <span className="menu-label">내 학습</span>
                <span className="arrow">{openKeys.includes("my") ? "▾" : "▸"}</span>
              </div>

              <ul className="submenu">
                <li
                  className={`submenu-item ${isActive("/my/attendance") ? "active" : ""}`}
                  onClick={() => go("/my/attendance")}
                >
                  출석 현황
                </li>
                <li
                  className={`submenu-item ${isActive("/my/assignments") ? "active" : ""}`}
                  onClick={() => go("/my/assignments")}
                >
                  과제
                </li>
                <li
                  className={`submenu-item ${isActive("/my/calendar") ? "active" : ""}`}
                  onClick={() => go("/my/calendar")}
                >
                  일정
                </li>
              </ul>
            </li>
          )}

          {/* 계정 */}
          <li className={`menu-group ${openKeys.includes("account") ? "open" : ""}`}>
            <div
              className={`menu-item menu-parent ${
                isActive("/mypage") || isActive("/auth") ? "active" : ""
              }`}
              onClick={() => toggleParent("account")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggleParent("account")}
            >
              <span className="menu-label">계정</span>
              <span className="arrow">{openKeys.includes("account") ? "▾" : "▸"}</span>
            </div>

            <ul className="submenu">
              {/* ✅ 로그인 상태면 마이페이지 + 로그아웃 */}
              {isLoggedIn ? (
                <>
                  <li
                    className={`submenu-item ${isActive("/mypage") ? "active" : ""}`}
                    onClick={() => go("/mypage")}
                  >
                    마이페이지
                  </li>
                  <li className="submenu-item" onClick={handleLogout}>
                    로그아웃
                  </li>
                </>
              ) : (
                // ✅ 비로그인 상태면 로그인만
                <li
                  className={`submenu-item ${isActive("/auth") ? "active" : ""}`}
                  onClick={() => go("/auth")}
                >
                  로그인
                </li>
              )}
            </ul>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default MainSideBar;
