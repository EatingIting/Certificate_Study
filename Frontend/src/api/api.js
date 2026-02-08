import axios from "axios";

const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || "/api",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

const NON_REFRESHABLE_PATHS = [
    "/users/login",
    "/users/signup",
    "/users/check-email",
    "/users/refresh",
    "/users/logout",
];

let refreshPromise = null;

const getRememberMe = () => {
    const rememberFlag = localStorage.getItem("rememberMe");
    if (rememberFlag === "true") {
        return true;
    }
    if (rememberFlag === "false") {
        return false;
    }
    return Boolean(localStorage.getItem("accessToken"));
};

const saveAuthSession = (payload, rememberMe = getRememberMe()) => {
    const token = payload?.accessToken || payload?.token;
    if (!token) {
        return null;
    }

    sessionStorage.setItem("accessToken", token);

    if (payload?.userId) {
        sessionStorage.setItem("userId", payload.userId);
        localStorage.setItem("userId", payload.userId);
    }

    if (payload?.email) {
        sessionStorage.setItem("userEmail", payload.email);
    }

    if (payload?.nickname != null) {
        sessionStorage.setItem("nickname", payload.nickname);
        if (rememberMe) {
            localStorage.setItem("nickname", payload.nickname);
        }
    }

    const userName = (payload?.nickname || payload?.name || "").trim();
    if (userName) {
        localStorage.setItem("userName", userName);
    }

    if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("accessToken", token);
    } else {
        localStorage.setItem("rememberMe", "false");
        localStorage.removeItem("accessToken");
    }

    return token;
};

export const clearAuthStorage = () => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("nickname");

    localStorage.removeItem("accessToken");
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("nickname");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
};

export const refreshAccessToken = async ({
    rememberMe,
    clearOnFailure = true,
} = {}) => {
    const shouldRemember =
        typeof rememberMe === "boolean" ? rememberMe : getRememberMe();

    try {
        const res = await api.post(
            "/users/refresh",
            {},
            {
                skipAuthHeader: true,
                skipAuthRefresh: true,
            }
        );

        return saveAuthSession(res.data, shouldRemember);
    } catch (error) {
        if (clearOnFailure) {
            clearAuthStorage();
        }
        throw error;
    }
};

export const restoreAuthSession = async () => {
    if (!sessionStorage.getItem("accessToken")) {
        const localAccessToken = localStorage.getItem("accessToken");
        const localUserId = localStorage.getItem("userId");
        const localNickname = localStorage.getItem("nickname");

        if (localAccessToken) {
            sessionStorage.setItem("accessToken", localAccessToken);
        }
        if (localUserId) {
            sessionStorage.setItem("userId", localUserId);
        }
        if (localNickname) {
            sessionStorage.setItem("nickname", localNickname);
        }
    }

    if (getRememberMe()) {
        try {
            await refreshAccessToken({
                rememberMe: true,
                clearOnFailure: true,
            });
        } catch {
            // keep silent on bootstrap
        }
    }
};

api.interceptors.request.use(
    (config) => {
        if (config.skipAuthHeader) {
            return config;
        }

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

const shouldTryRefresh = (error) => {
    const status = error.response?.status;
    if (status !== 401) {
        return false;
    }

    const originalRequest = error.config || {};
    if (originalRequest._retry || originalRequest.skipAuthRefresh) {
        return false;
    }

    const requestUrl = originalRequest.url || "";
    return !NON_REFRESHABLE_PATHS.some((path) => requestUrl.includes(path));
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (shouldTryRefresh(error)) {
            const originalRequest = error.config;
            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = refreshAccessToken({
                        clearOnFailure: false,
                    }).finally(() => {
                        refreshPromise = null;
                    });
                }

                const newAccessToken = await refreshPromise;
                if (newAccessToken) {
                    originalRequest.headers = {
                        ...originalRequest.headers,
                        Authorization: `Bearer ${newAccessToken}`,
                    };
                }

                return api(originalRequest);
            } catch (refreshError) {
                clearAuthStorage();
                return Promise.reject(refreshError);
            }
        }

        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn("[API] 인증 실패:", error.response?.status);
        }

        if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
            console.error("[API] 네트워크 에러:", error.message);
        }

        return Promise.reject(error);
    }
);

export const checkEmail = (email) =>
    api.get("/users/check-email", {
        params: { email },
        skipAuthHeader: true,
        skipAuthRefresh: true,
    });

export const signup = (data) =>
    api.post("/users/signup", data, {
        skipAuthHeader: true,
        skipAuthRefresh: true,
    });

export const login = (email, password, rememberMe = false) =>
    api.post(
        "/users/login",
        {
            email,
            password,
            rememberMe,
        },
        {
            skipAuthHeader: true,
            skipAuthRefresh: true,
        }
    );

export const logout = async () => {
    try {
        await api.post(
            "/users/logout",
            {},
            {
                skipAuthHeader: true,
                skipAuthRefresh: true,
            }
        );
    } finally {
        clearAuthStorage();
    }
};

export default api;
