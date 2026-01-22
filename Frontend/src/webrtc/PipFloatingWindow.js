import { useRef, useState, useEffect } from "react";
import { Mic, MicOff, Video, VideoOff, Phone, Maximize2 } from "lucide-react";
import { useMeeting } from "./MeetingContext";
import "./PipFloatingWindow.css";

const PipFloatingWindow = ({ onReturnToMeeting }) => {
    const { micOn, setMicOn, camOn, setCamOn, endMeeting, getMeetingState } = useMeeting();
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 260 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const [hasStream, setHasStream] = useState(false);

    const [meetingState, setMeetingState] = useState(() => getMeetingState());

    useEffect(() => {
        const id = setInterval(() => {
            setMeetingState(getMeetingState());
        }, 200);
        return () => clearInterval(id);
    }, []);
    
    const pipUser = meetingState?.pipTargetUser;

    const stream =
        pipUser?.isScreenSharing && pipUser?.screenStream
            ? pipUser.screenStream
            : pipUser?.isMe
                ? meetingState?.localStream
                : pipUser?.stream;

    useEffect(() => {
        if (!videoRef.current) return;

        if (stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
            setHasStream(true);
        } else {
            videoRef.current.srcObject = null;
            setHasStream(false);
        }
    }, [stream]);

    // 드래그 시작
    const handleMouseDown = (e) => {
        if (e.target.closest(".pip-controls")) return;

        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };

    // 드래그 중
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 240, e.clientY - dragOffset.current.y));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    // 마이크 토글
    const toggleMic = () => {
        const meetingState = getMeetingState();
        if (meetingState.localStream) {
            const audioTrack = meetingState.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !micOn;
            }
        }
        setMicOn(!micOn);
    };

    // 카메라 토글
    const toggleCam = () => {
        const meetingState = getMeetingState();
        if (meetingState.localStream) {
            const videoTrack = meetingState.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !camOn;
            }
        }
        setCamOn(!camOn);
    };

    // 회의 종료
    const handleEndMeeting = () => {
        endMeeting();
        // 회의 종료 후 LMS 메인으로 이동
        window.location.href = "/LMS";
    };

    return (
        <div
            ref={containerRef}
            className={`pip-floating-window ${isDragging ? "dragging" : ""}`}
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleMouseDown}
        >
            <div className="pip-video-container">
                {/* 비디오 요소는 항상 렌더링 (스트림 유지) */}
                <video
                    ref={videoRef}
                    className="pip-video"
                    playsInline
                    muted
                    style={{ display: camOn && hasStream ? "block" : "none" }}
                />

                {/* 카메라 꺼짐 또는 스트림 없을 때 오버레이 */}
                {(!camOn || !hasStream) && (
                    <div className="pip-video-off">
                        <VideoOff size={32} />
                        <span>{!hasStream ? "연결 중..." : "카메라 꺼짐"}</span>
                    </div>
                )}

                <div className="pip-status-badge">
                    <span className="pip-live-dot" />
                    <span>회의 중</span>
                </div>
            </div>

            <div className="pip-controls">
                <button
                    className={`pip-control-btn ${!micOn ? "off" : ""}`}
                    onClick={toggleMic}
                    title={micOn ? "마이크 끄기" : "마이크 켜기"}
                >
                    {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button
                    className={`pip-control-btn ${!camOn ? "off" : ""}`}
                    onClick={toggleCam}
                    title={camOn ? "카메라 끄기" : "카메라 켜기"}
                >
                    {camOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

                <button
                    className="pip-control-btn return"
                    onClick={onReturnToMeeting}
                    title="회의로 돌아가기"
                >
                    <Maximize2 size={18} />
                </button>

                <button
                    className="pip-control-btn end"
                    onClick={handleEndMeeting}
                    title="회의 종료"
                >
                    <Phone size={18} />
                </button>
            </div>
        </div>
    );
};

export default PipFloatingWindow;
