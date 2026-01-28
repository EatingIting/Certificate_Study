import { useEffect } from "react";

/**
 * OAuth 콜백 URL(/login/oauth2/code/...)이 React로 들어온 경우
 * 같은 URL로 다시 요청해서 nginx가 백엔드로 프록시하도록 유도합니다.
 * (nginx location ^~ /login/ 이 백엔드로 보내야 함)
 */
const OAuthCallbackRedirect = () => {
    useEffect(() => {
        const url = window.location.pathname + window.location.search;
        const key = "oauth_callback_redirect_tried";
        const tried = sessionStorage.getItem(key);

        // 무한 새로고침 방지: 1번만 재요청하고, 그래도 React로 오면 멈춘다.
        if (tried) return;

        sessionStorage.setItem(key, "1");
        window.location.replace(url);
    }, []);

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                fontSize: "18px",
            }}
        >
            로그인 처리 중...
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
                계속 반복되면 서버(nginx)가 이 경로를 백엔드로 보내지 못한 상태입니다.
            </div>
        </div>
    );
};

export default OAuthCallbackRedirect;
