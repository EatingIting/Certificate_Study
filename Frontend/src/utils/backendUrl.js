// Frontend runtime backend URL helpers.
// 목적:
// - 개발(React dev server) / 운영(nginx 리버스 프록시) 환경을 분리해서 생각한다.
// - 운영 환경에서는 nginx가 `/api`, `/ws`, `/sfu` 를 각각 Spring / SFU 로 프록시한다.
// - 프론트에서는 IP/포트 하드코딩 없이 "현재 접속한 호스트"만 사용한다.
//
// ✅ 권장 구조
// - 개발 환경: localhost:3000  → (setupProxy.js) →  localhost:8080(SPRING) / 4000(SFU)
// - 운영 환경: 3.35.119.96:80 → (nginx)        →  localhost:8080(SPRING) / 4000(SFU)
//
// 따라서 프론트 기준 기본값은 다음과 같다.
// - HTTP API:  /api/...
// - WS       : ws(s)://{현재호스트}/ws/...
// - SFU      : ws(s)://{현재호스트}/sfu/...

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

