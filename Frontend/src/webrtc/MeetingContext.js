import {
    createContext,
    useContext,
    useRef,
    useState,
    useCallback,
} from "react";

const MeetingContext = createContext(null);

export const MeetingProvider = ({ children }) => {
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [isPipMode, setIsPipMode] = useState(false);
    const [roomId, setRoomId] = useState(null);

    const startMeeting = useCallback((roomId, subjectId) => {
        setRoomId(roomId);
        setIsInMeeting(true);
    
        sessionStorage.setItem("pip.roomId", roomId);
        sessionStorage.setItem("pip.subjectId", subjectId);
    }, []);

    const endMeeting = useCallback(() => {
        setRoomId(null);
        setIsInMeeting(false);
        setIsPipMode(false);
    }, []);

    const requestBrowserPip = async (videoEl) => {
        if (!videoEl) {
            console.warn("[PiP] 비디오 요소가 없습니다.");
            return;
        }
        if (document.pictureInPictureElement) {
            console.log("[PiP] 이미 PiP 모드입니다.");
            return;
        }

        // ✅ 비디오 메타데이터가 로드될 때까지 대기
        if (videoEl.readyState < 1) { // HAVE_NOTHING (0) → HAVE_METADATA (1) 이상 필요
            console.log("[PiP] 비디오 메타데이터 로드 대기 중...");
            
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("비디오 메타데이터 로드 타임아웃"));
                    }, 5000); // 5초 타임아웃

                    const onLoadedMetadata = () => {
                        clearTimeout(timeout);
                        videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
                        resolve();
                    };

                    videoEl.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
                    
                    // 이미 로드되어 있으면 즉시 resolve
                    if (videoEl.readyState >= 1) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            } catch (err) {
                console.error("[PiP] 비디오 메타데이터 로드 실패:", err);
                return; // 에러 발생 시 PiP 요청 중단
            }
        }

        const handleLeavePiP = () => {
            console.log("[PiP] leavepictureinpicture");

            setIsPipMode(false);

            // 🔥 오직 이벤트만 발행
            window.dispatchEvent(
                new CustomEvent("meeting:pip-exit")
            );
        };

        document.addEventListener(
            "leavepictureinpicture",
            handleLeavePiP,
            { once: true }
        );

        try {
            await videoEl.requestPictureInPicture();
            setIsPipMode(true);
            console.log("[PiP] PiP 모드 활성화됨");
        } catch (error) {
            console.error("[PiP] PiP 요청 실패:", error);
            // 에러 발생 시 사용자에게 알리지 않고 조용히 실패 처리
        }
    };

    const exitBrowserPip = async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(() => {});
        }
    };

    return (
        <MeetingContext.Provider
            value={{
                isInMeeting,
                isPipMode,
                roomId,
                startMeeting,
                endMeeting,
                requestBrowserPip,
            }}
        >
            {children}
        </MeetingContext.Provider>
    );
};

export const useMeeting = () => {
    const ctx = useContext(MeetingContext);
    if (!ctx) {
        throw new Error("useMeeting must be used within MeetingProvider");
    }
    return ctx;
};
