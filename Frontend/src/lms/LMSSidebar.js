import "./LMSSidebar.css";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useCallback } from "react";
import { useMeeting } from "../webrtc/MeetingContext";

const LMSSidebar = ({ activeMenu: activeMenuProp, setActiveMenu: setActiveMenuProp }) => {
    const navigate = useNavigate();
    const { subjectId } = useParams();

    // ✅ 회의 상태 (PiP 트리거용)
    const { isInMeeting, isPipMode, roomId } = useMeeting();

    // ✅ 초기값: 전부 열림
    const [openKeys, setOpenKeys] = useState([
        "attendance",
        "assignment",
        "board",
        "calendar",
        "profile",
    ]);

    const [localActiveMenu, setLocalActiveMenu] = useState("dashboard");

    const activeMenu = activeMenuProp ?? localActiveMenu;
    const setActiveMenu = setActiveMenuProp ?? setLocalActiveMenu;

    // 🔥 Canvas PiP 요청 (LMSSubject에서 처리)
    const requestPipIfMeeting = useCallback(() => {
        // roomId가 있으면 회의 중으로 간주 (isInMeeting이 false여도)
        const hasActiveMeeting = isInMeeting || isPipMode || roomId || sessionStorage.getItem("pip.roomId");
        
        if (!hasActiveMeeting) {
            console.log("[LMSSidebar] 회의 중이 아니므로 PiP 요청 안 함");
            return;
        }

        // 이미 PiP 모드면 스킵
        if (document.pictureInPictureElement) {
            console.log("[LMSSidebar] 이미 PiP 모드임");
            return;
        }

        const video = document.querySelector("video[data-main-video]");
        if (!video) {
            console.log("[LMSSidebar] video 요소를 찾을 수 없음");
            return;
        }

        // 🔥 Canvas PiP 요청 이벤트 발생 (LMSSubject에서 처리)
        console.log("[LMSSidebar] Canvas PiP 요청 이벤트 발생");
        window.dispatchEvent(new CustomEvent("meeting:request-canvas-pip", {
            detail: {
                video,
                peerName: video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자"
            }
        }));
    }, [isInMeeting, isPipMode, roomId]);

    // ===============================
    // 메인메뉴 클릭: 이동 X, 펼침/접힘만
    // ===============================
    const toggleParent = (key) => {
        setOpenKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    // ===============================
    // 하위 메뉴 클릭: 이동 + PiP
    // ===============================
    const goChild = async (parentKey, activeKey, path) => {
        setActiveMenu(activeKey);

        // 하위 눌렀을 때 해당 그룹은 열린 상태 유지
        setOpenKeys((prev) =>
            prev.includes(parentKey) ? prev : [...prev, parentKey]
        );

        // 사이드바 클릭 이벤트 발생 (PiP 복귀 방지용)
        sessionStorage.setItem("sidebarNavigation", "true");
        window.dispatchEvent(new CustomEvent("sidebar:navigation", {
            detail: { path: `/lms/${subjectId}/${path}` }
        }));

        // 🔥 회의 중이면 자동 PiP (user gesture 컨텍스트에서 직접 호출)
        await requestPipIfMeeting();

        navigate(`/lms/${subjectId}/${path}`);
    };

    // ===============================
    // 대시보드 단일 메뉴 이동
    // ===============================
    const goDashboard = async () => {
        setActiveMenu("dashboard");

        // 사이드바 클릭 이벤트 발생 (PiP 복귀 방지용)
        window.dispatchEvent(new CustomEvent("sidebar:navigation", {
            detail: { path: `/lms/${subjectId}/dashboard` }
        }));

        // 🔥 회의 중이면 자동 PiP (user gesture 컨텍스트에서 직접 호출)
        await requestPipIfMeeting();

        navigate(`/lms/${subjectId}/dashboard`);
    };

    return (
        <aside className="subject-sidebar">
            <div className="sb-scroll">
                <ul className="menu-list">
                    {/* 대시보드 */}
                    <li
                        className={`menu-item menu-single ${
                            activeMenu === "dashboard" ? "active" : ""
                        }`}
                        onClick={goDashboard}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && goDashboard()}
                    >
                        대시보드
                    </li>

                    {/* 출석 */}
                    <li
                        className={`menu-group ${
                            openKeys.includes("attendance") ? "open" : ""
                        }`}
                    >
                        <div
                            className={`menu-item menu-parent ${
                                activeMenu.startsWith("attendance") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("attendance")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggleParent("attendance")
                            }
                        >
                            <span className="menu-label">출석</span>
                            <span className="arrow">
                                {openKeys.includes("attendance") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${
                                    activeMenu === "attendance/my" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "attendance",
                                        "attendance/my",
                                        "attendance?scope=my"
                                    )
                                }
                            >
                                내 출석 조회
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "attendance/all" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "attendance",
                                        "attendance/all",
                                        "attendance?scope=all"
                                    )
                                }
                            >
                                전체 출석 조회
                            </li>
                        </ul>
                    </li>

                    {/* 과제 */}
                    <li
                        className={`menu-group ${
                            openKeys.includes("assignment") ? "open" : ""
                        }`}
                    >
                        <div
                            className={`menu-item menu-parent ${
                                activeMenu.startsWith("assignment") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("assignment")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggleParent("assignment")
                            }
                        >
                            <span className="menu-label">과제</span>
                            <span className="arrow">
                                {openKeys.includes("assignment") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${
                                    activeMenu === "assignment/list" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "assignment",
                                        "assignment/list",
                                        "assignment"
                                    )
                                }
                            >
                                과제 목록
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "assignment/create" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "assignment",
                                        "assignment/create",
                                        "assignment?modal=create"
                                    )
                                }
                            >
                                과제 생성하기
                            </li>
                        </ul>
                    </li>

                    {/* 게시판 */}
                    <li
                        className={`menu-group ${
                            openKeys.includes("board") ? "open" : ""
                        }`}
                    >
                        <div
                            className={`menu-item menu-parent ${
                                activeMenu.startsWith("board") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("board")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggleParent("board")
                            }
                        >
                            <span className="menu-label">게시판</span>
                            <span className="arrow">
                                {openKeys.includes("board") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${
                                    activeMenu === "board/all" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild("board", "board/all", "board")
                                }
                            >
                                전체
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "board/notice" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "board",
                                        "board/notice",
                                        "board?category=공지"
                                    )
                                }
                            >
                                공지
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "board/free" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "board",
                                        "board/free",
                                        "board?category=일반"
                                    )
                                }
                            >
                                일반
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "board/qna" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "board",
                                        "board/qna",
                                        "board?category=질문"
                                    )
                                }
                            >
                                질문
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "board/data" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "board",
                                        "board/data",
                                        "board?category=자료"
                                    )
                                }
                            >
                                자료
                            </li>
                        </ul>
                    </li>

                    {/* 일정 */}
                    <li
                        className={`menu-group ${
                            openKeys.includes("calendar") ? "open" : ""
                        }`}
                    >
                        <div
                            className={`menu-item menu-parent ${
                                activeMenu.startsWith("calendar") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("calendar")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggleParent("calendar")
                            }
                        >
                            <span className="menu-label">일정</span>
                            <span className="arrow">
                                {openKeys.includes("calendar") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${
                                    activeMenu === "calendar/list" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "calendar",
                                        "calendar/list",
                                        "calendar?view=list"
                                    )
                                }
                            >
                                일정목록
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "calendar/add" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "calendar",
                                        "calendar/add",
                                        "calendar?modal=add"
                                    )
                                }
                            >
                                일정추가
                            </li>
                        </ul>
                    </li>

                    {/* 프로필 관리 */}
                    <li
                        className={`menu-group ${
                            openKeys.includes("profile") ? "open" : ""
                        }`}
                    >
                        <div
                            className={`menu-item menu-parent ${
                                activeMenu.startsWith("profile") ? "active" : ""
                            }`}
                            onClick={() => toggleParent("profile")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggleParent("profile")
                            }
                        >
                            <span className="menu-label">프로필 관리</span>
                            <span className="arrow">
                                {openKeys.includes("profile") ? "▾" : "▸"}
                            </span>
                        </div>

                        <ul className="submenu">
                            <li
                                className={`submenu-item ${
                                    activeMenu === "profile/me" ? "active" : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "profile",
                                        "profile/me",
                                        "profile?tab=me"
                                    )
                                }
                            >
                                내정보
                            </li>
                            <li
                                className={`submenu-item ${
                                    activeMenu === "profile/settings"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    goChild(
                                        "profile",
                                        "profile/settings",
                                        "profile?tab=settings"
                                    )
                                }
                            >
                                계정 설정
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>

            {/* 화상 채팅방 입장 */}
            <button
                className="meeting-btn"
                type="button"
                onClick={() => {
                    const roomId =
                        Date.now().toString(36) +
                        Math.random().toString(36).substring(2, 6);

                    window.dispatchEvent(new Event("meeting:request-pip"));

                    navigate(`/lms/${subjectId}/MeetingRoom/${roomId}`);
                }}
            >
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
