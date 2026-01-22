import "./LMSSidebar.css";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

let LMSSidebar = ({ activeMenu, setActiveMenu }) => {
    let navigate = useNavigate();
    let { subjectId } = useParams();
    let location = useLocation();

    // ✅ 초기값: 전부 열림
    let [openKeys, setOpenKeys] = useState([
        "attendance",
        "assignment",
        "board",
        "calendar",
        "study",
        "profile",
    ]);

    /**
     * ✅ (임시) 스터디 내 내 역할
     * - 백엔드 붙이면 여기 값을 교체하면 됨.
     * - 예: "OWNER" | "MEMBER"
     */

    // let studyRole = "OWNER";
    let studyRole = "OWNER";

    let isOwner = studyRole === "OWNER";
    let isMember = studyRole === "MEMBER";

    // ✅ URL 기반으로 activeMenu 자동 동기화 (캘린더 모달/리스트 같은 케이스 포함)
    useEffect(() => {
        if (typeof setActiveMenu !== "function") return;

        let path = location.pathname;
        let search = location.search || "";
        let sp = new URLSearchParams(search);
        let last = path.split("/").filter(Boolean).pop(); // dashboard, calendar, board ...

        let nextActive = activeMenu;

        if (last === "dashboard") nextActive = "dashboard";

        if (last === "calendar") {
            if (sp.get("modal") === "add") nextActive = "calendar/add";
            else nextActive = "calendar/list";
        }

        if (last === "assignment") {
            if (sp.get("modal") === "create") nextActive = "assignment/create";
            else nextActive = "assignment/list";
        }

        if (last === "attendance") {
            if (sp.get("scope") === "all") nextActive = "attendance/all";
            else nextActive = "attendance/my";
        }

        if (last === "board") {
            let category = sp.get("category");
            if (!category) nextActive = "board/all";
            else if (category === "공지") nextActive = "board/notice";
            else if (category === "일반") nextActive = "board/free";
            else if (category === "질문") nextActive = "board/qna";
            else if (category === "자료") nextActive = "board/data";
            else nextActive = "board/all";
        }

        // ✅ 스터디 관리 라우트 동기화 (추가)
        // 예: /lms/1/study/members, /lms/1/study/leave
        if (last === "members") nextActive = "study/members";
        if (last === "leave") nextActive = "study/leave";

        if (last === "profile") {
            let tab = sp.get("tab");
            if (tab === "settings") nextActive = "profile/settings";
            else nextActive = "profile/me";
        }

        if (nextActive && nextActive !== activeMenu) {
            setActiveMenu(nextActive);

            let parentKey = nextActive.split("/")[0];
            if (parentKey && parentKey !== "dashboard") {
                setOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
            }
        }
    }, [location.pathname, location.search]); // eslint 플러그인 이슈 방지: 주석 없음

    // ✅ 상위 메뉴: 펼침/접힘만
    let toggleParent = (key) => {
        setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    // ✅ 하위 메뉴: 이동
    let goChild = (parentKey, activeKey, path) => {
        if (typeof setActiveMenu === "function") setActiveMenu(activeKey);
        setOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
        navigate(`/lms/${subjectId}/${path}`);
    };

    return (
        <aside className="subject-sidebar">
            <div className="sb-scroll">
                <ul className="menu-list">
                    {/* 대시보드 */}
                    <li
                        className={`menu-item menu-single ${activeMenu === "dashboard" ? "active" : ""}`}
                        onClick={() => {
                            if (typeof setActiveMenu === "function") setActiveMenu("dashboard");
                            navigate(`/lms/${subjectId}/dashboard`);
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

                    {/* ✅ 스터디 관리 */}
                    <li className={`menu-group ${openKeys.includes("study") ? "open" : ""}`}>
                        <div
                            className={`menu-item menu-parent ${activeMenu.startsWith("study") ? "active" : ""}`}
                            onClick={() => toggleParent("study")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && toggleParent("study")}
                        >
                            <span className="menu-label">스터디 관리</span>
                            <span className="arrow">{openKeys.includes("study") ? "▾" : "▸"}</span>
                        </div>

                        <ul className="submenu">
                            {/* 방장만 */}
                            {isOwner && (
                                <li
                                    className={`submenu-item ${activeMenu === "study/members" ? "active" : ""}`}
                                    onClick={() => goChild("study", "study/members", "study/members")}
                                >
                                    스터디원 관리
                                </li>
                            )}

                            {/* 스터디원만 (맨 아래) */}
                            {isMember && (
                                <li
                                    className={`submenu-item submen-danger ${activeMenu === "study/leave" ? "active" : ""}`}
                                    onClick={() => goChild("study", "study/leave", "study/leave")}
                                >
                                    스터디 탈퇴
                                </li>
                            )}
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

            <button className="meeting-btn" type="button" onClick={() => navigate("/meeting")}>
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
