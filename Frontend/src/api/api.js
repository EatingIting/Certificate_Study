import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem("userId");
        if (userId) {
            config.headers["X-USER-ID"] = userId;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ===== API 함수들 (수정) =====
export const checkEmail = (email) =>
    api.get("/check-email", {
        params: { email },
    });

export const signup = (data) =>
    api.post("/signup", data);

export const login = (email, password) =>
    api.post("/login", { email, password });

export default api;