import { useEffect } from "react";
import api from "../api/api";

const OAuthSuccess = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const token = params.get("token");

        if (!token) return;

        sessionStorage.setItem("accessToken", token);

        alert("로그인 성공!");

        api
            .get("/mypage/me")
            .then((res) => {
                const user = res.data;
                sessionStorage.setItem("nickname", user.nickname);

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
