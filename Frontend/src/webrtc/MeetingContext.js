import { createContext, useContext, useState, useCallback, useRef } from "react";

const MeetingContext = createContext(null);

export const useMeeting = () => {
    const context = useContext(MeetingContext);
    if (!context) {
        throw new Error("useMeeting must be used within MeetingProvider");
    }
    return context;
};

export const MeetingProvider = ({ children }) => {
    // 회의 활성 상태
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [isPipMode, setIsPipMode] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const [subjectId, setSubjectId] = useState(null);
    const [meetingUrl, setMeetingUrl] = useState(null);  // 회의 페이지 URL 저장

    // 미디어 상태 (PiP 전환 시에도 유지)
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);

    // 스트림 및 연결 정보 (복원용)
    const meetingStateRef = useRef({
        localStream: null,
        participants: [],
        device: null,
        sendTransport: null,
        recvTransport: null,
        producers: { audio: null, video: null },
        consumers: new Map(),
    });

    // PIP 모드에서 유지된 연결을 정리하는 함수
    const cleanupFunctionRef = useRef(null);

    // 회의 시작
    const startMeeting = useCallback((newRoomId, newSubjectId, url) => {
        setIsInMeeting(true);
        setIsPipMode(false);
        setRoomId(newRoomId);
        setSubjectId(newSubjectId);
        // URL이 제공되면 저장, 아니면 현재 경로 사용
        setMeetingUrl(url || window.location.pathname);
    }, []);

    // PiP 모드로 전환 (다른 페이지 이동 시)
    const enterPipMode = useCallback(() => {
        if (isInMeeting) {
            setIsPipMode(true);
        }
    }, [isInMeeting]);

    // PiP에서 회의로 복귀
    const exitPipMode = useCallback(() => {
        setIsPipMode(false);
    }, []);

    const requestPipIfPossible = async () => {
        if (document.pictureInPictureElement) return;

        const video = document.querySelector("video");
        if (!video) return;

        try {
            await video.requestPictureInPicture();
        } catch (e) {
            console.warn("[PiP] request failed", e);
        }
    };

    // 회의 종료
    const endMeeting = useCallback(() => {
        // 스트림 정리
        if (meetingStateRef.current.localStream) {
            meetingStateRef.current.localStream.getTracks().forEach((track) => {
                track.stop();
            });
        }

        setIsInMeeting(false);
        setIsPipMode(false);
        setRoomId(null);
        setSubjectId(null);
        setMeetingUrl(null);
        setMicOn(true);
        setCamOn(true);
        meetingStateRef.current = {
            localStream: null,
            participants: [],
            device: null,
            sendTransport: null,
            recvTransport: null,
            producers: { audio: null, video: null },
            consumers: new Map(),
        };
    }, []);

    // 미디어 상태 저장 (MeetingPage에서 호출)
    const saveMeetingState = useCallback((state) => {
        meetingStateRef.current = { ...meetingStateRef.current, ...state };
    }, []);

    // 미디어 상태 불러오기
    const getMeetingState = useCallback(() => {
        return meetingStateRef.current;
    }, []);

    // cleanup 함수 저장
    const saveCleanupFunction = useCallback((fn) => {
        cleanupFunctionRef.current = fn;
    }, []);

    // cleanup 함수 실행 (PIP 복귀 시 사용)
    const executeCleanup = useCallback(() => {
        if (cleanupFunctionRef.current) {
            console.log("[MeetingContext] Executing saved cleanup function");
            cleanupFunctionRef.current();
            cleanupFunctionRef.current = null;
        }
    }, []);

    const value = {
        // 상태
        isInMeeting,
        isPipMode,
        roomId,
        subjectId,
        meetingUrl,
        micOn,
        camOn,

        // 상태 변경
        setMicOn,
        setCamOn,

        // 액션
        startMeeting,
        enterPipMode,
        exitPipMode,
        endMeeting,
        saveMeetingState,
        getMeetingState,
        saveCleanupFunction,
        executeCleanup,
        requestPipIfPossible,
    };

    return (
        <MeetingContext.Provider value={value}>
            {children}
        </MeetingContext.Provider>
    );
};

export default MeetingContext;
