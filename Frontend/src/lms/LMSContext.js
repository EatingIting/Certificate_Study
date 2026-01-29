import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react";
import api from "../api/api";

const LMSContext = createContext(null);

export const LMSProvider = ({ children, roomId }) => {
    const [user, setUser] = useState(null);
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [roomLoading, setRoomLoading] = useState(false);
    const [error, setError] = useState(null);

    // 사용자 정보 가져오기
    const fetchUserInfo = useCallback(async () => {
        // 토큰 체크
        const token = sessionStorage.getItem("accessToken");
        if (!token) {
            setLoading(false);
            setError(new Error("No token"));
            setUser(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const res = await api.get("/users/me");
            setUser(res.data);
        } catch (err) {
            console.error("사용자 정보 가져오기 실패", err);
            // 401 Unauthorized인 경우 토큰 제거
            if (err.response?.status === 401) {
                sessionStorage.removeItem("accessToken");
                sessionStorage.removeItem("userEmail");
            }
            setError(err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Room 정보 가져오기
    const fetchRoomInfo = useCallback(async (id) => {
        if (!id) {
            setRoom(null);
            return;
        }
        try {
            setRoomLoading(true);
            const res = await api.get(`/rooms/${id}`);
            setRoom(res.data);
        } catch (err) {
            console.error("방 정보 가져오기 실패", err);
            setRoom(null);
        } finally {
            setRoomLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserInfo();
    }, [fetchUserInfo]);

    useEffect(() => {
        if (roomId) {
            fetchRoomInfo(roomId);
        }
    }, [roomId, fetchRoomInfo]);

    // 사용자 정보 새로고침
    const refreshUser = useCallback(() => {
        fetchUserInfo();
    }, [fetchUserInfo]);

    // 표시용 이름 (nickname(name) 형식)
    const displayName = user
        ? (() => {
              const nickname = (user.nickname && user.nickname.trim()) || "";
              const name = (user.name && user.name.trim()) || "";
              
              if (nickname.length > 0 && name.length > 0) {
                  return `${nickname}(${name})`;
              } else if (nickname.length > 0) {
                  return nickname;
              } else if (name.length > 0) {
                  return name;
              } else {
                  return "사용자";
              }
          })()
        : "";

    const value = {
        user,
        room,
        loading,
        roomLoading,
        error,
        refreshUser,
        displayName,
        // 편의 메서드들
        userId: user?.userId || null,
        email: user?.email || null,
        name: user?.name || null,
        nickname: user?.nickname || null,
        roomTitle: room?.title || null,
        roomId: room?.roomId || null,
    };

    return <LMSContext.Provider value={value}>{children}</LMSContext.Provider>;
};

export const useLMS = () => {
    const context = useContext(LMSContext);
    if (!context) {
        throw new Error("useLMS must be used within LMSProvider");
    }
    return context;
};
