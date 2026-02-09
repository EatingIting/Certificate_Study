const LMS_NOTIFICATION_QUEUE_KEY = "lms.notification.queue.v1";
const MAX_QUEUED_LMS_NOTIFICATIONS = 100;

const asText = (value) => {
    if (value == null) return "";
    return String(value).trim();
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

export const buildLmsNotificationDedupeKey = (rawPayload) => {
    const candidates = expandPayloadCandidates(rawPayload);
    const source = candidates[0] || rawPayload || {};

    const externalId = asText(
        source?.notificationId ||
            source?.noticeId ||
            source?.alarmId ||
            source?.id
    );
    if (externalId) return `ID|${externalId}`;

    const type = asText(source?.notificationType || source?.type).toUpperCase();
    const roomId = asText(source?.roomId || source?.subjectId);
    const postId = asText(source?.postId || source?.boardPostId || source?.articleId);
    const assignmentId = asText(source?.assignmentId || source?.taskId || source?.homeworkId);
    const scheduleId = asText(source?.scheduleId || source?.studyScheduleId || source?.calendarId);
    const title = asText(
        source?.title ||
            source?.postTitle ||
            source?.assignmentTitle ||
            source?.scheduleTitle ||
            source?.subject
    );
    const content = asText(source?.content || source?.message || source?.description || source?.comment);
    const createdAt = asText(source?.createdAt || source?.timestamp || source?.sentAt || source?.createdDate);

    return [type, roomId, postId, assignmentId, scheduleId, title, content, createdAt].join("|");
};

export const isLmsNotificationPayload = (rawPayload) => {
    const candidates = expandPayloadCandidates(rawPayload);
    return candidates.some((candidate) => looksLikeLmsNotification(candidate));
};

export const enqueueLmsNotification = (rawPayload) => {
    if (!rawPayload || !isLmsNotificationPayload(rawPayload)) return;

    const queue = readQueue();
    const dedupeKey = buildLmsNotificationDedupeKey(rawPayload);

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
    return readQueue()
        .map((item) => item?.payload || null)
        .filter(Boolean);
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

