import axios from "axios";
import { getBackendOrigin } from "../utils/backendUrl";

// HTTPS 환경에서는 절대 URL 사용, HTTP 환경에서는 상대 경로 사용
const getBaseURL = () => {
    if (process.env.REACT_APP_API_BASE_URL) {
        return process.env.REACT_APP_API_BASE_URL;
    }
    
    // HTTPS로 접속하는 경우 절대 URL 사용 (Mixed Content 방지)
    if (window.location.protocol === "https:") {
        return `${getBackendOrigin()}/api`;
    }
    
    // HTTP 환경에서는 상대 경로 사용 (프록시 활용)
    return "/api";
};

const api = axios.create({
    baseURL: getBaseURL(),
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
