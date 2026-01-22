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

    // 회의 시작
    const startMeeting = useCallback((newRoomId, newSubjectId) => {
        setIsInMeeting(true);
        setIsPipMode(false);
        setRoomId(newRoomId);
        setSubjectId(newSubjectId);
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

    const value = {
        // 상태
        isInMeeting,
        isPipMode,
        roomId,
        subjectId,
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
    };

    return (
        <MeetingContext.Provider value={value}>
            {children}
        </MeetingContext.Provider>
    );
};

export default MeetingContext;
