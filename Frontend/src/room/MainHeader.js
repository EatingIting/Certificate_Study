import "./MainHeader.css";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import MainSideBar from "./MainSideBar";
import { useEffect, useRef, useState } from "react";
import { FaBell } from "react-icons/fa";
import { toWsBackendUrl } from "../utils/backendUrl";
import api, { logout } from "../api/api";
import { enqueueLmsNotification, isLmsNotificationPayload } from "../utils/lmsNotifications";

const MAIN_NOTIF_PENDING_KEY_PREFIX = "main.notification.pending.v1.";
const MAIN_NOTIF_SEEN_RECEIVED_KEY_PREFIX = "main.notification.seen.received.v1.";
const MAIN_NOTIF_SEEN_SENT_KEY_PREFIX = "main.notification.seen.sent.v1.";

const hasText = (value) => value != null && String(value).trim() !== "";

const toJoinId = (item) => {
    const id = item?.joinId;
    return hasText(id) ? String(id).trim() : "";
};

const normalizeStatus = (status) => String(status || "").trim().toUpperCase();

const isDecisionStatus = (status) => {
    const token = normalizeStatus(status);
    if (!token) return false;

    if (token.includes("APPROV") || token.includes("REJECT") || token.includes("DENY")) {
        return true;
    }
    if (token.includes("승인") || token.includes("거절") || token.includes("반려")) {
        return true;
    }
    return false;
};

const getPendingKey = (userId) => `${MAIN_NOTIF_PENDING_KEY_PREFIX}${userId}`;
const getSeenReceivedKey = (userId) => `${MAIN_NOTIF_SEEN_RECEIVED_KEY_PREFIX}${userId}`;
const getSeenSentKey = (userId) => `${MAIN_NOTIF_SEEN_SENT_KEY_PREFIX}${userId}`;

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (e) {
        return fallback;
    }
};

const writeJson = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // ignore storage failure
    }
};

const readSeenIds = (key) => {
    const list = readJson(key, []);
    if (!Array.isArray(list)) return [];
    return list.map((id) => String(id).trim()).filter(Boolean);
};

const writeSeenIds = (key, ids) => {
    const unique = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
    writeJson(key, unique);
};

const readPendingNotification = (userId) => readJson(getPendingKey(userId), null);

const writePendingNotification = (userId, pending) => {
    if (!userId || !pending || !pending.hasNotification) return;
    writeJson(getPendingKey(userId), {
        hasNotification: true,
        targetTab: pending.targetTab || "received",
        updatedAt: Date.now(),
    });
};

const clearPendingNotification = (userId) => {
    if (!userId) return;
    try {
        localStorage.removeItem(getPendingKey(userId));
    } catch (e) {
        // ignore storage failure
    }
};

const getNotificationIntent = (payload) => {
    if (!payload || typeof payload !== "object") {
        return { shouldShowDot: false, targetTab: null };
    }

    if (isLmsNotificationPayload(payload)) {
        return { shouldShowDot: false, targetTab: null };
    }

    const type = String(payload.type || "").toUpperCase();
    const notificationType = String(payload.notificationType || "").toUpperCase();
    const status = String(payload.status || "").toUpperCase();
    const message = String(payload.message || payload.content || "").toUpperCase();

    const isApproved =
        type.includes("APPROV") ||
        status.includes("APPROV") ||
        message.includes("승인".toUpperCase()) ||
        message.includes("APPROV");

    const isRejected =
        type.includes("REJECT") ||
        status.includes("REJECT") ||
        type.includes("DENY") ||
        status.includes("DENY") ||
        message.includes("거절".toUpperCase()) ||
        message.includes("반려".toUpperCase()) ||
        message.includes("REJECT") ||
        message.includes("DENY");

    const isDecision = isApproved || isRejected;
    const isApplication =
        notificationType.includes("APPLICATION") ||
        message.includes("신청".toUpperCase());

    const shouldShowDot =
        type === "NOTIFICATION" ||
        isApplication ||
        isDecision;

    let targetTab = null;
    if (isDecision) {
        targetTab = "sent";
    } else if (isApplication) {
        targetTab = "received";
    }

    return { shouldShowDot, targetTab };
};

const MainHeader = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const [nickname, setNickname] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [searchText, setSearchText] = useState("");

    const [hasNotification, setHasNotification] = useState(false);
    const [latestJoinId, setLatestJoinId] = useState(null);
    const [notificationTargetTab, setNotificationTargetTab] = useState("received");
    const [knownReceivedJoinIds, setKnownReceivedJoinIds] = useState([]);
    const [knownSentDecisionJoinIds, setKnownSentDecisionJoinIds] = useState([]);
    const notificationTargetTabRef = useRef("received");

    const userId = sessionStorage.getItem("userId");

    useEffect(() => {
        setNickname(sessionStorage.getItem("nickname"));
    }, [pathname]);

    useEffect(() => {
        notificationTargetTabRef.current = notificationTargetTab || "received";
    }, [notificationTargetTab]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchApplicationSnapshot = async () => {
        const [receivedRes, sentRes] = await Promise.all([
            api.get("/applications/received"),
            api.get("/applications/sent"),
        ]);

        const received = Array.isArray(receivedRes?.data) ? receivedRes.data : [];
        const sent = Array.isArray(sentRes?.data) ? sentRes.data : [];

        const receivedIds = received.map(toJoinId).filter(Boolean);
        const sentIds = sent.map(toJoinId).filter(Boolean);
        const sentDecisionIds = sent
            .filter((item) => isDecisionStatus(item?.status))
            .map(toJoinId)
            .filter(Boolean);

        return { receivedIds, sentIds, sentDecisionIds };
    };

    const evaluateNotificationState = useRef(async () => { });
    evaluateNotificationState.current = async () => {
        if (!userId) return;
        try {
            const { receivedIds, sentIds, sentDecisionIds } = await fetchApplicationSnapshot();

            setKnownReceivedJoinIds(receivedIds);
            setKnownSentDecisionJoinIds(sentIds);
            setLatestJoinId(receivedIds[0] || sentIds[0] || null);

            const seenReceived = new Set(readSeenIds(getSeenReceivedKey(userId)));
            const seenSent = new Set(readSeenIds(getSeenSentKey(userId)));

            const hasUnseenSentDecision = sentDecisionIds.some((id) => !seenSent.has(id));
            const hasUnseenSent = sentIds.some((id) => !seenSent.has(id));
            const hasUnseenReceived = receivedIds.some((id) => !seenReceived.has(id));

            if (hasUnseenSent || hasUnseenReceived) {
                const targetTab = (hasUnseenSentDecision || hasUnseenSent) ? "sent" : "received";
                setHasNotification(true);
                setNotificationTargetTab(targetTab);
                writePendingNotification(userId, { hasNotification: true, targetTab });
            } else {
                setHasNotification(false);
                clearPendingNotification(userId);
            }
        } catch (e) {
            // ignore bootstrap failure
        }
    };

    useEffect(() => {
        if (!nickname || !userId) return;

        const pending = readPendingNotification(userId);
        if (pending?.hasNotification) {
            setHasNotification(true);
            setNotificationTargetTab(pending.targetTab || "received");
        }

        evaluateNotificationState.current();
    }, [nickname, userId]);

    useEffect(() => {
        if (!nickname || !userId) return;

        const socket = new WebSocket(
            toWsBackendUrl(`/ws/notification/${userId}`)
        );

        socket.onmessage = (event) => {
            let data = null;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                data = { message: String(event.data || "") };
            }

            if (isLmsNotificationPayload(data)) {
                enqueueLmsNotification(data);
                return;
            }

            const { shouldShowDot, targetTab } = getNotificationIntent(data);
            if (shouldShowDot) {
                setHasNotification(true);
                writePendingNotification(userId, {
                    hasNotification: true,
                    targetTab: targetTab || notificationTargetTabRef.current || "received",
                });
            }
            if (targetTab) {
                setNotificationTargetTab(targetTab);
            }

            // 서버 payload 형태가 달라도 API 스냅샷으로 최종 상태를 맞춘다.
            evaluateNotificationState.current();
        };

        return () => socket.close();
    }, [nickname, userId]);

    useEffect(() => {
        if (!nickname || !userId) return;

        const handleApplicationsChanged = () => {
            evaluateNotificationState.current();
        };

        window.addEventListener("room:applications-changed", handleApplicationsChanged);
        return () => window.removeEventListener("room:applications-changed", handleApplicationsChanged);
    }, [nickname, userId]);

    useEffect(() => {
        if (!nickname || !userId) return;
        const timer = setInterval(() => {
            evaluateNotificationState.current();
        }, 10000);
        return () => clearInterval(timer);
    }, [nickname, userId]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            // ignore client-side logout failure
        }

        setIsOpen(false);
        setNickname(null);
        setHasNotification(false);
        setLatestJoinId(null);
        setNotificationTargetTab("received");
        setKnownReceivedJoinIds([]);
        setKnownSentDecisionJoinIds([]);
        window.location.replace("/");
    };

    return (
        <div className="page">
            <header className="header sample-container">
                <div className="logo" onClick={() => navigate("/")}>
                    ONSIL
                </div>

                <div className="search-box">
                    <input
                        placeholder="어떤 스터디를 찾고 있나요?"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                navigate(`/room?keyword=${searchText}`);
                                setSearchText("");
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            navigate(`/room?keyword=${searchText}`);
                            setSearchText("");
                        }}
                    >
                        스터디 검색
                    </button>
                </div>

                <div className="main-actions">
                    {nickname ? (
                        <div className="profile-wrapper" ref={dropdownRef}>
                            <div
                                className="notif-icon"
                                onClick={async () => {
                                    let latestId = latestJoinId;
                                    if (userId) {
                                        let receivedIds = knownReceivedJoinIds;
                                        let sentDecisionIds = knownSentDecisionJoinIds;

                                        try {
                                            const snapshot = await fetchApplicationSnapshot();
                                            receivedIds = snapshot.receivedIds;
                                            sentDecisionIds = snapshot.sentIds;
                                            setKnownReceivedJoinIds(receivedIds);
                                            setKnownSentDecisionJoinIds(sentDecisionIds);
                                            latestId = receivedIds[0] || sentDecisionIds[0] || null;
                                            setLatestJoinId(latestId);
                                        } catch (e) {
                                            // fallback to cached ids
                                        }

                                        writeSeenIds(getSeenReceivedKey(userId), receivedIds);
                                        writeSeenIds(getSeenSentKey(userId), sentDecisionIds);
                                        clearPendingNotification(userId);
                                    }

                                    if (latestId) {
                                        localStorage.setItem(
                                            "lastCheckedJoinId",
                                            latestId
                                        );
                                    }

                                    setHasNotification(false);
                                    const targetTab = notificationTargetTab || "received";

                                    navigate("/room/my-applications", {
                                        state: {
                                            tab: targetTab,
                                            refreshAt: Date.now(),
                                        },
                                    });
                                }}
                            >
                                <FaBell size={18} />
                                {hasNotification && (
                                    <span className="notif-dot"></span>
                                )}
                            </div>

                            <span
                                className="header-nickname clickable"
                                onClick={() => setIsOpen((prev) => !prev)}
                            >
                                {nickname} 님
                            </span>

                            {isOpen && (
                                <div className="dropdown">
                                    <div className="dropdown-header">
                                        {nickname}
                                    </div>

                                    <ul>
                                        <li onClick={() => navigate("/room/mypage")}>
                                            내 프로필 보기
                                        </li>
                                        <li onClick={() => navigate("/room/mystudy")}>
                                            내 클래스룸
                                        </li>
                                        <li onClick={() => navigate("/room/create")}>
                                            스터디 만들기
                                        </li>
                                    </ul>

                                    <div
                                        className="dropdown-footer"
                                        onClick={handleLogout}
                                    >
                                        로그아웃
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            className="login-btn"
                            onClick={() => navigate("/auth")}
                        >
                            로그인
                        </button>
                    )}
                </div>
            </header>

            {pathname.startsWith("/room") ? (
                <div className="sample-container sample-layout">
                    <MainSideBar />
                    <main className="sample-content">
                        <Outlet />
                    </main>
                </div>
            ) : (
                <Outlet />
            )}
        </div>
    );
};

export default MainHeader;
