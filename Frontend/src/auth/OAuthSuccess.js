import { useEffect, useRef } from "react";
import api, { refreshAccessToken } from "../api/api";

const OAuthSuccess = () => {
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        localStorage.setItem("rememberMe", "true");

        refreshAccessToken({ rememberMe: true })
            .then(() => {
                return api.get("/mypage/me");
            })
            .then((res) => {
                const user = res.data;

                if (user.nickname) {
                    sessionStorage.setItem("nickname", user.nickname);
                    localStorage.setItem("nickname", user.nickname);
                }

                if (!user.birthDate || !user.gender) {
                    alert("원활한 서비스 이용을 위해 회원 정보를 마이페이지에서 수정해주세요.");
                    window.location.href = "/room/mypage";
                } else {
                    window.location.href = "/";
                }
            })
            .catch((error) => {
                console.error("[OAuthSuccess] 로그인 처리 실패:", error);
                alert("로그인에 실패했습니다. 다시 시도해주세요.");
                window.location.href = "/auth";
            });
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
            로그인 처리중...
        </div>
    );
};

export default OAuthSuccess;
