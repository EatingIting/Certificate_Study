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

    // 🔥 아바타를 canvas로 그려서 MediaStream으로 변환하는 함수
    // 커스텀 PiP에서는 이름을 표시하지 않음 (showName = false)
    const createAvatarStream = useCallback((name, width = 640, height = 480, showName = false) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // 배경색 (회색)
        ctx.fillStyle = "#f3f4f6";
        ctx.fillRect(0, 0, width, height);

        // 아바타 원 그리기
        const centerX = width / 2;
        // showName이 true면 이름 공간을 위해 위로 이동, false면 중앙에 배치
        const centerY = showName ? height / 2 - 20 : height / 2;
        const radius = Math.min(width, height) * 0.25;

        // 그라데이션 배경
        const gradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        gradient.addColorStop(0, "#eef6f0");
        gradient.addColorStop(1, "#cfe8d6");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // 텍스트 (이니셜)
        const initials = (name || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
        
        ctx.fillStyle = "#97c793";
        ctx.font = `bold ${radius * 0.8}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, centerX, centerY);

        // 이름 텍스트 (아바타 아래) - showName이 true일 때만 표시
        if (showName) {
            const displayName = name || "참가자";
            ctx.fillStyle = "#374151"; // 어두운 회색
            // 폰트 크기를 크게 설정 (최소 20px, 또는 width의 5% 중 큰 값)
            const fontSize = Math.max(20, width * 0.05);
            ctx.font = `bold ${fontSize}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            // 텍스트가 너무 길면 잘라내기
            const maxWidth = width * 0.85;
            let finalName = displayName;
            const metrics = ctx.measureText(displayName);
            if (metrics.width > maxWidth) {
                // 텍스트가 너무 길면 "..." 추가
                let truncated = displayName;
                while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 0) {
                    truncated = truncated.slice(0, -1);
                }
                finalName = truncated + "...";
            }
            ctx.fillText(finalName, centerX, centerY + radius + 15);
        }

        // Canvas를 MediaStream으로 변환
        const stream = canvas.captureStream(30); // 30fps
        return stream;
    }, []);

    // 🔥 스트림 유효성 검사 함수 (enabled 체크 제거 - clone/PIP 스트림에서 false일 수 있음)
    const isStreamValid = useCallback((s) => {
        if (!s) return false;
        const tracks = s.getVideoTracks();
        // 🔥 readyState만 체크 (enabled는 브라우저/clone 상황에서 false가 될 수 있음)
        return tracks.length > 0 && tracks.some(t => t.readyState === "live");
    }, []);

    // 🔥 DOM에서 유효한 스트림 찾기
    const findValidStreamFromDOM = useCallback(() => {
        // ⚠️ 중요: 전역의 모든 video를 훑으면
        // - 숨겨진 pip video
        // - 로컬 카메라 전처리용 hidden video
        // 등을 잡아버려 PiP가 엉뚱한 스트림(=생얼)로 바뀔 수 있음.
        // 그래서 "회의 타일(video-tile) 내부의 video-element"만 대상으로 한다.

        const pickFirstValid = (selector) => {
            const nodes = document.querySelectorAll(selector);
            for (const v of nodes) {
                if (v === videoRef.current) continue; // FloatingPip 자신의 video 제외
                if (!v?.srcObject) continue;
                const tracks = v.srcObject.getVideoTracks();
                if (tracks.length > 0 && tracks.some((t) => t.readyState === "live")) return v;
            }
            return null;
        };

        // 1) 상대 화면공유 우선
        let video =
            pickFirstValid('.video-tile:not(.me) video.video-element.screen') ||
            // 2) 메인 스테이지(발표자/선택된 타일)
            pickFirstValid('video[data-main-video="main"]') ||
            // 3) 상대 카메라
            pickFirstValid('.video-tile:not(.me) video.video-element') ||
            // 4) 최후: 타일 내부라면 누구든(로컬 포함)
            pickFirstValid('.video-tile video.video-element');

        if (video?.srcObject) {
            const tile = video.closest(".video-tile");
            const newPeerId = tile?.dataset?.peerId || video?.dataset?.peerId || "";
            const newPeerName =
                tile?.dataset?.peerName ||
                video?.dataset?.peerName ||
                tile?.querySelector(".stream-label")?.textContent ||
                peerName;
            return { stream: video.srcObject, peerName: newPeerName, peerId: newPeerId };
        }

        return null;
    }, [peerName]);

    // 비디오 스트림 연결 (video 요소가 준비된 후 실행)
    useEffect(() => {
        // 초기화되지 않으면 video가 렌더링되지 않음
        if (!isInitialized) return;

        console.log("[FloatingPip] 스트림 연결 시도", { stream, videoRef: videoRef.current });

        if (videoRef.current) {
            let finalStream = stream;
            
            // 🔥 스트림이 없거나 비디오 트랙이 없으면 아바타 스트림 생성 (커스텀 PiP이므로 이름 표시 안 함)
            if (!finalStream || !isStreamValid(finalStream)) {
                console.log("[FloatingPip] 비디오 스트림이 없어서 아바타 스트림 생성");
                finalStream = createAvatarStream(peerName, 640, 480, false);
            } else {
                const videoTracks = finalStream.getVideoTracks();
                console.log("[FloatingPip] 비디오 트랙:", videoTracks.map(t => ({
                    id: t.id,
                    enabled: t.enabled,
                    readyState: t.readyState,
                    muted: t.muted
                })));
            }

            // 🔥 stream을 그대로 사용 (track 교체/동기화 시 검은화면 방지)
            videoRef.current.srcObject = finalStream;
            lastValidStreamRef.current = finalStream;

            videoRef.current.play()
                .then(() => console.log("[FloatingPip] ✅ 비디오 재생 성공"))
                .catch((err) => console.error("[FloatingPip] ❌ 비디오 재생 실패:", err));
        }
    }, [stream, isInitialized, peerName, isStreamValid, createAvatarStream]);

    // 🔥 스트림 상태 모니터링 (track이 ended되면 새 스트림 찾기)
    useEffect(() => {
        if (!isInitialized) return;

        // 이전 interval 정리
        if (streamCheckIntervalRef.current) {
            clearInterval(streamCheckIntervalRef.current);
        }

        const checkStreamHealth = () => {
            // 🔥 백그라운드일 때는 스트림 체크를 건너뛰기 (브라우저가 비디오를 일시 중지할 수 있음)
            if (document.hidden) {
                return;
            }

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
                        onStreamInvalid(found.stream, found.peerName, found.peerId);
                    }
                }
            }
        };

        // 500ms마다 스트림 상태 체크 (백그라운드에서는 자동으로 건너뛰어짐)
        streamCheckIntervalRef.current = setInterval(checkStreamHealth, 500);

        // track ended 이벤트 리스너
        const handleTrackEnded = () => {
            // 백그라운드일 때는 즉시 체크하지 않음
            if (document.hidden) {
                return;
            }
            console.log("[FloatingPip] 🔴 track ended 이벤트 감지");
            checkStreamHealth();
        };

        // 현재 스트림의 모든 track에 ended 리스너 등록
        if (stream) {
            stream.getTracks().forEach(track => {
                track.addEventListener("ended", handleTrackEnded);
            });
        }

        // 🔥 Page Visibility API: 탭이 다시 보일 때 비디오 재생
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                const video = videoRef.current;
                if (video && video.paused && video.srcObject) {
                    console.log("[FloatingPip] 탭이 다시 보임, 비디오 재생 시도");
                    video.play().catch((err) => {
                        console.warn("[FloatingPip] 비디오 재생 실패:", err);
                    });
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (streamCheckIntervalRef.current) {
                clearInterval(streamCheckIntervalRef.current);
            }
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.removeEventListener("ended", handleTrackEnded);
                });
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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
                    onStreamInvalid(found.stream, found.peerName, found.peerId);
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
