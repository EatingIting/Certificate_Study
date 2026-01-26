import {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
} from "react";

const MeetingContext = createContext(null);

export const MeetingProvider = ({ children }) => {
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [isPipMode, setIsPipMode] = useState(false);
    const [isBrowserPipMode, setIsBrowserPipMode] = useState(false);
    const [roomId, setRoomId] = useState(null);

    // 커스텀 PIP 상태
    const [customPipData, setCustomPipData] = useState(null);
    // { stream: MediaStream, peerName: string }

    // 브라우저 PIP용 스트림/이름 저장
    const pendingPipDataRef = useRef(null);
    
    // 🔥 브라우저 PIP용 숨겨진 video element ref
    const pipVideoRef = useRef(null);

    const startMeeting = useCallback((roomId, subjectId) => {
        setRoomId(roomId);
        setIsInMeeting(true);

        sessionStorage.setItem("pip.roomId", roomId);
        sessionStorage.setItem("pip.subjectId", subjectId);
    }, []);

    // polling interval ref
    const pipPollingRef = useRef(null);

    // 중복 전환 방지 플래그
    const isTransitioningRef = useRef(false);

    const endMeeting = useCallback(() => {
        setRoomId(null);
        setIsInMeeting(false);
        setIsPipMode(false);
        setIsBrowserPipMode(false);
        setCustomPipData(null);
        pendingPipDataRef.current = null;

        // polling 정리
        if (pipPollingRef.current) {
            clearInterval(pipPollingRef.current);
            pipPollingRef.current = null;
        }
    }, []);

    // 🔥 스트림 유효성 검사 헬퍼 함수
    const isStreamValidCheck = useCallback((s) => {
        if (!s) return false;
        const tracks = s.getVideoTracks();
        return tracks.length > 0 && tracks.some(t => t.readyState === "live" && t.enabled);
    }, []);

    // 🔥 DOM에서 유효한 스트림 찾기 (개선된 버전)
    const findValidStreamFromDOM = useCallback(() => {
        // 1. data-main-video="main" 속성을 가진 video 찾기
        let video = document.querySelector('video[data-main-video="main"]');
        
        // 2. 해당 video의 스트림이 유효한지 확인
        if (video?.srcObject && isStreamValidCheck(video.srcObject)) {
            const peerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
            return { stream: video.srcObject, peerName };
        }
        
        // 3. 모든 video 요소 확인 (srcObject가 있고 유효한 track이 있는 것)
        const allVideos = document.querySelectorAll('video');
        for (const v of allVideos) {
            if (v.srcObject && isStreamValidCheck(v.srcObject)) {
                const peerName = v.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
                return { stream: v.srcObject, peerName };
            }
        }
        
        return null;
    }, [isStreamValidCheck]);

    // 🔥 브라우저 PIP 종료 시 커스텀 PIP로 전환하는 공통 함수
    const switchToCustomPip = useCallback(() => {
        // 중복 호출 방지
        if (isTransitioningRef.current) {
            console.log("[MeetingContext] 이미 전환 중, 무시");
            return;
        }
        isTransitioningRef.current = true;

        console.log("[MeetingContext] ✅ 브라우저 PIP 종료 감지");

        // 폴링 정리
        if (pipPollingRef.current) {
            clearInterval(pipPollingRef.current);
            pipPollingRef.current = null;
        }

        setIsBrowserPipMode(false);

        // 🔥 1순위: 숨겨진 PIP video의 스트림 (브라우저 PIP에서 사용하던 스트림)
        const hiddenVideoStream = pipVideoRef.current?.srcObject;
        const isHiddenStreamValid = isStreamValidCheck(hiddenVideoStream);
        console.log("[MeetingContext] 숨겨진 video 스트림 유효성:", isHiddenStreamValid);

        if (isHiddenStreamValid) {
            const peerName = pendingPipDataRef.current?.peerName || "참가자";
            console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (숨겨진 video 스트림)");
            setCustomPipData({ stream: hiddenVideoStream, peerName });
            setIsPipMode(true);
            pendingPipDataRef.current = { stream: hiddenVideoStream, peerName };
            setTimeout(() => { isTransitioningRef.current = false; }, 100);
            return;
        }

        // 🔥 2순위: pending 스트림 (clone된 스트림)
        const pending = pendingPipDataRef.current;
        const isPendingValid = isStreamValidCheck(pending?.stream);
        console.log("[MeetingContext] pending 스트림 유효성:", isPendingValid);

        if (pending && isPendingValid) {
            console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (pending 스트림)");
            setCustomPipData({ stream: pending.stream, peerName: pending.peerName });
            setIsPipMode(true);
            setTimeout(() => { isTransitioningRef.current = false; }, 100);
            return;
        }

        // 🔥 3순위: DOM에서 스트림 찾기
        const domStream = findValidStreamFromDOM();
        console.log("[MeetingContext] DOM에서 찾은 스트림:", domStream ? "있음" : "없음");

        if (domStream) {
            console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (DOM 스트림)");
            setCustomPipData({ stream: domStream.stream, peerName: domStream.peerName });
            setIsPipMode(true);
            pendingPipDataRef.current = domStream;
            setTimeout(() => { isTransitioningRef.current = false; }, 100);
            return;
        }

        // 🔥 모든 스트림이 무효 - MeetingPortal 렌더링 후 재시도
        console.log("[MeetingContext] 스트림 무효 - MeetingPortal 렌더링 후 재시도");
        setIsPipMode(true);

        // MeetingPage에 스트림 요청 이벤트 발생
        window.dispatchEvent(new CustomEvent("pip:request-stream"));

        // MeetingPortal 렌더링 대기 후 다시 찾기
        setTimeout(() => {
            // 다시 숨겨진 video 확인
            const retryHiddenStream = pipVideoRef.current?.srcObject;
            if (isStreamValidCheck(retryHiddenStream)) {
                console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (재시도 - 숨겨진 video)");
                setCustomPipData({ stream: retryHiddenStream, peerName: pending?.peerName || "참가자" });
                isTransitioningRef.current = false;
                return;
            }

            // DOM에서 다시 찾기
            const retryStream = findValidStreamFromDOM();
            if (retryStream) {
                console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (재시도 - DOM)");
                setCustomPipData({ stream: retryStream.stream, peerName: retryStream.peerName });
                pendingPipDataRef.current = retryStream;
            } else {
                console.log("[MeetingContext] ❌ 스트림을 찾을 수 없음");
                setCustomPipData({ stream: null, peerName: pending?.peerName || "참가자" });
            }
            
            isTransitioningRef.current = false;
        }, 300);
    }, [findValidStreamFromDOM, isStreamValidCheck]);

    // 브라우저 PIP 요청 (🔥 숨겨진 video 사용하여 페이지 이동 시에도 PIP 유지)
    const requestBrowserPip = useCallback(async (videoEl, stream, peerName) => {
        if (!stream) {
            console.warn("[MeetingContext] 스트림이 없습니다.");
            return false;
        }
        if (document.pictureInPictureElement) {
            console.log("[MeetingContext] 이미 PiP 모드입니다.");
            return true;
        }

        // 🔥 스트림을 clone하여 숨겨진 video에 연결 (페이지 이동해도 유지)
        const clonedStream = stream.clone();
        pendingPipDataRef.current = { stream: clonedStream, peerName };

        // 숨겨진 video element 사용
        const pipVideo = pipVideoRef.current;
        if (!pipVideo) {
            console.warn("[MeetingContext] 숨겨진 PIP video가 없습니다. 원본 video 사용");
            // fallback: 원본 video 사용
            try {
                await videoEl.requestPictureInPicture();
                setIsBrowserPipMode(true);
                setIsPipMode(true);
                startPolling();
                return true;
            } catch (error) {
                console.error("[MeetingContext] 브라우저 PIP 요청 실패:", error);
                return false;
            }
        }

        try {
            // 숨겨진 video에 clone된 스트림 연결
            pipVideo.srcObject = clonedStream;
            await pipVideo.play().catch(() => {});
            
            // video가 재생 가능한 상태인지 확인
            if (pipVideo.readyState < 2) {
                await new Promise((resolve) => {
                    const onCanPlay = () => {
                        pipVideo.removeEventListener("canplay", onCanPlay);
                        resolve();
                    };
                    pipVideo.addEventListener("canplay", onCanPlay);
                    setTimeout(resolve, 500);
                });
            }

            // 숨겨진 video에서 PIP 실행
            await pipVideo.requestPictureInPicture();
            setIsBrowserPipMode(true);
            setIsPipMode(true);
            console.log("🟢🟢🟢 브라우저 PIP 활성화됨 (숨겨진 video) 🟢🟢🟢");

            startPolling();
            return true;
        } catch (error) {
            console.error("[MeetingContext] 브라우저 PIP 요청 실패:", error);
            
            // fallback: 원본 video로 시도
            try {
                console.log("[MeetingContext] fallback: 원본 video로 PIP 시도");
                await videoEl.requestPictureInPicture();
                setIsBrowserPipMode(true);
                setIsPipMode(true);
                startPolling();
                return true;
            } catch (e) {
                console.error("[MeetingContext] 원본 video PIP도 실패:", e);
                pendingPipDataRef.current = null;
                return false;
            }
        }
    }, []);

    // 🔥 Polling 시작 함수 분리 (스트림 동기화 포함)
    const startPolling = useCallback(() => {
        if (pipPollingRef.current) {
            clearInterval(pipPollingRef.current);
        }

        console.log("🟢 Polling 시작 (200ms 간격)");

        pipPollingRef.current = setInterval(() => {
            const pipElement = document.pictureInPictureElement;
            const hasPip = !!pipElement;

            // 🔥 브라우저 PIP가 있을 때: MeetingPortal의 스트림을 숨겨진 video에 동기화
            if (hasPip && pipVideoRef.current) {
                // DOM에서 MeetingPortal의 video 찾기
                const portalVideo = document.querySelector('video[data-main-video="main"]');
                if (portalVideo?.srcObject && isStreamValidCheck(portalVideo.srcObject)) {
                    const currentPipStream = pipVideoRef.current.srcObject;
                    const portalStream = portalVideo.srcObject;
                    
                    // 스트림이 다르면 동기화 (새 스트림으로 업데이트)
                    if (currentPipStream !== portalStream) {
                        console.log("[MeetingContext] 🔄 숨겨진 video 스트림 동기화");
                        pipVideoRef.current.srcObject = portalStream;
                        pipVideoRef.current.play().catch(() => {});
                        pendingPipDataRef.current = {
                            stream: portalStream,
                            peerName: pendingPipDataRef.current?.peerName || "참가자"
                        };
                    }
                }
            }

            // 브라우저 PIP가 닫혔는지 확인
            if (!hasPip) {
                console.log("🔴🔴🔴 브라우저 PIP 종료 감지! 커스텀 PIP로 전환 🔴🔴🔴");
                switchToCustomPip();
            }
        }, 200);
    }, [switchToCustomPip, isStreamValidCheck]);

    // 커스텀 PIP 시작
    const startCustomPip = useCallback((stream, peerName = "참가자") => {
        console.log("[MeetingContext] 커스텀 PIP 시작", { peerName });
        setCustomPipData({ stream, peerName });
        setIsPipMode(true);
    }, []);

    // 커스텀 PIP 종료
    const stopCustomPip = useCallback(() => {
        console.log("[MeetingContext] 커스텀 PIP 종료");
        setCustomPipData(null);
        setIsPipMode(false);
        pendingPipDataRef.current = null;

        // polling 정리
        if (pipPollingRef.current) {
            clearInterval(pipPollingRef.current);
            pipPollingRef.current = null;
        }
    }, []);

    // 🔥 커스텀 PIP 데이터 업데이트 (FloatingPip에서 새 스트림 찾았을 때 호출)
    const updateCustomPipData = useCallback((stream, peerName) => {
        console.log("[MeetingContext] 커스텀 PIP 데이터 업데이트", { peerName });
        setCustomPipData({ stream, peerName });
        pendingPipDataRef.current = { stream, peerName };
    }, []);

    // 브라우저 PIP 종료
    const exitBrowserPip = useCallback(async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(() => {});
        }
        setIsBrowserPipMode(false);
    }, []);

    return (
        <MeetingContext.Provider
            value={{
                isInMeeting,
                isPipMode,
                isBrowserPipMode,
                roomId,
                customPipData,
                startMeeting,
                endMeeting,
                requestBrowserPip,
                startCustomPip,
                stopCustomPip,
                exitBrowserPip,
                updateCustomPipData,
                pipVideoRef, // 🔥 숨겨진 PIP video ref 노출
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
