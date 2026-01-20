import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    withCredentials: true
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

// ===== API 함수들 =====
export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
    });

export const signup = (data) =>
    api.post("/users/signup", data);

export const login = (email, password) =>
    api.post("/users/login", { email, password });

export default api;
