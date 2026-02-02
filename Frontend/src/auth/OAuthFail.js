import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const OAuthFail = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const error = params.get("error");
        const provider = params.get("provider"); // ✅ 추가

        // provider별 이름 매핑
        const providerName =
            provider === "kakao"
                ? "카카오"
                : provider === "naver"
                    ? "네이버"
                    : provider === "google"
                        ? "구글"
                        : "소셜";

        if (error) {
            alert(`${providerName} 로그인 실패: ${decodeURIComponent(error)}`);
        } else {
            alert(`${providerName} 로그인에 실패했습니다.`);
        }

        navigate("/auth");
    }, [navigate]);

    return <div>로그인 실패 처리중...</div>;
};

export default OAuthFail;
