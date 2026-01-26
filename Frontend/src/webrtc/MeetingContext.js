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
    // 🔥 PiP video의 srcObject는 고정(stable)하고 track만 교체
    const pipStableStreamRef = useRef(null);

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
        // enabled는 브라우저/clone 상황에서 false가 될 수 있어 제외(검은화면 방지)
        return tracks.length > 0 && tracks.some(t => t.readyState === "live");
    }, []);

    const ensurePipStableStream = useCallback(() => {
        if (!pipStableStreamRef.current) {
            pipStableStreamRef.current = new MediaStream();
        }
        return pipStableStreamRef.current;
    }, []);

    const syncPipStableStreamFrom = useCallback((srcStream) => {
        if (!srcStream) return null;
        const dst = ensurePipStableStream();

        // 🔥 소스 스트림의 트랙 ID들 수집
        const srcTrackIds = new Set(srcStream.getTracks().map(t => t.id));
        const dstTrackIds = new Set(dst.getTracks().map(t => t.id));

        // 🔥 이미 동일한 트랙이면 교체 불필요 (안정성 향상)
        const sameTrackIds = [...srcTrackIds].every(id => dstTrackIds.has(id)) &&
                             [...dstTrackIds].every(id => srcTrackIds.has(id));
        if (sameTrackIds && dst.getTracks().length > 0) {
            return dst;
        }

        // 기존 트랙 제거
        dst.getTracks().forEach((t) => {
            try { dst.removeTrack(t); } catch { }
        });

        // 🔥 새 트랙 추가 (원본 트랙 직접 사용 - clone하면 별도 트랙이 되어 동기화 문제 발생)
        srcStream.getTracks().forEach((t) => {
            try {
                // 🔥 이미 dst에 있는 트랙인지 확인 후 추가
                if (!dst.getTracks().find(existing => existing.id === t.id)) {
                    dst.addTrack(t);
                }
            } catch { }
        });

        return dst;
    }, [ensurePipStableStream]);

    const findPortalMainStream = useCallback(() => {
        const meetingRoot = document.getElementById("meeting-root");

        const pickFirstValid = (root, selector) => {
            const nodes = root?.querySelectorAll?.(selector) || [];
            for (const v of nodes) {
                if (v?.srcObject && isStreamValidCheck(v.srcObject)) return v;
            }
            return null;
        };

        // ✅ PiP는 "화면공유 > 메인 > 그 외" 우선순위로 선택
        // - 상대가 화면공유 중이면 공유 화면이 PiP에 보여야 함
        let video =
            pickFirstValid(meetingRoot, '.video-tile:not(.me) video.video-element.screen') ||
            pickFirstValid(meetingRoot, 'video.video-element.screen') ||
            pickFirstValid(meetingRoot, 'video[data-main-video="main"]') ||
            pickFirstValid(meetingRoot, 'video.video-element') ||
            pickFirstValid(meetingRoot, 'video');

        // meeting-root에서 못 찾으면 전역에서 재시도 (Portal이 아직 없거나, DOM 순서 이슈 대비)
        if (!video) {
            video =
                pickFirstValid(document, '.video-tile:not(.me) video.video-element.screen') ||
                pickFirstValid(document, 'video.video-element.screen') ||
                pickFirstValid(document, 'video[data-main-video="main"]') ||
                pickFirstValid(document, 'video.video-element') ||
                pickFirstValid(document, 'video');
        }

        if (video?.srcObject && isStreamValidCheck(video.srcObject)) {
            const peerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
            return { stream: video.srcObject, peerName };
        }

        return null;
    }, [isStreamValidCheck]);

    // 🔥 DOM에서 유효한 스트림 찾기 (개선된 버전)
    const findValidStreamFromDOM = useCallback(() => {
        const pickFirstValid = (root, selector) => {
            const nodes = root?.querySelectorAll?.(selector) || [];
            for (const v of nodes) {
                if (v?.srcObject && isStreamValidCheck(v.srcObject)) return v;
            }
            return null;
        };

        // ✅ 화면공유 우선
        const video =
            pickFirstValid(document, '.video-tile:not(.me) video.video-element.screen') ||
            pickFirstValid(document, 'video.video-element.screen') ||
            pickFirstValid(document, 'video[data-main-video="main"]') ||
            pickFirstValid(document, 'video.video-element') ||
            pickFirstValid(document, 'video');

        if (video?.srcObject && isStreamValidCheck(video.srcObject)) {
            const peerName = video.closest(".video-tile")?.querySelector(".stream-label")?.textContent || "참가자";
            return { stream: video.srcObject, peerName };
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

        // 🔥 회의방 내부(/MeetingRoom/)에서 PIP 종료 시 → 커스텀 PIP 없이 바로 종료
        const currentPath = window.location.pathname;
        if (currentPath.includes("/MeetingRoom/")) {
            console.log("[MeetingContext] 회의방 내부에서 PIP 종료 - 커스텀 PIP 없이 종료");
            
            // 폴링 정리
            if (pipPollingRef.current) {
                clearInterval(pipPollingRef.current);
                pipPollingRef.current = null;
            }
            
            setIsBrowserPipMode(false);
            setIsPipMode(false);
            setCustomPipData(null);
            pendingPipDataRef.current = null;
            
            // 숨겨진 video 정리
            if (pipVideoRef.current) {
                pipVideoRef.current.srcObject = null;
            }
            
            isTransitioningRef.current = false;
            return;
        }

        // 폴링 정리
        if (pipPollingRef.current) {
            clearInterval(pipPollingRef.current);
            pipPollingRef.current = null;
        }

        setIsBrowserPipMode(false);

        // 🔥 1순위: 현재 Portal의 main video 스트림 (재연결/교체된 최신 트랙 확보)
        const portalMain = findPortalMainStream();
        if (portalMain?.stream && isStreamValidCheck(portalMain.stream)) {
            console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (Portal main 스트림)");
            setCustomPipData({ stream: portalMain.stream, peerName: portalMain.peerName });
            setIsPipMode(true);
            pendingPipDataRef.current = { stream: portalMain.stream, peerName: portalMain.peerName };
            setTimeout(() => { isTransitioningRef.current = false; }, 100);
            return;
        }

        // 🔥 2순위: 숨겨진 PIP video의 stable 스트림 (브라우저 PIP에서 사용하던 스트림)
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

        // 🔥 3순위: pending 스트림
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

        // 🔥 4순위: DOM에서 스트림 찾기
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

        // 🔥 재시도 함수 (여러 번 시도)
        const retryFindStream = (attempt = 1, maxAttempts = 5) => {
            // 다시 숨겨진 video 확인
            const retryHiddenStream = pipVideoRef.current?.srcObject;
            if (isStreamValidCheck(retryHiddenStream)) {
                console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (재시도 - 숨겨진 video)");
                setCustomPipData({ stream: retryHiddenStream, peerName: pending?.peerName || "참가자" });
                isTransitioningRef.current = false;
                return;
            }

            // 🔥 Portal main stream 다시 확인
            const retryPortal = findPortalMainStream();
            if (retryPortal?.stream && isStreamValidCheck(retryPortal.stream)) {
                console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (재시도 - Portal)");
                setCustomPipData({ stream: retryPortal.stream, peerName: retryPortal.peerName });
                pendingPipDataRef.current = retryPortal;
                isTransitioningRef.current = false;
                return;
            }

            // DOM에서 다시 찾기
            const retryStream = findValidStreamFromDOM();
            if (retryStream) {
                console.log("[MeetingContext] ✅ 커스텀 PIP로 전환 (재시도 - DOM)");
                setCustomPipData({ stream: retryStream.stream, peerName: retryStream.peerName });
                pendingPipDataRef.current = retryStream;
                isTransitioningRef.current = false;
                return;
            }

            // 🔥 아직 스트림을 못 찾았고 재시도 횟수 남았으면 다시 시도
            if (attempt < maxAttempts) {
                console.log(`[MeetingContext] 스트림 찾기 재시도 (${attempt}/${maxAttempts})`);
                setTimeout(() => retryFindStream(attempt + 1, maxAttempts), 200);
                return;
            }

            console.log("[MeetingContext] ❌ 스트림을 찾을 수 없음 (모든 재시도 실패)");
            setCustomPipData({ stream: null, peerName: pending?.peerName || "참가자" });
            isTransitioningRef.current = false;
        };

        // MeetingPortal 렌더링 대기 후 재시도 시작
        setTimeout(() => retryFindStream(), 300);
    }, [findPortalMainStream, findValidStreamFromDOM, isStreamValidCheck]);

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

        // 🔥 PiP video는 stable stream을 사용하고, track만 교체
        const stable = syncPipStableStreamFrom(stream);
        pendingPipDataRef.current = { stream: stable || stream, peerName };

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
            // 숨겨진 video에는 stable stream을 고정으로 연결
            const stableStream = ensurePipStableStream();
            if (pipVideo.srcObject !== stableStream) {
                pipVideo.srcObject = stableStream;
            }
            // user-gesture 컨텍스트에서만 1회 play 시도
            if (pipVideo.paused) {
                await pipVideo.play().catch(() => {});
            }
            
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
    }, [ensurePipStableStream, syncPipStableStreamFrom]);

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
                // Portal의 main stream을 stable stream에 "트랙 교체" 방식으로 동기화 (srcObject 교체 금지)
                const portalMain = findPortalMainStream();
                if (portalMain?.stream && isStreamValidCheck(portalMain.stream)) {
                    syncPipStableStreamFrom(portalMain.stream);
                    pendingPipDataRef.current = {
                        stream: ensurePipStableStream(),
                        peerName: pendingPipDataRef.current?.peerName || portalMain.peerName || "참가자",
                    };
                }
            }

            // 브라우저 PIP가 닫혔는지 확인
            if (!hasPip) {
                console.log("🔴🔴🔴 브라우저 PIP 종료 감지! 커스텀 PIP로 전환 🔴🔴🔴");
                switchToCustomPip();
            }
        }, 200);
    }, [ensurePipStableStream, findPortalMainStream, isStreamValidCheck, switchToCustomPip, syncPipStableStreamFrom]);

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
