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

        // ✅ 1) sessionStorage 저장 (즉시 로그인)
        sessionStorage.setItem("accessToken", token);

        // ✅ 2) OAuth는 자동로그인 기본 적용 → localStorage에도 저장
        localStorage.setItem("accessToken", token);

        // ✅ 3) 30일 만료시간 저장
        const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
        localStorage.setItem("expiresAt", expiresAt);

        console.log("[OAuthSuccess] 토큰 저장 완료, 사용자 정보 조회 시작");

        // 사용자 정보 조회
        api.get("/mypage/me")
            .then((res) => {
                const user = res.data;

                // nickname 저장
                if (user.nickname) {
                    sessionStorage.setItem("nickname", user.nickname);
                    localStorage.setItem("nickname", user.nickname); // ✅ 자동로그인용
                }

                alert("로그인 성공!");

                // 추가정보 없으면 마이페이지로
                if (!user.birthDate || !user.gender) {
                    alert("원활한 스터디 가입을 위해 회원 정보를 마이페이지에서 수정해주세요.");
                    window.location.href = "/room/mypage";
                } else {
                    window.location.href = "/";
                }
            })
            .catch((error) => {
                console.error("[OAuthSuccess] 사용자 정보 조회 실패:", error);

                // API 실패해도 로그인은 성공 처리
                alert("로그인 성공!");
                window.location.href = "/";
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
