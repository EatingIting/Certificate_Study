import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

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