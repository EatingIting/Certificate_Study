import "./LMSSidebar.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { useMeeting } from "../webrtc/MeetingContext";
import api from "../api/api";

const LMSSidebar = ({ activeMenu: activeMenuProp, setActiveMenu: setActiveMenuProp }) => {
    const navigate = useNavigate();
    const { subjectId } = useParams();
    let location = useLocation();

    // ✅ 회의 상태 (PiP 트리거용)
    const { isInMeeting, isPipMode, roomId, requestBrowserPip } = useMeeting();

    // ✅ 초기값: 전부 열림
    let [openKeys, setOpenKeys] = useState([
        "attendance",
        "assignment",
        "board",
        "calendar",
        "study",
        "profile",
    ]);

    let studyRole = "OWNER";

    let isOwner = studyRole === "OWNER";
    let isMember = studyRole === "MEMBER";

    useEffect(() => {
        if (typeof setActiveMenu !== "function") return;

        let path = location.pathname;
        let search = location.search || "";
        let sp = new URLSearchParams(search);
        let last = path.split("/").filter(Boolean).pop();

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

        // 스터디 관리 라우트 동기화
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


    const [localActiveMenu, setLocalActiveMenu] = useState("dashboard");

    const activeMenu = activeMenuProp ?? localActiveMenu;
    const setActiveMenu = setActiveMenuProp ?? setLocalActiveMenu;

    // 🔥 브라우저 PiP 요청 (사이드바 클릭 시 자동 활성화)
    const requestPipIfMeeting = useCallback(async () => {
        // roomId가 있으면 회의 중으로 간주 (isInMeeting이 false여도)
        const hasActiveMeeting = isInMeeting || isPipMode || roomId || sessionStorage.getItem("pip.roomId");
        
        console.log("[LMSSidebar] requestPipIfMeeting 호출", { isInMeeting, isPipMode, roomId, hasActiveMeeting });
        
        if (!hasActiveMeeting) {
            console.log("[LMSSidebar] 회의 중이 아니므로 PiP 요청 안 함");
            return;
        }

        // 이미 PiP 모드면 스킵
        if (document.pictureInPictureElement) {
            console.log("[LMSSidebar] 이미 브라우저 PiP 모드임");
            return;
        }

        // 🔥 video 요소 찾기 (화면공유 우선 → 메인 → 그 외)
        const isValidVideoEl = (v) => {
            const s = v?.srcObject;
            const tracks = s?.getVideoTracks?.() ?? [];
            return !!v && !!s && tracks.length > 0 && tracks.some((t) => t.readyState === "live");
        };

        const pickFirstValid = (selector) => {
            const nodes = document.querySelectorAll(selector);
            for (const v of nodes) {
                if (isValidVideoEl(v)) return v;
            }
            return null;
        };

        const video =
            pickFirstValid('.video-tile:not(.me) video.video-element.screen') ||
            pickFirstValid('video[data-main-video="main"]') ||
            pickFirstValid('.video-tile:not(.me) video.video-element') ||
            pickFirstValid('.video-tile video.video-element');
        
        if (!video) {
            console.log('[LMSSidebar] 유효한 video 요소를 찾을 수 없음');
            return;
        }

        const stream = video.srcObject;
        if (!stream) {
            console.log('[LMSSidebar] video.srcObject가 없음');
            return;
        }
        
        const tile = video.closest(".video-tile");
        const peerId = tile?.dataset?.peerId || video?.dataset?.peerId || "";
        const peerName =
            tile?.dataset?.peerName ||
            video?.dataset?.peerName ||
            tile?.querySelector(".stream-label")?.textContent ||
            "참가자";
        
        console.log("[LMSSidebar] 브라우저 PiP 요청", { video, stream, peerName, peerId });
        await requestBrowserPip(video, stream, peerName, peerId);
    }, [isInMeeting, isPipMode, roomId, requestBrowserPip]);

    const toggleParent = (key) => {
        setOpenKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const goChild = async (parentKey, activeKey, path) => {
        setActiveMenu(activeKey);

        setOpenKeys((prev) =>
            prev.includes(parentKey) ? prev : [...prev, parentKey]
        );

        // 사이드바 클릭 이벤트 발생 (PiP 복귀 방지용)
        sessionStorage.setItem("sidebarNavigation", "true");
        window.dispatchEvent(new CustomEvent("sidebar:navigation", {
            detail: { path: `/lms/${subjectId}/${path}` }
        }));

        // 회의 중이면 자동 PiP
        await requestPipIfMeeting();

        navigate(`/lms/${subjectId}/${path}`);
    };

    const goDashboard = async () => {
        setActiveMenu("dashboard");

        // 사이드바 클릭 이벤트 발생 (PiP 복귀 방지용)
        window.dispatchEvent(new CustomEvent("sidebar:navigation", {
            detail: { path: `/lms/${subjectId}/dashboard` }
        }));

        // 회의 중이면 자동 PiP
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
                                className={`submenu-item ${activeMenu === "profile/me" ? "active" : ""}`}
                                onClick={() => goChild("profile", "profile/me", "mypage?tab=me")}
                            >
                                내정보
                            </li>
                            <li
                                className={`submenu-item ${activeMenu === "profile/settings" ? "active" : ""}`}
                                onClick={() => goChild("profile", "profile/settings", "mypage?tab=settings")}
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
                onClick={async () => {
                    if (!subjectId) {
                        console.error("[LMSSidebar] subjectId가 없습니다.");
                        return;
                    }

                    console.log("[LMSSidebar] 화상채팅방 입장 요청: subjectId=", subjectId);

                    // 최대 3번 재시도
                    const maxRetries = 3;
                    let roomId = null;

                    for (let retryCount = 0; retryCount < maxRetries && !roomId; retryCount++) {
                        try {
                            const currentAttempt = retryCount + 1;
                            console.log(`[LMSSidebar] roomId 조회 시도 ${currentAttempt}/${maxRetries}`);
                            // 백엔드에서 subjectId 기반으로 roomId를 받아옴
                            const response = await api.get(`/meeting-rooms/room-id/${subjectId}`);
                            roomId = response.data?.roomId;

                            if (roomId) {
                                console.log("[LMSSidebar] roomId 조회 성공:", roomId);
                                sessionStorage.setItem("lms.activeRoomId", roomId);
                                sessionStorage.setItem("pip.roomId", roomId);
                                sessionStorage.setItem("pip.subjectId", subjectId);
                                break;
                            } else {
                                console.warn("[LMSSidebar] roomId가 응답에 없습니다.");
                            }
                        } catch (error) {
                            const currentAttempt = retryCount + 1;
                            const errorMessage = error.response?.data?.message || error.message || "알 수 없는 오류";
                            const statusCode = error.response?.status;
                            
                            console.error(`[LMSSidebar] roomId 조회 실패 (시도 ${currentAttempt}/${maxRetries}):`, {
                                status: statusCode,
                                message: errorMessage,
                                error: error
                            });
                            
                            if (currentAttempt < maxRetries) {
                                // 재시도 전 대기
                                await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt));
                            }
                        }
                    }

                    if (!roomId) {
                        console.error("[LMSSidebar] roomId 조회 실패: 최대 재시도 횟수 초과. API 서버를 확인하세요.");
                        console.error("[LMSSidebar] 디버깅 정보:", {
                            subjectId,
                            apiBaseURL: api.defaults.baseURL,
                            token: sessionStorage.getItem("accessToken") ? "있음" : "없음",
                            protocol: window.location.protocol,
                            hostname: window.location.hostname
                        });
                        
                        const errorMsg = "화상채팅방 입장에 실패했습니다.\n\n" +
                            "가능한 원인:\n" +
                            "1. 네트워크 연결 문제\n" +
                            "2. 서버 응답 지연\n" +
                            "3. 브라우저 보안 설정\n\n" +
                            "해결 방법:\n" +
                            "- 페이지를 새로고침하세요\n" +
                            "- 브라우저 캐시를 삭제하세요\n" +
                            "- 다른 브라우저로 시도해보세요";
                        alert(errorMsg);
                        return;
                    }

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
