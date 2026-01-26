import axios from "axios";


const api = axios.create({
    // 배포 환경(다른 PC에서 접속)에서 localhost 하드코딩을 피하기 위해
    // 기본은 상대경로(/api)로 요청한다.
    // - 개발: CRA dev server + setupProxy가 localhost:8080으로 프록시
    // - 배포: 동일 오리진에서 /api를 백엔드로 라우팅(리버스 프록시 또는 Spring 정적서빙)
    baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem("accessToken");

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

// 이메일 중복 체크
export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
    });

export const signup = (data) => api.post("/users/signup", data);
export const login = (email, password) =>
    api.post("/users/login", { email, password });
export default api;
