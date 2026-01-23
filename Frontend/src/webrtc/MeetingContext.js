import { createContext, useContext, useRef, useState, useCallback } from "react";

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

    const enterPipMode = useCallback(() => {
        setIsPipMode(true);
    }, []);

    const exitPipMode = useCallback(() => {
        setIsPipMode(false);
    }, []);

    return (
        <MeetingContext.Provider
            value={{
                isInMeeting,
                isPipMode,
                roomId: roomIdRef.current,
                startMeeting,
                endMeeting,
                enterPipMode,
                exitPipMode,
            }}
        >
            {children}
        </MeetingContext.Provider>
    );
};

export const useMeeting = () => {
    const ctx = useContext(MeetingContext);
    if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
    return ctx;
};
