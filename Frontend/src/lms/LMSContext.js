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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roomNickname, setRoomNickname] = useState("");
    const [roomProfileImg, setRoomProfileImg] = useState("");

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

    // 방별 마이페이지(닉네임) 가져오기
    const fetchRoomMyPage = useCallback(
        async (id) => {
            if (!id) {
                setRoomNickname("");
                setRoomProfileImg("");
                return;
            }

            // 토큰 체크 (인증 없으면 호출하지 않음)
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
                // 방별 닉네임은 옵션 값이므로 실패해도 전체 로딩을 막지 않음
                console.warn("방별 마이페이지 가져오기 실패", err);
                setRoomNickname("");
                setRoomProfileImg("");
            }
        },
        []
    );

    // Room 정보 가져오기 (context: 스터디원 여부 포함, 비스터디원이면 접근 거부)
    const fetchRoomInfo = useCallback(async (id) => {
        if (!id) {
            setRoom(null);
            setAccessDenied(false);
            return;
        }
        try {
            setRoomLoading(true);
            setAccessDenied(false);
            const res = await api.get(`/rooms/${id}/context`);
            const data = res.data || {};
            // snake_case/camelCase 둘 다 허용
            const hostEmail = data.hostUserEmail ?? data.host_user_email ?? "";
            if (data.myRole === "NONE") {
                setRoom(null);
                setAccessDenied(true);
            } else {
                // OWNER인데 hostUserEmail이 비어 있으면 현재 사용자 이메일로 채움 (스터디장 권한 유지)
                const userEmail = user?.email ?? "";
                const resolvedHostEmail = hostEmail || (data.myRole === "OWNER" ? userEmail : "");
                setRoom({
                    roomId: data.roomId,
                    title: data.title,
                    hostUserEmail: resolvedHostEmail,
                });
                setAccessDenied(false);
            }
        } catch (err) {
            console.error("방 정보 가져오기 실패", err);
            setRoom(null);
            // 403(권한 없음)일 때만 접근 거부, 그 외(네트워크/500 등)는 거부 플래그 안 함
            setAccessDenied(err.response?.status === 403);
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

    // 사용자 정보 새로고침
    const refreshUser = useCallback(() => {
        fetchUserInfo();
    }, [fetchUserInfo]);

    // 방별 마이페이지 새로고침
    const refreshRoom = useCallback(() => {
        fetchRoomMyPage(roomId);
    }, [fetchRoomMyPage, roomId]);

    // 닉네임 변경 이벤트 수신 (RoomMyPage 저장 후 LMSHeader 즉시 반영용)
    useEffect(() => {
        const onRoomNickUpdated = (e) => {
            const detail = e?.detail || {};
            const targetRoomId = (detail.roomId ?? "").toString().trim();
            const nextNick = (detail.roomNickname || "").trim();
            const current = (roomId ?? "").toString().trim();
            // roomId 비교 (대소문자/공백 무시)
            if (!targetRoomId || !current) return;
            if (targetRoomId.toLowerCase() !== current.toLowerCase()) return;
            setRoomNickname(nextNick);
            // 서버에서 최신 방별 닉네임 재조회 (이중 적용 보장)
            fetchRoomMyPage(roomId);
        };

        const onUserNickUpdated = (e) => {
            // 전역 닉네임 변경 시, 즉시 user.nickname을 패치하고
            // 이후 백엔드 상태와 동기화를 위해 /users/me 재조회
            const next = (
                e?.detail?.nickname ||
                sessionStorage.getItem("nickname") ||
                localStorage.getItem("nickname") ||
                ""
            ).trim();

            if (next) {
                setUser((prev) =>
                    prev ? { ...prev, nickname: next } : prev
                );
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

    // 표시용 이름 (헤더용: nickname(name) 형식)
    const displayName = user
        ? (() => {
              const roomNick = (roomNickname && roomNickname.trim()) || "";
              const nickname = (user.nickname && user.nickname.trim()) || "";
              const name = (user.name && user.name.trim()) || "";
              // ✅ 방별 닉네임이 있으면 최우선
              if (roomNick.length > 0 && name.length > 0) {
                  return `${roomNick}(${name})`;
              } else if (roomNick.length > 0) {
                  return roomNick;
              } else if (nickname.length > 0 && name.length > 0) {
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

    // isHost 계산: user.email === room.hostUserEmail
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
        error,
        refreshUser,
        refreshRoom,
        displayName,
        isHost,
        // 편의 메서드들
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
