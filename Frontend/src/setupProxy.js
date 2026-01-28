const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    // API 프록시
    app.use(
        "/api",
        createProxyMiddleware({
            target: "http://localhost:8080",
            changeOrigin: true,
            secure: false,
        })
    );

    // OAuth2 리다이렉트/인증 엔드포인트 프록시
    // (window.location.href로 이동하는 경우에도 dev server가 백엔드로 전달)
    app.use(
        "/oauth2",
        createProxyMiddleware({
            target: "http://localhost:8080",
            changeOrigin: true,
            secure: false,
        })
    );

    // WebSocket 프록시 (Spring 시그널링 서버)
    app.use(
        "/ws",
        createProxyMiddleware({
            target: "http://localhost:8080",
            changeOrigin: true,
            ws: true, // WebSocket 프록시 활성화
            secure: false,
        })
    );

    // SFU WebSocket 프록시 (mediasoup 서버)
    app.use(
        "/sfu",
        createProxyMiddleware({
            target: "http://localhost:4000",
            changeOrigin: true,
            ws: true, // WebSocket 프록시 활성화
            secure: false,
        })
    );
};
