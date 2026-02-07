export function getBackendOrigin() {
    const envOrigin = process.env.REACT_APP_BACKEND_ORIGIN;
    if (envOrigin && typeof envOrigin === "string") {
        return envOrigin.replace(/\/+$/, "");
    }
    // 기본값: 빈 문자열 → 상대 경로(`/api`, `/files` 등)를 그대로 사용
    return "";
}

export function getWsProtocol() {
    // ✅ https → wss, http → ws
    return window.location.protocol === "https:" ? "wss" : "ws";
}

export function getHostnameWithPort() {
    // 현재 접속 중인 호스트 + 포트 그대로 사용 (dev: localhost:3000, prod: 3.35.119.96 등)
    const { hostname, port } = window.location;
    return port ? `${hostname}:${port}` : hostname;
}

export function getWsBackendOrigin() {
    const envOrigin = process.env.REACT_APP_BACKEND_WS_ORIGIN;
    if (envOrigin) return envOrigin.replace(/\/+$/, "");

    return `${getWsProtocol()}://${getHostnameWithPort()}`;
}

export function toBackendUrl(pathOrUrl) {
    if (!pathOrUrl) return "";

    // 이미 절대 URL이면 그대로 사용
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const origin = getBackendOrigin();
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${path}`;
}

export function toWsBackendUrl(pathOrUrl) {
    if (!pathOrUrl) return "";

    // 이미 절대 URL이면 그대로 사용
    if (/^wss?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const origin = getWsBackendOrigin();
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${path}`;
}

