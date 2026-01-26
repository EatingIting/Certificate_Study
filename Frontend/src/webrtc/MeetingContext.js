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
            return false;
        }
        if (document.pictureInPictureElement) {
            console.log("[PiP] 이미 PiP 모드입니다.");
            return true;
        }

        // 🔥 User gesture 컨텍스트 유지를 위해 즉시 PiP 요청
        // metadata 대기 없이 바로 시도 (대부분의 경우 이미 로드되어 있음)
        
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
            // 🔥 즉시 PiP 요청 (user gesture 보존)
            await videoEl.requestPictureInPicture();
            setIsPipMode(true);
            console.log("[PiP] PiP 모드 활성화됨");
            return true;
        } catch (error) {
            console.error("[PiP] PiP 요청 실패:", error);
            document.removeEventListener("leavepictureinpicture", handleLeavePiP);
            
            // readyState가 부족하면 메타데이터 로드 후 재시도 (이벤트 기반으로)
            if (videoEl.readyState < 1) {
                console.log("[PiP] 메타데이터 부족 - 이벤트 기반 재시도 대기");
                // 이 경우는 user gesture가 이미 손실됨, 나중에 다시 시도해야 함
            }
            return false;
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
