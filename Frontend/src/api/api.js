import axios from "axios";

// API 엔드포인트 기본값:
// - 개발 환경: React dev server → setupProxy.js 가 /api 를 8080으로 프록시
// - 운영 환경: nginx 가 /api 를 Spring(8080)으로 프록시
// ⇒ 프론트에서는 기본적으로 '/api' 만 쓰고, 필요할 때만 .env 로 절대 경로를 override
const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {

        const token =
            sessionStorage.getItem("accessToken") ||
            localStorage.getItem("accessToken");

        if (token) {
            config.headers = {
                ...config.headers,
                Authorization: `Bearer ${token}`,
            };
        }

        return config;
    },
    (error) => Promise.reject(error)
);


// 응답 인터셉터: 인증 실패 시 처리
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // 401 Unauthorized 또는 403 Forbidden인 경우
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn("[API] 인증 실패:", error.response?.status);
            // 필요시 로그인 페이지로 리다이렉트할 수 있음
        }
        
        // 네트워크 에러인 경우
        if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
            console.error("[API] 네트워크 에러:", error.message);
        }
        
        return Promise.reject(error);
    }
);

// 이메일 중복 체크
export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
    });

export const signup = (data) => api.post("/users/signup", data);
export const login = (email, password) =>
    api.post("/users/login", { email, password });
export default api;
