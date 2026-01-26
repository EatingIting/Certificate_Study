// Frontend runtime backend URL helpers.
// 목적:
// - 개발(React dev server) / 배포(다른 PC에서 접속) 환경 모두에서
//   'localhost' 하드코딩으로 생기는 네트워크 오류를 피한다.
//
// 우선순위:
// 1) REACT_APP_BACKEND_ORIGIN (예: "https://example.com" 또는 "http://192.168.0.10:8080")
// 2) 기본값: 현재 hostname + 8080 포트 (http)

export function getBackendOrigin() {
    const envOrigin = process.env.REACT_APP_BACKEND_ORIGIN;
    if (envOrigin && typeof envOrigin === "string") {
        return envOrigin.replace(/\/+$/, "");
    }

    // ✅ https 접속 시: nginx 프록시를 통해 같은 호스트로 요청 (포트 없음)
    // ✅ http 접속 시: 직접 백엔드 8080 포트로 요청
    if (window.location.protocol === "https:") {
        return `https://${window.location.hostname}`;
    }
    return `http://${window.location.hostname}:8080`;
}

export function getWsProtocol() {
    // ✅ https → wss, http → ws
    return window.location.protocol === "https:" ? "wss" : "ws";
}

export function getHostnameWithPort() {
    // ✅ 요청사항:
    // - https로 접속하면 포트를 붙이지 않음 (nginx 443/기본 포트)
    // - http로 접속하면 포트를 유지 (개발 3000 등)
    if (window.location.protocol === "https:") {
        return window.location.hostname;
    }
    const port = window.location.port;
    return `${window.location.hostname}${port ? `:${port}` : ""}`;
}

export function getWsBackendOrigin(port = 8080) {
    const envOrigin = process.env.REACT_APP_BACKEND_WS_ORIGIN;
    if (envOrigin && typeof envOrigin === "string") {
        return envOrigin.replace(/\/+$/, "");
    }

    // ✅ https 접속 시: nginx 프록시를 통해 wss로 연결 (포트 없음)
    // ✅ http 접속 시: 직접 백엔드 포트로 ws 연결
    if (window.location.protocol === "https:") {
        return `wss://${window.location.hostname}`;
    }
    return `ws://${window.location.hostname}:${port}`;
}

export function toBackendUrl(pathOrUrl) {
    if (!pathOrUrl) return "";

    // 이미 절대 URL이면 그대로 사용
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const origin = getBackendOrigin();
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${path}`;
}

export function toWsBackendUrl(pathOrUrl, port = 8080) {
    if (!pathOrUrl) return "";

    // 이미 절대 URL이면 그대로 사용
    if (/^wss?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const origin = getWsBackendOrigin(port);
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${origin}${path}`;
}

