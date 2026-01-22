import "./LMSSidebar.css";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useMeeting } from "../webrtc/MeetingContext";

const LMSSidebar = ({ activeMenu, setActiveMenu }) => {
    const { requestPipIfPossible } = useMeeting();
    const navigate = useNavigate();
    const { subjectId } = useParams();

    // ✅ 초기값: 전부 열림
    const [openKeys, setOpenKeys] = useState([
        "attendance",
        "assignment",
        "board",
        "calendar",
        "profile",
    ]);

    // ✅ 메인메뉴 클릭: 이동 X, 펼침/접힘만
    const toggleParent = (key) => {
      setOpenKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    };

    const navigateWithPip = async (path) => {
      if (isInMeeting) {
        await requestPipIfPossible();
      }
      navigate(path);
    };

    // ✅ 하위 메뉴 클릭: 이동(페이지+쿼리)
    const goChild = (parentKey, activeKey, path) => {
      setActiveMenu(activeKey);
      setOpenKeys((prev) =>
          prev.includes(parentKey) ? prev : [...prev, parentKey]
      );

      navigate(`/lms/${subjectId}/${path}`);
    };

    return (
        <aside className="subject-sidebar">
            <div className="sb-scroll">
                <ul className="menu-list">
                    {/* 대시보드(이건 이동 유지) */}
                    <li
                        className={`menu-item menu-single ${activeMenu === "dashboard" ? "active" : ""}`}
                        onClick={() => {
                            setActiveMenu("dashboard");
                            navigateWithPip(`/lms/${subjectId}/dashboard`);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/lms/${subjectId}/dashboard`)}
                    >
                        대시보드
                    </li>

                    {/* 출석 */}
                    <li className={`menu-group ${openKeys.includes("attendance") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("attendance") ? "active" : ""}`}
                            onClick={() => toggleParent("attendance")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("attendance")}
                        >
                            <span className="menu-label">출석</span>
                            <span className="arrow">{openKeys.includes("attendance") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${activeMenu === "attendance/my" ? "active" : ""}`}
                                onClick={() => goChild("attendance", "attendance/my", "attendance?scope=my")}
                            >
                                내 출석 조회
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "attendance/all" ? "active" : ""}`}
                                onClick={() => goChild("attendance", "attendance/all", "attendance?scope=all")}
                            >
                                전체 출석 조회
                            </li>
                        </ul>
                    </li>

                    {/* 과제 */}
                    <li className={`menu-group ${openKeys.includes("assignment") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("assignment") ? "active" : ""}`}
                            onClick={() => toggleParent("assignment")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("assignment")}
                        >
                            <span className="menu-label">과제</span>
                            <span className="arrow">{openKeys.includes("assignment") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${activeMenu === "assignment/list" ? "active" : ""}`}
                                onClick={() => goChild("assignment", "assignment/list", "assignment")}
                            >
                                과제 목록
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "assignment/create" ? "active" : ""}`}
                                onClick={() => goChild("assignment", "assignment/create", "assignment?modal=create")}
                            >
                                과제 생성하기
                            </li>
                        </ul>
                    </li>

                    {/* 게시판 */}
                    <li className={`menu-group ${openKeys.includes("board") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("board") ? "active" : ""}`}
                            onClick={() => toggleParent("board")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("board")}
                        >
                            <span className="menu-label">게시판</span>
                            <span className="arrow">{openKeys.includes("board") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${activeMenu === "board/all" ? "active" : ""}`}
                                onClick={() => goChild("board", "board/all", "board")}
                            >
                                전체
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "board/notice" ? "active" : ""}`}
                                onClick={() => goChild("board", "board/notice", "board?category=공지")}
                            >
                                공지
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "board/free" ? "active" : ""}`}
                                onClick={() => goChild("board", "board/free", "board?category=일반")}
                            >
                                일반
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "board/qna" ? "active" : ""}`}
                                onClick={() => goChild("board", "board/qna", "board?category=질문")}
                            >
                                질문
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "board/data" ? "active" : ""}`}
                                onClick={() => goChild("board", "board/data", "board?category=자료")}
                            >
                                자료
                            </li>
                        </ul>
                    </li>

                    {/* 일정 */}
                    <li className={`menu-group ${openKeys.includes("calendar") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("calendar") ? "active" : ""}`}
                            onClick={() => toggleParent("calendar")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("calendar")}
                        >
                            <span className="menu-label">일정</span>
                            <span className="arrow">{openKeys.includes("calendar") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${activeMenu === "calendar/list" ? "active" : ""}`}
                                onClick={() => goChild("calendar", "calendar/list", "calendar?view=list")}
                            >
                                일정목록
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "calendar/add" ? "active" : ""}`}
                                onClick={() => goChild("calendar", "calendar/add", "calendar?modal=add")}
                            >
                                일정추가
                            </li>
                        </ul>
                    </li>

                    {/* 프로필 관리 */}
                    <li className={`menu-group ${openKeys.includes("profile") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("profile") ? "active" : ""}`}
                            onClick={() => toggleParent("profile")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("profile")}
                        >
                            <span className="menu-label">프로필 관리</span>
                            <span className="arrow">{openKeys.includes("profile") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${activeMenu === "profile/me" ? "active" : ""}`}
                                onClick={() => goChild("profile", "profile/me", "profile?tab=me")}
                            >
                                내정보
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "profile/settings" ? "active" : ""}`}
                                onClick={() => goChild("profile", "profile/settings", "profile?tab=settings")}
                            >
                                계정 설정
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>

            <button 
            className="meeting-btn" 
            type="button" 
            onClick={() => {
                navigate(`/lms/${subjectId}/meeting/${subjectId}`);
            }}
            >
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
