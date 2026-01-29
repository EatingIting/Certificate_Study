import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLMS } from "./LMSContext";

export default function ProtectedRoute({ children }) {
    const { user, loading, error } = useLMS();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(true);
    const hasRedirectedRef = useRef(false); // 리다이렉트 중복 방지

    useEffect(() => {
        // 이미 리다이렉트를 시작했으면 중복 실행 방지
        if (hasRedirectedRef.current) return;

        // 토큰 체크 (가장 먼저)
        const token = sessionStorage.getItem("accessToken");
        if (!token) {
            hasRedirectedRef.current = true;
            alert("로그인이 필요한 페이지입니다.");
            navigate("/auth", { replace: true });
            setIsChecking(false);
            return;
        }

        // 로딩이 완료되면 체크 완료
        if (!loading) {
            setIsChecking(false);

            // 사용자 정보가 없거나 에러가 발생한 경우
            if (!user || error) {
                // 이미 리다이렉트를 시작했으면 중복 실행 방지
                if (hasRedirectedRef.current) return;
                hasRedirectedRef.current = true;

                // 401 Unauthorized 에러인 경우
                if (error?.response?.status === 401) {
                    alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
                    sessionStorage.removeItem("accessToken");
                    sessionStorage.removeItem("userEmail");
                    navigate("/auth", { replace: true });
                } else if (error) {
                    alert("인증에 실패했습니다. 다시 로그인해주세요.");
                    sessionStorage.removeItem("accessToken");
                    sessionStorage.removeItem("userEmail");
                    navigate("/auth", { replace: true });
                } else if (!user) {
                    // 사용자 정보가 없는 경우
                    alert("사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.");
                    sessionStorage.removeItem("accessToken");
                    sessionStorage.removeItem("userEmail");
                    navigate("/auth", { replace: true });
                }
            }
        }
    }, [user, loading, error, navigate]);

    // 체크 중이거나 로딩 중이면 로딩 화면 표시
    if (isChecking || loading) {
        return (
            <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                height: "100vh" 
            }}>
                <p>로딩 중...</p>
            </div>
        );
    }

    // 토큰이 없거나 사용자 정보가 없으면 아무것도 렌더링하지 않음
    const token = sessionStorage.getItem("accessToken");
    if (!token || !user) {
        return null;
    }

    return children;
}
