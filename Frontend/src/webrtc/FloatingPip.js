import React, { useRef, useState, useEffect, useCallback } from "react";
import "./FloatingPip.css";

const FloatingPip = ({
    stream,
    peerName = "참가자",
    onReturn,  // 회의방 복귀 콜백
    onLeave,   // 방 나가기 콜백
    onStreamInvalid, // 🔥 스트림이 무효할 때 새 스트림 요청 콜백
}) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);

    // 드래그 상태
    const [position, setPosition] = useState({ x: null, y: null });
    const [isDragging, setIsDragging] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionRef = useRef({ x: 0, y: 0 });

    // 🔥 스트림 모니터링용 ref
    const streamCheckIntervalRef = useRef(null);
    const lastValidStreamRef = useRef(null);

    // 초기 위치 설정 (오른쪽 하단)
    useEffect(() => {
        if (position.x === null) {
            const padding = 20;
            setPosition({
                x: window.innerWidth - 320 - padding,
                y: window.innerHeight - 200 - padding
            });
            setIsInitialized(true);
        }
    }, [position.x]);

    // 🔥 스트림 유효성 검사 함수 (enabled 체크 제거 - clone/PIP 스트림에서 false일 수 있음)
    const isStreamValid = useCallback((s) => {
        if (!s) return false;
        const tracks = s.getVideoTracks();
        // 🔥 readyState만 체크 (enabled는 브라우저/clone 상황에서 false가 될 수 있음)
        return tracks.length > 0 && tracks.some(t => t.readyState === "live");
    }, []);

    // 🔥 DOM에서 유효한 스트림 찾기
    const findValidStreamFromDOM = useCallback(() => {
        // 1. data-main-video="main" 속성을 가진 video 찾기
        let video = document.querySelector('video[data-main-video="main"]');

        // 2. 없으면 srcObject가 있는 video 찾기 (자기 자신 제외)
        if (!video || !video.srcObject) {
            const allVideos = document.querySelectorAll('video');
            for (const v of allVideos) {
                // FloatingPip의 video는 제외
                if (v === videoRef.current) continue;

                if (v.srcObject) {
                    const tracks = v.srcObject.getVideoTracks();
                    if (tracks.length > 0 && tracks.some(t => t.readyState === "live")) {
                        video = v;
                        break;
                    }
                }
            }
        }

        if (video?.srcObject) {
            const newPeerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || peerName;
            return { stream: video.srcObject, peerName: newPeerName };
        }

        return null;
    }, [peerName]);

    // 비디오 스트림 연결 (video 요소가 준비된 후 실행)
    useEffect(() => {
        // 초기화되지 않으면 video가 렌더링되지 않음
        if (!isInitialized) return;

        console.log("[FloatingPip] 스트림 연결 시도", { stream, videoRef: videoRef.current });

        if (videoRef.current && stream) {
            const videoTracks = stream.getVideoTracks();
            console.log("[FloatingPip] 비디오 트랙:", videoTracks.map(t => ({
                id: t.id,
                enabled: t.enabled,
                readyState: t.readyState,
                muted: t.muted
            })));

            // 🔥 stream을 그대로 사용 (track 교체/동기화 시 검은화면 방지)
            videoRef.current.srcObject = stream;
            lastValidStreamRef.current = stream;

            videoRef.current.play()
                .then(() => console.log("[FloatingPip] ✅ 비디오 재생 성공"))
                .catch((err) => console.error("[FloatingPip] ❌ 비디오 재생 실패:", err));
        }
    }, [stream, isInitialized]);

    // 🔥 스트림 상태 모니터링 (track이 ended되면 새 스트림 찾기)
    useEffect(() => {
        if (!isInitialized) return;

        // 이전 interval 정리
        if (streamCheckIntervalRef.current) {
            clearInterval(streamCheckIntervalRef.current);
        }

        const checkStreamHealth = () => {
            const video = videoRef.current;
            if (!video) return;

            const currentStream = video.srcObject;

            // 스트림이 무효한지 확인
            if (!isStreamValid(currentStream)) {
                console.log("[FloatingPip] ⚠️ 스트림 무효 감지, 새 스트림 찾기 시도");

                // DOM에서 유효한 스트림 찾기
                const found = findValidStreamFromDOM();
                if (found && isStreamValid(found.stream)) {
                    console.log("[FloatingPip] ✅ 새 스트림 발견, 재연결");
                    video.srcObject = found.stream;
                    lastValidStreamRef.current = found.stream;
                    video.play().catch(() => { });

                    // 부모에게 알림 (선택적)
                    if (onStreamInvalid) {
                        onStreamInvalid(found.stream, found.peerName);
                    }
                }
            }
        };

        // 500ms마다 스트림 상태 체크
        streamCheckIntervalRef.current = setInterval(checkStreamHealth, 500);

        // track ended 이벤트 리스너
        const handleTrackEnded = () => {
            console.log("[FloatingPip] 🔴 track ended 이벤트 감지");
            checkStreamHealth();
        };

        // 현재 스트림의 모든 track에 ended 리스너 등록
        if (stream) {
            stream.getTracks().forEach(track => {
                track.addEventListener("ended", handleTrackEnded);
            });
        }

        return () => {
            if (streamCheckIntervalRef.current) {
                clearInterval(streamCheckIntervalRef.current);
            }
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.removeEventListener("ended", handleTrackEnded);
                });
            }
        };
    }, [stream, isInitialized, isStreamValid, findValidStreamFromDOM, onStreamInvalid]);

    // 드래그 시작
    const handleMouseDown = useCallback((e) => {
        // 버튼 클릭은 드래그로 처리하지 않음
        if (e.target.closest('.pip-btn')) return;

        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionRef.current = { ...position };
        e.preventDefault();
    }, [position]);

    // 드래그 중
    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;

        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        let newX = positionRef.current.x + dx;
        let newY = positionRef.current.y + dy;

        // 화면 밖으로 나가지 않도록 제한
        const padding = 10;
        const width = 300;
        const height = 180;

        newX = Math.max(padding, Math.min(window.innerWidth - width - padding, newX));
        newY = Math.max(padding, Math.min(window.innerHeight - height - padding, newY));

        setPosition({ x: newX, y: newY });
    }, [isDragging]);

    // 드래그 종료
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 전역 마우스 이벤트 등록
    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // 터치 이벤트 (모바일)
    const handleTouchStart = useCallback((e) => {
        if (e.target.closest('.pip-btn')) return;

        const touch = e.touches[0];
        setIsDragging(true);
        dragStartRef.current = { x: touch.clientX, y: touch.clientY };
        positionRef.current = { ...position };
    }, [position]);

    const handleTouchMove = useCallback((e) => {
        if (!isDragging) return;

        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;

        let newX = positionRef.current.x + dx;
        let newY = positionRef.current.y + dy;

        const padding = 10;
        const width = 300;
        const height = 180;

        newX = Math.max(padding, Math.min(window.innerWidth - width - padding, newX));
        newY = Math.max(padding, Math.min(window.innerHeight - height - padding, newY));

        setPosition({ x: newX, y: newY });
    }, [isDragging]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 🔥 스트림이 없을 때 마운트 직후 자동으로 스트림 찾기
    useEffect(() => {
        if (!isInitialized) return;

        // 스트림이 이미 있고 유효하면 스킵
        if (stream && isStreamValid(stream)) return;

        console.log("[FloatingPip] ⚠️ 초기 스트림 없음, DOM에서 자동 탐색");

        // 약간의 딜레이 후 찾기 (React 렌더링 대기)
        const timeoutId = setTimeout(() => {
            const found = findValidStreamFromDOM();
            if (found && isStreamValid(found.stream)) {
                console.log("[FloatingPip] ✅ 초기 스트림 자동 탐색 성공");
                const clonedStream = found.stream.clone ? found.stream.clone() : found.stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = clonedStream;
                    lastValidStreamRef.current = found.stream;
                    videoRef.current.play().catch(() => { });
                }
                if (onStreamInvalid) {
                    onStreamInvalid(found.stream, found.peerName);
                }
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [isInitialized, stream, isStreamValid, findValidStreamFromDOM, onStreamInvalid]);

    // 복귀 버튼 클릭
    const handleReturn = () => {
        if (onReturn) {
            onReturn();
        }
    };

    // 나가기 버튼 클릭
    const handleLeave = () => {
        if (onLeave) {
            onLeave();
        }
    };

    // 🔥 위치가 초기화되지 않았으면 렌더링 안 함 (stream 체크 제거 - 자동 탐색 지원)
    if (position.x === null) return null;

    return (
        <div
            ref={containerRef}
            className={`floating-pip ${isDragging ? "dragging" : ""}`}
            style={{
                left: position.x,
                top: position.y,
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* 비디오 영역 */}
            <div className="pip-video-wrapper">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                />

                {/* 참가자 이름 */}
                <div className="pip-name-badge">{peerName}</div>

                {/* 상단 컨트롤 */}
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        display: 'flex',
                        gap: '6px',
                        zIndex: 100,
                    }}
                >
                    <button
                        onClick={handleReturn}
                        title="회의방으로 복귀"
                        style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(59, 130, 246, 0.9)',
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 'bold',
                        }}
                    >
                        ↩
                    </button>
                    <button
                        onClick={handleLeave}
                        title="회의 나가기"
                        style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(239, 68, 68, 0.9)',
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 'bold',
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* 드래그 힌트 */}
            <div className="pip-drag-hint">드래그하여 이동</div>
        </div>
    );
};

export default FloatingPip;
