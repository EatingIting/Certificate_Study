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
    const [roomLoading, setRoomLoading] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedReason, setAccessDeniedReason] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roomNickname, setRoomNickname] = useState("");
    const [roomProfileImg, setRoomProfileImg] = useState("");

    // 사용자 정보 조회
    const fetchUserInfo = useCallback(async () => {
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
            console.error("사용자 정보 조회 실패", err);
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

    // 방 마이페이지(닉네임/프로필) 조회
    const fetchRoomMyPage = useCallback(
        async (id) => {
            if (!id) {
                setRoomNickname("");
                setRoomProfileImg("");
                return;
            }

            const token = sessionStorage.getItem("accessToken");
            if (!token) {
                setRoomNickname("");
                setRoomProfileImg("");
                return;
            }

            try {
                const res = await api.get(`/rooms/${id}/me/mypage`);
                const nextNick = (res?.data?.roomNickname || "").trim();
                const nextImg = (res?.data?.profileImg || "").trim();
                setRoomNickname(nextNick);
                setRoomProfileImg(nextImg);
            } catch (err) {
                // 선택적 정보이므로 실패해도 전체 흐름은 유지
                console.warn("방 마이페이지 조회 실패", err);
                setRoomNickname("");
                setRoomProfileImg("");
            }
        },
        []
    );

    // 방 컨텍스트 조회 (접근 권한/역할 포함)
    const fetchRoomInfo = useCallback(async (id) => {
        if (!id) {
            setRoom(null);
            setAccessDenied(false);
            setAccessDeniedReason("");
            return;
        }

        try {
            setRoomLoading(true);
            setAccessDenied(false);

            const res = await api.get(`/rooms/${id}/context`);
            const data = res.data || {};
            const hostEmail = data.hostUserEmail ?? data.host_user_email ?? "";

            if (data.myRole === "NONE") {
                setRoom(null);
                setAccessDenied(true);
                setAccessDeniedReason((data.deniedReason || "").trim());
            } else {
                const userEmail = user?.email ?? "";
                const resolvedHostEmail =
                    hostEmail || (data.myRole === "OWNER" ? userEmail : "");

                setRoom({
                    roomId: data.roomId,
                    title: data.title,
                    hostUserEmail: resolvedHostEmail,
                });
                setAccessDenied(false);
                setAccessDeniedReason("");
            }
        } catch (err) {
            console.error("방 정보 조회 실패", err);
            setRoom(null);
            setAccessDenied(err.response?.status === 403);
            setAccessDeniedReason("");
        } finally {
            setRoomLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUserInfo();
    }, [fetchUserInfo]);

    useEffect(() => {
        if (roomId) {
            fetchRoomInfo(roomId);
            fetchRoomMyPage(roomId);
        }
    }, [roomId, fetchRoomInfo, fetchRoomMyPage]);

    const refreshUser = useCallback(() => {
        fetchUserInfo();
    }, [fetchUserInfo]);

    const refreshRoom = useCallback(() => {
        fetchRoomMyPage(roomId);
    }, [fetchRoomMyPage, roomId]);

    // 닉네임 변경 이벤트 반영
    useEffect(() => {
        const onRoomNickUpdated = (e) => {
            const detail = e?.detail || {};
            const targetRoomId = (detail.roomId ?? "").toString().trim();
            const nextNick = (detail.roomNickname || "").trim();
            const current = (roomId ?? "").toString().trim();

            if (!targetRoomId || !current) return;
            if (targetRoomId.toLowerCase() !== current.toLowerCase()) return;

            setRoomNickname(nextNick);
            fetchRoomMyPage(roomId);
        };

        const onUserNickUpdated = (e) => {
            const next = (
                e?.detail?.nickname ||
                sessionStorage.getItem("nickname") ||
                localStorage.getItem("nickname") ||
                ""
            ).trim();

            if (next) {
                setUser((prev) => (prev ? { ...prev, nickname: next } : prev));
            }
            refreshUser();
        };

        window.addEventListener("lms:room-nickname-updated", onRoomNickUpdated);
        window.addEventListener("user:nickname-updated", onUserNickUpdated);

        return () => {
            window.removeEventListener("lms:room-nickname-updated", onRoomNickUpdated);
            window.removeEventListener("user:nickname-updated", onUserNickUpdated);
        };
    }, [roomId, refreshUser, fetchRoomMyPage]);

    // 헤더 표시명: roomNickname(name) 우선
    const displayName = user
        ? (() => {
              const roomNick = (roomNickname && roomNickname.trim()) || "";
              const nickname = (user.nickname && user.nickname.trim()) || "";
              const name = (user.name && user.name.trim()) || "";

              if (roomNick.length > 0 && name.length > 0) return `${roomNick}(${name})`;
              if (roomNick.length > 0) return roomNick;
              if (nickname.length > 0 && name.length > 0) return `${nickname}(${name})`;
              if (nickname.length > 0) return nickname;
              if (name.length > 0) return name;
              return "사용자";
          })()
        : "";

    const isHost = !!(
        user &&
        room &&
        user.email &&
        room.hostUserEmail &&
        String(user.email).trim().toLowerCase() ===
            String(room.hostUserEmail).trim().toLowerCase()
    );

    const value = {
        user,
        room,
        loading,
        roomLoading,
        accessDenied,
        accessDeniedReason,
        error,
        refreshUser,
        refreshRoom,
        displayName,
        isHost,
        userId: user?.userId || null,
        email: user?.email || null,
        name: user?.name || null,
        nickname: user?.nickname || null,
        roomNickname: roomNickname || null,
        roomProfileImg: roomProfileImg || null,
        roomTitle: room?.title || null,
        roomId: room?.roomId || null,
        hostUserEmail: room?.hostUserEmail || null,
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
