import { useEffect, useRef } from "react";
import api from "../api/api";

const OAuthSuccess = () => {
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const params = new URLSearchParams(window.location.search);

        const token = params.get("token");

        if (!token) {
            console.error("[OAuthSuccess] 토큰이 없습니다.");
            alert("로그인에 실패했습니다. 다시 시도해주세요.");
            window.location.href = "/auth";
            return;
        }

        sessionStorage.setItem("accessToken", token);

        console.log("[OAuthSuccess] 토큰 저장 완료, 사용자 정보 조회 시작");

        // 사용자 정보 조회 시도
        api
            .get("/mypage/me")
            .then((res) => {
                console.log("[OAuthSuccess] 사용자 정보 조회 성공:", res.data);
                const user = res.data;
                
                // nickname 저장 (있으면)
                if (user.nickname) {
                    sessionStorage.setItem("nickname", user.nickname);
                }

                alert("로그인 성공!");

                // birthDate나 gender가 없으면 마이페이지로, 있으면 메인으로
                if (!user.birthDate || !user.gender) {
                    alert("원활한 스터디 가입을 위해 회원 정보를 마이페이지에서 수정해주세요.");
                    window.location.href = "/room/mypage";
                } else {
                    window.location.href = "/";
                }
            })
            .catch((error) => {
                console.error("[OAuthSuccess] 사용자 정보 조회 실패:", error);
                console.error("[OAuthSuccess] 에러 상세:", {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                });
                
                // API 호출 실패해도 토큰은 있으니 로그인은 성공한 것으로 간주
                alert("로그인 성공! (사용자 정보 조회 중 오류가 발생했지만 로그인은 완료되었습니다)");
                window.location.href = "/";
            });
    }, []);

    return (
        <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "100vh",
            fontSize: "18px"
        }}>
            로그인 처리중...
        </div>
    );
};

export default OAuthSuccess;
