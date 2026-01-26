import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const OAuthFail = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");

        if (error) {
            alert("카카오 로그인 실패: " + decodeURIComponent(error));
        }

        navigate("/auth");
    }, []);

    return <div>로그인 실패 처리중...</div>;
};

export default OAuthFail;
