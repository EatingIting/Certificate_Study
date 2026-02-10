const LMS_NOTIFICATION_QUEUE_KEY = "lms.notification.queue.v1";
const MAX_QUEUED_LMS_NOTIFICATIONS = 100;
const LMS_NOTIFICATION_DISMISSED_KEY = "lms.notification.dismissed.v1";
const MAX_DISMISSED_LMS_NOTIFICATIONS = 500;

const asText = (value) => {
    if (value == null) return "";
    return String(value).trim();
};

const normalizeToken = (value) =>
    asText(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

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

const looksLikeLmsNotification = (payload) => {
    if (!payload || typeof payload !== "object") return false;

    const notificationType = asText(payload.notificationType).toUpperCase();
    if (notificationType === "ASSIGNMENT" || notificationType === "SCHEDULE") return true;
    if (notificationType === "COMMENT" && asText(payload.roomId)) return true;

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

    if (
        typeToken.includes("ASSIGN") ||
        typeToken.includes("SCHEDULE") ||
        typeToken.includes("CALENDAR") ||
        typeToken.includes("STUDY")
    ) {
        return true;
    }

    if (typeToken.includes("COMMENT") && asText(payload.roomId)) return true;

    const roomId = asText(payload.roomId);
    const hasLmsTargetId = !!(
        payload.postId ||
        payload.boardPostId ||
        payload.assignmentId ||
        payload.scheduleId ||
        payload.studyScheduleId
    );
    if (roomId && hasLmsTargetId) return true;

    const pathLike = asText(payload.path || payload.url || payload.link || payload.targetPath);
    if (pathLike.startsWith("/lms/") || pathLike.includes("/lms/")) return true;

    return false;
};

const readQueue = () => {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(LMS_NOTIFICATION_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

const writeQueue = (queue) => {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(LMS_NOTIFICATION_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        // ignore storage failure
    }
};

const readDismissedKeys = () => {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(LMS_NOTIFICATION_DISMISSED_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((v) => asText(v)).filter(Boolean);
    } catch (e) {
        return [];
    }
};

const writeDismissedKeys = (keys) => {
    if (typeof window === "undefined") return;
    try {
        const unique = [...new Set((keys || []).map((v) => asText(v)).filter(Boolean))];
        localStorage.setItem(
            LMS_NOTIFICATION_DISMISSED_KEY,
            JSON.stringify(unique.slice(0, MAX_DISMISSED_LMS_NOTIFICATIONS))
        );
    } catch (e) {
        // ignore storage failure
    }
};

export const buildLmsNotificationDedupeKey = (rawPayload) => {
    const candidates = expandPayloadCandidates(rawPayload);
    const sources = candidates.length > 0 ? candidates : [rawPayload || {}];

    // 1) 구조적 타깃 ID 기반 키 (시간값 제외: 재전송/지연 수신에도 동일 키 유지)
    for (const source of sources) {
        const type = asText(source?.notificationType || source?.type).toUpperCase();
        const roomId = asText(source?.roomId || source?.subjectId || source?.classId);
        const postId = asText(source?.postId || source?.boardPostId || source?.articleId);
        const commentId = asText(source?.commentId || source?.replyId || source?.targetCommentId);
        const assignmentId = asText(source?.assignmentId || source?.taskId || source?.homeworkId);
        const scheduleId = asText(source?.scheduleId || source?.studyScheduleId || source?.calendarId);
        if (postId || commentId || assignmentId || scheduleId) {
            return ["STRUCT", type, roomId, postId, commentId, assignmentId, scheduleId].join("|");
        }
    }

    // 2) 서버가 준 고유 알림 ID
    for (const source of sources) {
        const externalId = asText(
            source?.notificationId ||
                source?.noticeId ||
                source?.alarmId ||
                source?.id
        );
        if (externalId) return `ID|${externalId}`;
    }

    // 3) 텍스트 기반 폴백 키
    const source = sources[0] || {};
    const type = asText(source?.notificationType || source?.type).toUpperCase();
    const roomId = asText(source?.roomId || source?.subjectId || source?.classId);
    const title = normalizeToken(
        source?.title ||
            source?.postTitle ||
            source?.assignmentTitle ||
            source?.scheduleTitle ||
            source?.subject
    );
    const content = normalizeToken(
        source?.content || source?.message || source?.description || source?.comment || source?.notificationMessage
    );
    const path = normalizeToken(source?.path || source?.url || source?.link || source?.targetPath);

    return ["TEXT", type, roomId, title, content, path].join("|");
};

export const isLmsNotificationPayload = (rawPayload) => {
    const candidates = expandPayloadCandidates(rawPayload);
    return candidates.some((candidate) => looksLikeLmsNotification(candidate));
};

export const isDismissedLmsNotification = (rawPayloadOrDedupeKey) => {
    if (!rawPayloadOrDedupeKey) return false;
    const targetKey =
        typeof rawPayloadOrDedupeKey === "string"
            ? asText(rawPayloadOrDedupeKey)
            : buildLmsNotificationDedupeKey(rawPayloadOrDedupeKey);
    if (!targetKey) return false;
    const dismissedSet = new Set(readDismissedKeys());
    return dismissedSet.has(targetKey);
};

export const markLmsNotificationDismissed = (rawPayloadOrDedupeKey) => {
    if (!rawPayloadOrDedupeKey) return;
    const targetKey =
        typeof rawPayloadOrDedupeKey === "string"
            ? asText(rawPayloadOrDedupeKey)
            : buildLmsNotificationDedupeKey(rawPayloadOrDedupeKey);
    if (!targetKey) return;
    const dismissed = readDismissedKeys();
    dismissed.unshift(targetKey);
    writeDismissedKeys(dismissed);
};

export const markLmsNotificationsDismissedByDedupeKeys = (dedupeKeys) => {
    if (!Array.isArray(dedupeKeys) || dedupeKeys.length === 0) return;
    const dismissed = readDismissedKeys();
    dedupeKeys.forEach((key) => {
        const normalized = asText(key);
        if (!normalized) return;
        dismissed.unshift(normalized);
    });
    writeDismissedKeys(dismissed);
};

export const markAllQueuedLmsNotificationsDismissed = () => {
    const queue = readQueue();
    const keys = queue.map((item) => asText(item?.dedupeKey)).filter(Boolean);
    markLmsNotificationsDismissedByDedupeKeys(keys);
};

export const enqueueLmsNotification = (rawPayload) => {
    if (!rawPayload || !isLmsNotificationPayload(rawPayload)) return;

    const queue = readQueue();
    const dedupeKey = buildLmsNotificationDedupeKey(rawPayload);

    if (dedupeKey && isDismissedLmsNotification(dedupeKey)) return;

    if (dedupeKey && queue.some((item) => item?.dedupeKey === dedupeKey)) return;

    const entry = {
        payload: rawPayload,
        dedupeKey,
        receivedAt: Date.now(),
    };

    writeQueue([entry, ...queue].slice(0, MAX_QUEUED_LMS_NOTIFICATIONS));
};

export const drainQueuedLmsNotifications = () => {
    const queue = readQueue();
    return queue
        .map((item) => item?.payload || null)
        .filter(Boolean);
};

export const readQueuedLmsNotifications = () => {
    const dismissedSet = new Set(readDismissedKeys());
    const queue = readQueue();
    const filtered = queue.filter((item) => {
        const key = asText(item?.dedupeKey);
        if (!key) return true;
        return !dismissedSet.has(key);
    });

    if (filtered.length !== queue.length) {
        writeQueue(filtered);
    }

    return filtered.map((item) => item?.payload || null).filter(Boolean);
};

export const removeQueuedLmsNotification = (rawPayloadOrDedupeKey) => {
    if (!rawPayloadOrDedupeKey) return;
    const targetKey =
        typeof rawPayloadOrDedupeKey === "string"
            ? rawPayloadOrDedupeKey.trim()
            : buildLmsNotificationDedupeKey(rawPayloadOrDedupeKey);
    if (!targetKey) return;

    const queue = readQueue();
    const nextQueue = queue.filter((item) => item?.dedupeKey !== targetKey);
    writeQueue(nextQueue);
};

export const clearQueuedLmsNotifications = () => {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(LMS_NOTIFICATION_QUEUE_KEY);
    } catch (e) {
        // ignore storage failure
    }
};

