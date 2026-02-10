import "./LMSHeader.css";
import { Bell, User, Users, Star } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLMS } from "./LMSContext";
import { useMeeting } from "../webrtc/MeetingContext";
import { useEffect, useState, useRef } from "react";
import { toWsBackendUrl } from "../utils/backendUrl";
import {
    buildLmsNotificationDedupeKey,
    clearQueuedLmsNotifications,
    enqueueLmsNotification,
    isDismissedLmsNotification,
    markAllQueuedLmsNotificationsDismissed,
    markLmsNotificationDismissed,
    markLmsNotificationsDismissedByDedupeKeys,
    readQueuedLmsNotifications,
    removeQueuedLmsNotification,
} from "../utils/lmsNotifications";
import { logout } from "../api/api";

const NOTIFICATION_LIMIT = 50;
const RECONNECT_DELAY_MS = 3000;
const LMS_NOTIFICATION_DISMISSED_UI_KEY = "lms.notification.dismissed.ui.v1";
const LMS_NOTIFICATION_QUEUE_KEY = "lms.notification.queue.v1";
const LMS_NOTIFICATION_DISMISSED_KEY = "lms.notification.dismissed.v1";

const asText = (value) => {
    if (value == null) return "";
    return String(value).trim();
};

const pickText = (...values) => {
    for (const value of values) {
        const text = asText(value);
        if (text) return text;
    }
    return "";
};

const pickId = (...values) => {
    for (const value of values) {
        if (value == null) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return "";
};

const includesAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const normalizeTextToken = (value) =>
    asText(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const buildUiFingerprint = (value) => {
    if (!value || typeof value !== "object") return "";
    const type = asText(value.type).toUpperCase();
    const roomId = pickId(value.roomId);
    const postId = pickId(value.postId);
    const commentId = pickId(value.commentId);
    const assignmentId = pickId(value.assignmentId);
    const scheduleId = pickId(value.scheduleId);

    // 타입별 구조 키를 우선 사용해서 문구 차이로 인한 중복 표시 방지
    if (type === "ASSIGNMENT" && assignmentId) {
        return ["ASSIGNMENT", roomId, assignmentId].join("|");
    }
    if (type === "SCHEDULE" && scheduleId) {
        return ["SCHEDULE", roomId, scheduleId].join("|");
    }
    if (type === "COMMENT" && (commentId || postId)) {
        return ["COMMENT", roomId, postId, commentId].join("|");
    }

    return [
        type,
        roomId,
        postId,
        commentId,
        assignmentId,
        scheduleId,
        normalizeTextToken(value.title),
        normalizeTextToken(value.message),
        normalizeTextToken(value.path),
    ].join("|");
};

const readDismissedUiFingerprints = () => {
    try {
        const raw = localStorage.getItem(LMS_NOTIFICATION_DISMISSED_UI_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((v) => asText(v)).filter(Boolean);
    } catch {
        return [];
    }
};

const writeDismissedUiFingerprints = (keys) => {
    try {
        const unique = [...new Set((keys || []).map((v) => asText(v)).filter(Boolean))];
        localStorage.setItem(LMS_NOTIFICATION_DISMISSED_UI_KEY, JSON.stringify(unique.slice(0, 1000)));
    } catch {
        // ignore storage failure
    }
};

const isDismissedUiFingerprint = (fingerprint) => {
    const key = asText(fingerprint);
    if (!key) return false;
    const set = new Set(readDismissedUiFingerprints());
    return set.has(key);
};

const markDismissedUiFingerprint = (fingerprint) => {
    const key = asText(fingerprint);
    if (!key) return;
    const keys = readDismissedUiFingerprints();
    keys.unshift(key);
    writeDismissedUiFingerprints(keys);
};

const markDismissedUiFingerprints = (fingerprints) => {
    if (!Array.isArray(fingerprints) || fingerprints.length === 0) return;
    const keys = readDismissedUiFingerprints();
    fingerprints.forEach((fp) => {
        const key = asText(fp);
        if (!key) return;
        keys.unshift(key);
    });
    writeDismissedUiFingerprints(keys);
};

const parseObjectLike = (value) => {
    if (value == null) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") return parsed;
    } catch (e) {
        // ignore parse failure
    }
    return null;
};

const expandPayloadCandidates = (rawPayload) => {
    const roots = [];
    const visited = new Set();

    const pushCandidate = (value) => {
        const parsed = parseObjectLike(value);
        if (!parsed || visited.has(parsed)) return;
        visited.add(parsed);
        roots.push(parsed);
    };

    pushCandidate(rawPayload);

    for (let i = 0; i < roots.length; i += 1) {
        const candidate = roots[i];
        pushCandidate(candidate.data);
        pushCandidate(candidate.payload);
        pushCandidate(candidate.notification);
        pushCandidate(candidate.body);
        pushCandidate(candidate.event);
        pushCandidate(candidate.result);
        pushCandidate(candidate.message);
        pushCandidate(candidate.content);
    }

    return roots;
};

const detectNotificationType = (payload) => {
    if (!payload || typeof payload !== "object") return null;

    const typeToken = [
        payload.type,
        payload.notificationType,
        payload.eventType,
        payload.notificationKind,
        payload.category,
        payload.kind,
        payload.targetType,
    ]
        .map((v) => asText(v).toUpperCase())
        .filter(Boolean)
        .join("_");

    if (typeToken.includes("COMMENT")) return "COMMENT";
    if (typeToken.includes("ASSIGN")) return "ASSIGNMENT";
    if (typeToken.includes("SCHEDULE") || typeToken.includes("CALENDAR") || typeToken.includes("STUDY")) return "SCHEDULE";

    if (pickId(payload.postId, payload.boardPostId, payload.articleId)) return "COMMENT";
    if (pickId(payload.assignmentId, payload.taskId, payload.homeworkId)) return "ASSIGNMENT";
    if (pickId(payload.scheduleId, payload.calendarId, payload.studyScheduleId)) return "SCHEDULE";

    const guessText = [
        payload.title,
        payload.subject,
        payload.message,
        payload.content,
        payload.path,
        payload.url,
        payload.link,
    ]
        .map((v) => asText(v).toLowerCase())
        .join(" ");

    if (includesAny(guessText, ["comment", "reply", "댓글"])) return "COMMENT";
    if (includesAny(guessText, ["assignment", "homework", "task", "과제", "숙제"])) return "ASSIGNMENT";
    if (includesAny(guessText, ["schedule", "calendar", "일정", "스케줄", "회차", "스터디 일정", "스터디일정"])) return "SCHEDULE";

    return null;
};

const parseNotificationFromSource = (source) => {
    const type = detectNotificationType(source);
    if (!type) return null;

    const roomId = pickId(
        source.roomId,
        source.subjectId,
        source.classId,
        source.targetRoomId,
        source.room?.roomId,
        source.room?.id
    );
    const postId = pickId(source.postId, source.boardPostId, source.articleId);
    const commentId = pickId(source.commentId, source.replyId, source.targetCommentId);
    const assignmentId = pickId(source.assignmentId, source.taskId, source.homeworkId);
    const scheduleId = pickId(source.scheduleId, source.calendarId, source.studyScheduleId);
    const path = pickText(source.path, source.url, source.link, source.targetPath);

    let title = "";
    let message = "";

    if (type === "COMMENT") {
        title = pickText(source.postTitle, source.title, source.subject, "댓글 알림");
        message = pickText(source.content, source.message, source.comment, source.notificationMessage, "새 댓글이 등록되었습니다.");
    } else if (type === "ASSIGNMENT") {
        title = pickText(source.assignmentTitle, source.title, source.subject, "과제 알림");
        message = pickText(source.content, source.message, source.description, source.notificationMessage, "새 과제가 등록되었습니다.");
    } else if (type === "SCHEDULE") {
        title = pickText(source.scheduleTitle, source.title, source.subject, "일정 알림");
        message = pickText(source.content, source.message, source.description, source.notificationMessage, "새 일정이 등록되었습니다.");
    }

    const dedupeKey = buildLmsNotificationDedupeKey(source);
    const uiFingerprint = buildUiFingerprint({
        type,
        roomId,
        postId,
        commentId,
        assignmentId,
        scheduleId,
        title,
        message,
        path,
    });

    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dedupeKey,
        uiFingerprint,
        type,
        roomId,
        postId,
        commentId,
        assignmentId,
        scheduleId,
        title,
        message,
        path,
    };
};

const parseNotification = (rawPayload) => {
    const candidates = expandPayloadCandidates(rawPayload);

    for (const candidate of candidates) {
        const merged = { ...(rawPayload || {}), ...(candidate || {}) };
        const parsed = parseNotificationFromSource(merged);
        if (parsed) return parsed;
    }

    return null;
};

const appendNotification = (prev, next) => {
    if (next.dedupeKey && isDismissedLmsNotification(next.dedupeKey)) return prev;
    if (next.uiFingerprint && isDismissedUiFingerprint(next.uiFingerprint)) return prev;

    const hasSameItem = prev.some((item) => {
        if (item.dedupeKey && next.dedupeKey && item.dedupeKey === next.dedupeKey) return true;
        if (item.uiFingerprint && next.uiFingerprint && item.uiFingerprint === next.uiFingerprint) return true;
        return false;
    });
    if (hasSameItem) return prev;
    return [next, ...prev].slice(0, NOTIFICATION_LIMIT);
};

const typeLabel = (type) => {
    if (type === "COMMENT") return "[댓글]";
    if (type === "ASSIGNMENT") return "[과제]";
    if (type === "SCHEDULE") return "[일정]";
    return "[알림]";
};

export default function Header() {
    const { displayName, loading, roomTitle, roomLoading, user, room } = useLMS();
    const { isInMeeting } = useMeeting();
    const navigate = useNavigate();
    const location = useLocation();

    const isHost =
        !!(
            user &&
            room &&
            user.email &&
            room.hostUserEmail &&
            String(user.email).trim().toLowerCase() ===
            String(room.hostUserEmail).trim().toLowerCase()
        );

    const [notifications, setNotifications] = useState([]);
    const [openNotifDropdown, setOpenNotifDropdown] = useState(false);
    const [openProfileDropdown, setOpenProfileDropdown] = useState(false);
    const notifDropdownRef = useRef(null);
    const profileDropdownRef = useRef(null);

    const userId = sessionStorage.getItem("userId");

    const syncQueuedNotifications = () => {
        const queuedPayloads = readQueuedLmsNotifications();
        if (!queuedPayloads.length) return;

        setNotifications((prev) => {
            let next = prev;
            queuedPayloads.forEach((rawPayload) => {
                const notif = parseNotification(rawPayload);
                if (!notif) return;
                next = appendNotification(next, notif);
            });
            return next;
        });
    };

    useEffect(() => {
        syncQueuedNotifications();
    }, []);

    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === LMS_NOTIFICATION_QUEUE_KEY) {
                syncQueuedNotifications();
                return;
            }
            if (e.key === LMS_NOTIFICATION_DISMISSED_KEY || e.key === LMS_NOTIFICATION_DISMISSED_UI_KEY) {
                setNotifications((prev) =>
                    prev.filter((n) => {
                        if (n?.dedupeKey && isDismissedLmsNotification(n.dedupeKey)) return false;
                        if (n?.uiFingerprint && isDismissedUiFingerprint(n.uiFingerprint)) return false;
                        return true;
                    })
                );
            }
        };
        const handleVisibility = () => {
            if (document.visibilityState !== "visible") return;
            syncQueuedNotifications();
        };

        window.addEventListener("storage", handleStorage);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("storage", handleStorage);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);

    useEffect(() => {
        if (!userId) return;

        const wsPaths = [`/ws/comment/${userId}`, `/ws/notification/${userId}`];
        const reconnectTimers = [];
        const sockets = new Set();
        let isActive = true;

        const connect = (path) => {
            const wsUrl = toWsBackendUrl(path);
            const socket = new WebSocket(wsUrl);
            sockets.add(socket);

            socket.onopen = () => {
                console.log("알림 WebSocket 연결 성공:", wsUrl);
            };

            socket.onmessage = (event) => {
                let payload = null;
                try {
                    payload = JSON.parse(event.data);
                } catch (e) {
                    payload = { message: String(event.data || "") };
                }

                const notif = parseNotification(payload);
                if (!notif) {
                    console.log("알림 파싱 스킵:", payload);
                    return;
                }

                if (
                    (notif.dedupeKey && isDismissedLmsNotification(notif.dedupeKey)) ||
                    (notif.uiFingerprint && isDismissedUiFingerprint(notif.uiFingerprint))
                ) {
                    return;
                }

                enqueueLmsNotification(payload);
                setNotifications((prev) => appendNotification(prev, notif));
            };

            socket.onerror = (e) => {
                console.log("알림 WebSocket 오류:", wsUrl, e);
            };

            socket.onclose = () => {
                console.log("알림 WebSocket 종료:", wsUrl);
                sockets.delete(socket);
                if (!isActive) return;

                const timer = setTimeout(() => {
                    connect(path);
                }, RECONNECT_DELAY_MS);
                reconnectTimers.push(timer);
            };

            return socket;
        };

        wsPaths.forEach((path) => connect(path));

        return () => {
            isActive = false;
            reconnectTimers.forEach((timer) => clearTimeout(timer));
            sockets.forEach((socket) => {
                try {
                    socket.close();
                } catch (e) {
                    // ignore socket close errors
                }
            });
        };
    }, [userId]);

    useEffect(() => {
        const handleOutside = (e) => {
            if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
                setOpenNotifDropdown(false);
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
                setOpenProfileDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const handleClickNotification = (notif) => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        markLmsNotificationDismissed(notif.dedupeKey);
        markDismissedUiFingerprint(notif.uiFingerprint);
        removeQueuedLmsNotification(notif.dedupeKey);
        setOpenNotifDropdown(false);

        const targetRoomId = notif.roomId || pickId(room?.roomId);
        const commentPostId = pickId(notif.postId);

        if (notif.type === "COMMENT" && targetRoomId && commentPostId) {
            const targetPath = `/lms/${targetRoomId}/board/${commentPostId}`;
            window.dispatchEvent(
                new CustomEvent("lms:board-comment-notification", {
                    detail: { roomId: String(targetRoomId), postId: String(commentPostId) },
                })
            );

            if (location.pathname !== targetPath) {
                navigate(targetPath);
            }
            return;
        }

        if (notif.type === "ASSIGNMENT" && targetRoomId && notif.assignmentId) {
            navigate(`/lms/${targetRoomId}/assignment/${notif.assignmentId}`);
            return;
        }

        if (notif.path && notif.path.startsWith("/")) {
            navigate(notif.path);
            return;
        }

        if (!targetRoomId) return;

        if (notif.type === "COMMENT") {
            navigate(`/lms/${targetRoomId}/board`);
            return;
        }

        if (notif.type === "ASSIGNMENT") {
            navigate(`/lms/${targetRoomId}/assignment`);
            return;
        }

        if (notif.type === "SCHEDULE") {
            navigate(`/lms/${targetRoomId}/calendar`);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            // ignore client-side logout failure
        } finally {
            setOpenProfileDropdown(false);
            window.location.replace("/auth");
        }
    };

    const handleClearNotifications = (e) => {
        e.stopPropagation();
        markLmsNotificationsDismissedByDedupeKeys(notifications.map((n) => n.dedupeKey));
        markDismissedUiFingerprints(notifications.map((n) => n.uiFingerprint));
        markAllQueuedLmsNotificationsDismissed();
        setNotifications([]);
        clearQueuedLmsNotifications();
    };

    return (
        <header className="lms-header">
            <div className="lms-header-left">
                <div className="logo-box">
                    <img src="/favicon.ico" alt="ONSIL" className="logo-icon" />
                </div>

                <div className="lms-header-text">
                    <span className="title">
                        {roomLoading ? "로딩 중..." : roomTitle || "undefined"}
                    </span>

                    <p>
                        {loading
                            ? "로딩 중..."
                            : displayName
                                ? `${displayName}님 환영합니다!`
                                : "사용자님 환영합니다!"}
                    </p>
                </div>
            </div>

            <div className="lms-header-right">
                {isHost && (
                    <div className="host-badge">
                        <Star size={18} fill="#fbbf24" color="#fbbf24" />
                        <span className="host-text">스터디장</span>
                    </div>
                )}
                <Users
                    size={18}
                    className="icon-button"
                    onClick={() => {
                        // 회의 중이면 먼저 퇴장(WS/SFU 끊기) 후 이동 → 상대방 화면에서 내 타일 즉시 제거
                        if (isInMeeting) {
                            window.dispatchEvent(new CustomEvent("meeting:leave-and-navigate", { detail: { path: "/room" } }));
                        } else {
                            navigate("/room");
                        }
                    }}
                />

                <div
                    className="notif-wrapper"
                    ref={notifDropdownRef}
                    onClick={() => setOpenNotifDropdown((prev) => !prev)}
                >
                    <Bell size={18} />

                    {notifications.length > 0 && (
                        <span className="notif-badge">{notifications.length}</span>
                    )}

                    {openNotifDropdown && (
                        <div className="notif-dropdown">
                            <div className="notif-title-row">
                                <h4 className="notif-title">알림</h4>
                                {notifications.length > 0 && (
                                    <button
                                        type="button"
                                        className="notif-clear-btn"
                                        onClick={handleClearNotifications}
                                    >
                                        모두 지우기
                                    </button>
                                )}
                            </div>

                            {notifications.length === 0 ? (
                                <p className="notif-empty">새로운 알림이 없습니다.</p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className="notif-item"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClickNotification(n);
                                        }}
                                    >
                                        <strong>{`${typeLabel(n.type)} ${n.title}`}</strong>
                                        <p>
                                            {n.message.length > 30
                                                ? n.message.slice(0, 30) + "..."
                                                : n.message}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="profile-wrapper" ref={profileDropdownRef}>
                    <div
                        className="profile"
                        onClick={() => setOpenProfileDropdown((prev) => !prev)}
                    >
                        <User size={18} />
                    </div>

                    {openProfileDropdown && (
                        <div className="profile-dropdown">
                            <button
                                type="button"
                                className="profile-dropdown-item"
                                onClick={handleLogout}
                            >
                                로그아웃
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
