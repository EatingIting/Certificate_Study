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

    const roomIdRef = useRef(null);

    const startMeeting = useCallback((roomId) => {
        roomIdRef.current = roomId;
        setIsInMeeting(true);
    }, []);

    const endMeeting = useCallback(() => {
        roomIdRef.current = null;
        setIsInMeeting(false);
        setIsPipMode(false);
    }, []);

    const requestBrowserPip = async (videoEl) => {
        if (!videoEl) return;
        if (document.pictureInPictureElement) return;

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

        await videoEl.requestPictureInPicture();
        setIsPipMode(true);
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
                roomId: roomIdRef.current,
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
