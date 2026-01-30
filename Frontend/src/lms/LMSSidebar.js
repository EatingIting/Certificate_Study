import "./LMSSidebar.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { useMeeting } from "../webrtc/MeetingContext";
import { useLMS } from "./LMSContext";
import api from "../api/api";

const LMSSidebar = ({ activeMenu: activeMenuProp, setActiveMenu: setActiveMenuProp }) => {
    const navigate = useNavigate();
    const { subjectId } = useParams();
    let location = useLocation();

    // ✅ 회의 상태 (PiP 트리거용)
    const { isInMeeting, isPipMode, roomId, requestBrowserPip } = useMeeting();
    const { user, room } = useLMS();
    const isHost = !!(user && room && user.email && room.hostUserEmail &&
        String(user.email).trim().toLowerCase() === String(room.hostUserEmail).trim().toLowerCase());

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

        // 출석 라우트 동기화
        if (path.includes("/attendance/all")) {
        nextActive = "attendance/all";
        } else if (path.includes("/attendance")) {
        nextActive = "attendance/my";
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
    }, [location.pathname, location.search]);


    const [localActiveMenu, setLocalActiveMenu] = useState("dashboard");

    const activeMenu = activeMenuProp ?? localActiveMenu;
    const setActiveMenu = setActiveMenuProp ?? setLocalActiveMenu;

    // 브라우저 PiP 요청 (사이드바 클릭 시 자동 활성화)
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

        // 🔥 메인 발표자 찾기 (비디오 트랙이 없어도 찾기)
        const findMainPresenter = () => {
            // 1) 메인 비디오 타일 찾기 (비디오 트랙 유무와 관계없이)
            const mainVideo = document.querySelector('video[data-main-video="main"]');
            if (mainVideo) {
                const tile = mainVideo.closest(".video-tile");
                const peerId = tile?.dataset?.peerId || mainVideo?.dataset?.peerId || "";
                const peerName =
                    tile?.dataset?.peerName ||
                    mainVideo?.dataset?.peerName ||
                    tile?.querySelector(".stream-label")?.textContent ||
                    "참가자";
                return { video: mainVideo, stream: mainVideo.srcObject, peerName, peerId };
            }

            // 2) 메인 스테이지의 비디오 타일 찾기
            const mainTile = document.querySelector('.main-stage .video-tile.main, .layout-speaker .video-tile.main');
            if (mainTile) {
                const video = mainTile.querySelector('video.video-element');
                const peerId = mainTile?.dataset?.peerId || "";
                const peerName =
                    mainTile?.dataset?.peerName ||
                    mainTile?.querySelector(".stream-label")?.textContent ||
                    "참가자";
                return { video, stream: video?.srcObject, peerName, peerId };
            }

            // 3) 화면공유 우선 찾기 (비디오 트랙 있는 것만)
            const screenVideo = document.querySelector('.video-tile:not(.me) video.video-element.screen');
            if (screenVideo && screenVideo.srcObject) {
                const tracks = screenVideo.srcObject.getVideoTracks();
                if (tracks.length > 0 && tracks.some((t) => t.readyState === "live")) {
                    const tile = screenVideo.closest(".video-tile");
                    const peerId = tile?.dataset?.peerId || screenVideo?.dataset?.peerId || "";
                    const peerName =
                        tile?.dataset?.peerName ||
                        screenVideo?.dataset?.peerName ||
                        tile?.querySelector(".stream-label")?.textContent ||
                        "참가자";
                    return { video: screenVideo, stream: screenVideo.srcObject, peerName, peerId };
                }
            }

            return null;
        };

        const mainPresenter = findMainPresenter();
        if (!mainPresenter) {
            console.log('[LMSSidebar] 메인 발표자를 찾을 수 없음');
            return;
        }

        const { video, stream, peerName, peerId } = mainPresenter;
        
        // 🔥 video 요소가 없어도 메인 발표자 정보는 있으므로 PiP 실행 가능
        // requestBrowserPip에서 스트림이 없으면 아바타 스트림을 생성함
        console.log("[LMSSidebar] 브라우저 PiP 요청", { video, stream, peerName, peerId, hasStream: !!stream });
        
        // video 요소가 없으면 임시 video 요소 생성
        let videoEl = video;
        if (!videoEl) {
            videoEl = document.createElement("video");
            videoEl.style.cssText = "position:fixed; top:-9999px; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none;";
            document.body.appendChild(videoEl);
        }
        
        await requestBrowserPip(videoEl, stream, peerName, peerId);
    }, [isInMeeting, isPipMode, roomId, requestBrowserPip]);

    const toggleParent = (key) => {
        setOpenKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const navigateWithPip = async (path) => {
        if (isInMeeting) {
            await requestPipIfMeeting();
        }
        navigate(path);
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
                                        "attendance"
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
                                        "attendance/all"
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
                            {isHost === true && (
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
                            )}
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
                    if (!subjectId) return;

                    try {
                        // 서버에서 roomId + 오늘 회차 scheduleId 가져오기 (scheduleId 없어도 roomId만 있으면 입장 가능)
                        const response = await api.get(`/meeting-rooms/room-id/${subjectId}`);
                        const roomId = response.data?.roomId;
                        const scheduleId = response.data?.scheduleId ?? null;

                        if (!roomId) {
                            console.error("[LMSSidebar] roomId 없음:", response.data);
                            alert("화상 채팅방 입장에 실패했습니다. 다시 시도해주세요.");
                            return;
                        }

                        sessionStorage.setItem("lms.activeRoomId", roomId);
                        if (scheduleId != null) {
                            sessionStorage.setItem("pip.scheduleId", String(scheduleId));
                        }

                        window.dispatchEvent(new Event("meeting:request-pip"));

                        navigate(scheduleId != null
                            ? `/lms/${subjectId}/MeetingRoom/${roomId}?scheduleId=${scheduleId}`
                            : `/lms/${subjectId}/MeetingRoom/${roomId}`);
                    } catch (error) {
                        console.error("[LMSSidebar] roomId 가져오기 실패:", error);
                        alert("화상 채팅방 입장에 실패했습니다. 다시 시도해주세요.");
                    }
                }}
            >
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
