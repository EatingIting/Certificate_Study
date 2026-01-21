const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
    app.use(
        "/api",
        createProxyMiddleware({
            target: "https://localhost:8080",
            changeOrigin: true,
            secure: false, // 자체 서명 인증서 허용
        })
    );
};
