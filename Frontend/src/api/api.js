import axios from "axios";

// 현재 호스트 기반으로 API URL 결정
const getBaseURL = () => {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "/api"; // 로컬 개발 시 프록시 사용
    }
    // 외부 IP 접속 시 백엔드 직접 호출 (http/https 자동 매칭)
    return `${window.location.protocol}//${hostname}:8080/api`;
};

const api = axios.create({
    baseURL: getBaseURL(),
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken"); // ← 여기
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ===== API 함수들 (수정) =====
export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
    });

export const signup = (data) =>
    api.post("/users/signup", data);

export const login = (email, password) =>
    api.post("/users/login", { email, password });

export default api;