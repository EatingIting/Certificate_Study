// src/api.js
import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:8080/api",
    headers: {
        "Content-Type": "application/json",
    },
});

export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
    });

export const signup = (data) =>
    api.post("/users/signup", data);

export const login = (email, password) =>
    api.post("/users/login", { email, password });

export default api;
