import { useEffect } from "react";
import axios from "axios";

const OAuthSuccess = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const token = params.get("token");

        if (!token) return;

        // ✅ 토큰 저장
        sessionStorage.setItem("accessToken", token);

        alert("로그인 성공!");

        // ✅ 프로필 조회해서 nickname 가져오기
        axios
            .get("http://localhost:8080/api/mypage/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            .then((res) => {
                const user = res.data;

                // ✅ nickname 저장 (여기서!)
                sessionStorage.setItem("nickname", user.nickname);

                // OAuth 유저 정보 부족하면 마이페이지로 이동
                if (!user.birthDate || !user.gender) {
                    alert(
                        "원활한 스터디 가입을 위해 회원 정보를 마이페이지에서 수정해주세요."
                    );
                    window.location.href = "/room/mypage";
                } else {
                    window.location.href = "/";
                }
            })
            .catch(() => {
                window.location.href = "/";
            });
    }, []);

    return <div>로그인 처리중...</div>;
};

export default OAuthSuccess;
