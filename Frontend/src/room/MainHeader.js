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
const RECONNECT_DELAY_MS = 3000;

const hasText = (value) => value != null && String(value).trim() !== "";

const toJoinId = (item) => {
    const id = item?.joinId;
    return hasText(id) ? String(id).trim() : "";
};

const pickJoinIdFromPayload = (payload) => {
    if (!payload || typeof payload !== "object") return "";
    const direct = [
        payload.joinId,
        payload.id,
        payload.applicationId,
        payload.requestId,
        payload.targetId,
        payload.data?.joinId,
        payload.data?.id,
        payload.payload?.joinId,
        payload.payload?.id,
        payload.notification?.joinId,
        payload.notification?.id,
    ];
    for (const value of direct) {
        if (!hasText(value)) continue;
        return String(value).trim();
    }
    return "";
};

const normalizeStatus = (status) => String(status || "").trim().toUpperCase();

const normalizeDateToken = (value) => {
    if (!hasText(value)) return "";

    const raw = String(value).trim();
    const parsedDate = new Date(raw);
    if (Number.isNaN(parsedDate.getTime())) {
        return raw;
    }
    return parsedDate.toISOString();
};

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

const buildReceivedSeenToken = (item) => {
    const joinId = toJoinId(item);
    if (!joinId) return "";

    const requestedAt = normalizeDateToken(
        item?.requestedAt || item?.updatedAt || item?.createdAt
    );
    return `RECEIVED|${joinId}|${requestedAt}`;
};

const buildSentDecisionSeenToken = (item) => {
    const joinId = toJoinId(item);
    if (!joinId) return "";

    const status = normalizeStatus(item?.status);
    const requestedAt = normalizeDateToken(
        item?.requestedAt || item?.updatedAt || item?.createdAt
    );
    return `SENT|${joinId}|${status}|${requestedAt}`;
};

const extractJoinIdFromSeenToken = (token) => {
    const text = String(token || "").trim();
    if (!text) return "";

    const parts = text.split("|");
    if (
        parts.length >= 2 &&
        (parts[0] === "RECEIVED" || parts[0] === "SENT")
    ) {
        return String(parts[1] || "").trim();
    }

    // 구버전(단순 joinId 저장) 호환
    return text;
};

const hasSeenToken = (seenSet, token) => {
    if (!token) return true;
    if (seenSet.has(token)) return true;

    const joinId = extractJoinIdFromSeenToken(token);
    if (!joinId) return false;
    return seenSet.has(joinId);
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

const extractNotificationId = (payload) => {
    if (!payload || typeof payload !== "object") return "";

    const candidates = [
        payload.notificationId,
        payload?.data?.notificationId,
        payload?.payload?.notificationId,
        payload?.notification?.notificationId,
    ];

    for (const candidate of candidates) {
        if (!hasText(candidate)) continue;
        return String(candidate).trim();
    }
    return "";
};

const sendNotificationAck = (socket, notificationId) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!hasText(notificationId)) return;

    try {
        socket.send(
            JSON.stringify({
                type: "ACK",
                notificationId: String(notificationId).trim(),
            })
        );
    } catch (e) {
        // ignore ack failure
    }
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
    const [knownReceivedSeenTokens, setKnownReceivedSeenTokens] = useState([]);
    const [knownSentDecisionSeenTokens, setKnownSentDecisionSeenTokens] = useState([]);
    const evaluationVersionRef = useRef(0);

    const userId = sessionStorage.getItem("userId");

    useEffect(() => {
        setNickname(sessionStorage.getItem("nickname"));
    }, [pathname]);

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

        const sentDecisionItems = sent.filter((item) =>
            isDecisionStatus(item?.status)
        );

        const receivedSeenTokens = received
            .map(buildReceivedSeenToken)
            .filter(Boolean);
        const sentDecisionSeenTokens = sentDecisionItems
            .map(buildSentDecisionSeenToken)
            .filter(Boolean);

        const latestJoinId =
            toJoinId(received[0]) || toJoinId(sentDecisionItems[0]) || null;

        return { receivedSeenTokens, sentDecisionSeenTokens, latestJoinId };
    };

    const evaluateNotificationState = useRef(async () => { });
    evaluateNotificationState.current = async () => {
        if (!userId) return;
        const version = ++evaluationVersionRef.current;

        try {
            const {
                receivedSeenTokens,
                sentDecisionSeenTokens,
                latestJoinId: snapshotLatestJoinId,
            } = await fetchApplicationSnapshot();

            if (version !== evaluationVersionRef.current) return;

            setKnownReceivedSeenTokens(receivedSeenTokens);
            setKnownSentDecisionSeenTokens(sentDecisionSeenTokens);
            setLatestJoinId(snapshotLatestJoinId);

            const seenReceived = new Set(readSeenIds(getSeenReceivedKey(userId)));
            const seenSent = new Set(readSeenIds(getSeenSentKey(userId)));

            const hasUnseenSentDecision = sentDecisionSeenTokens.some(
                (token) => !hasSeenToken(seenSent, token)
            );
            const hasUnseenReceived = receivedSeenTokens.some(
                (token) => !hasSeenToken(seenReceived, token)
            );

            if (hasUnseenSentDecision || hasUnseenReceived) {
                const targetTab = hasUnseenSentDecision ? "sent" : "received";
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
        let socket = null;
        let reconnectTimer = null;
        let isActive = true;

        const connect = () => {
            if (!isActive) return;

            socket = new WebSocket(toWsBackendUrl(`/ws/notification/${userId}`));

            socket.onmessage = (event) => {
                let data = null;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    data = { message: String(event.data || "") };
                }

                const notificationId = extractNotificationId(data);
                if (notificationId) {
                    sendNotificationAck(socket, notificationId);
                }

                if (
                    isLmsNotificationPayload(data) ||
                    isLmsNotificationPayload(event.data) ||
                    isLmsNotificationPayload(data?.data) ||
                    isLmsNotificationPayload(data?.payload)
                ) {
                    enqueueLmsNotification(data);
                    return;
                }

            const { shouldShowDot, targetTab } = getNotificationIntent(data);
            const joinId = pickJoinIdFromPayload(data);
            let canShowImmediateDot = false;
            if (shouldShowDot && joinId && userId) {
                const target = targetTab || notificationTargetTabRef.current || "received";
                const seenKey = target === "sent" ? getSeenSentKey(userId) : getSeenReceivedKey(userId);
                const seenSet = new Set(readSeenIds(seenKey));
                canShowImmediateDot = !seenSet.has(joinId);
            }

            // joinId가 확인되는 알림만 즉시 점등하고,
            // 나머지는 evaluateNotificationState 결과를 따르도록 하여
            // 이미 읽은 알림이 반복 점등되는 현상을 방지
            if (canShowImmediateDot) {
                setHasNotification(true);
                writePendingNotification(userId, {
                    hasNotification: true,
                    targetTab: targetTab || notificationTargetTabRef.current || "received",
                });
            }
            if (targetTab) {
                setNotificationTargetTab(targetTab);
            }

                if (shouldShowDot || targetTab) {
                    // 점 표시는 스냅샷 결과만 신뢰해 false positive(봤는데 다시 뜨는 현상)를 줄인다.
                    evaluateNotificationState.current();
                }
            };

            socket.onclose = () => {
                if (!isActive) return;
                reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
            };
        };

        connect();

        return () => {
            isActive = false;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            try {
                if (socket) socket.close();
            } catch (e) {
                // ignore socket close failure
            }
        };
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

    useEffect(() => {
        if (!nickname || !userId) return;
        if (pathname !== "/room/my-applications") return;

        let cancelled = false;
        (async () => {
            try {
                const {
                    receivedSeenTokens,
                    sentDecisionSeenTokens,
                    latestJoinId: snapshotLatestJoinId,
                } = await fetchApplicationSnapshot();

                if (cancelled) return;

                setKnownReceivedSeenTokens(receivedSeenTokens);
                setKnownSentDecisionSeenTokens(sentDecisionSeenTokens);
                setLatestJoinId(snapshotLatestJoinId);

                writeSeenIds(getSeenReceivedKey(userId), receivedSeenTokens);
                writeSeenIds(getSeenSentKey(userId), sentDecisionSeenTokens);
                clearPendingNotification(userId);
                setHasNotification(false);
            } catch (e) {
                // ignore auto-seen failure
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [nickname, pathname, userId]);

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
        setKnownReceivedSeenTokens([]);
        setKnownSentDecisionSeenTokens([]);
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
                                        let receivedSeenTokens = knownReceivedSeenTokens;
                                        let sentDecisionSeenTokens = knownSentDecisionSeenTokens;

                                        try {
                                            const snapshot = await fetchApplicationSnapshot();
                                            receivedSeenTokens = snapshot.receivedSeenTokens;
                                            sentDecisionSeenTokens = snapshot.sentDecisionSeenTokens;
                                            setKnownReceivedSeenTokens(receivedSeenTokens);
                                            setKnownSentDecisionSeenTokens(sentDecisionSeenTokens);
                                            latestId = snapshot.latestJoinId || null;
                                            setLatestJoinId(latestId);
                                        } catch (e) {
                                            // fallback to cached tokens
                                        }

                                        writeSeenIds(getSeenReceivedKey(userId), receivedSeenTokens);
                                        writeSeenIds(getSeenSentKey(userId), sentDecisionSeenTokens);
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
                                    evaluateNotificationState.current();

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
