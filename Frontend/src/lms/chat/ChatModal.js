import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChatModal.css';
import { getHostnameWithPort, getWsProtocol } from "../../utils/backendUrl";
import { useLMS } from "../LMSContext";
import api from "../../api/api";

// =================================================================
// [상수 및 환경 설정]
// =================================================================
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360;
const MODAL_HEIGHT = 600;
const BUTTON_SIZE = 70;

// 출석 리스트 뷰 계산용 (AttendanceAll과 동일 로직: 참여시간 = 회차 구간과의 오버랩만 인정)
const toMs = (iso) => (iso ? new Date(iso).getTime() : 0) || 0;
const minutesBetween = (startIso, endIso) => {
    const s = toMs(startIso), e = toMs(endIso);
    return s && e && e > s ? Math.floor((e - s) / 60000) : 0;
};
const minutesOverlapInSession = (log) => {
    if (!log?.studyDate || !log?.startTime || !log?.endTime || !log?.joinAt || !log?.leaveAt) return 0;
    const pad = (t) => (String(t).length >= 8 ? t : t + ":00");
    const sessionStart = new Date(log.studyDate + "T" + pad(log.startTime)).getTime();
    const sessionEnd = new Date(log.studyDate + "T" + pad(log.endTime)).getTime();
    const joinMs = toMs(log.joinAt);
    const leaveMs = toMs(log.leaveAt);
    const overlapStart = Math.max(joinMs, sessionStart);
    const overlapEnd = Math.min(leaveMs, sessionEnd);
    if (overlapEnd <= overlapStart) return 0;
    return Math.floor((overlapEnd - overlapStart) / 60000);
};
const calcTotalMinutes = (startHHMM, endHHMM) => {
    if (!startHHMM || !endHHMM) return 0;
    const [sh, sm] = startHHMM.split(":").map(Number);
    const [eh, em] = endHHMM.split(":").map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};
const judgeAttendance = (log, fallbackTotalMin, requiredRatio) => {
    const totalMin = log?.startTime && log?.endTime ? calcTotalMinutes(log.startTime, log.endTime) : fallbackTotalMin;
    const attendedMin = log?.studyDate && log?.startTime && log?.endTime ? minutesOverlapInSession(log) : minutesBetween(log?.joinAt, log?.leaveAt);
    const ratio = totalMin === 0 ? 0 : attendedMin / totalMin;
    return { attendedMin, ratio, isPresent: ratio >= requiredRatio };
};

const ChatModal = ({ roomId, roomName }) => {
    // 출석부/스터디원/게시판/헤더와 동일한 표시명
    const { displayName } = useLMS();

    // =================================================================
    // 1. 상태 관리 (State)
    // =================================================================
    const [isOpen, setIsOpen] = useState(false);         // 채팅창 열림 여부
    const [isMenuOpen, setIsMenuOpen] = useState(false); // 햄버거 메뉴 열림 여부
    const [showStickerMenu, setShowStickerMenu] = useState(false); // 이모티콘 메뉴
    
    // 안 읽은 개수 (초기값: 로컬 스토리지에서 복구)
    const [unreadCount, setUnreadCount] = useState(() => {
        if (!roomId) return 0;
        const saved = localStorage.getItem(`unread_${roomId}`);
        return saved ? parseInt(saved, 10) : 0;
    });

    const [isAiMode, setIsAiMode] = useState(false);     // AI 모드 여부
    const [inputValue, setInputValue] = useState("");    // 입력창 값
    const [userList, setUserList] = useState([]);        // 접속자 목록

    // 이 방에서 사용할 전용 닉네임 (기본값 null)
    const [roomNickname, setRoomNickname] = useState(null);

    const [chatMessages, setChatMessages] = useState([]); // 일반 채팅 메시지 목록
    const [aiMessages, setAiMessages] = useState([]); // AI 채팅 메시지 목록 (초기값은 빈 배열, useEffect에서 스트리밍으로 추가)

    // AI 모드 관련 상태들
    const [assignmentList, setAssignmentList] = useState([]);
    const [submissionListAfterMessage, setSubmissionListAfterMessage] = useState({});
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [loadingSubmissionForIndex, setLoadingSubmissionForIndex] = useState(null); // 메시지 인덱스 또는 null
    // "xxx님의 과제를 요약할까요? 예상문제를 낼까요?" 대상 제출자 → 이후 '과제 요약'/'예상문제' 입력 시 사용
    const [lastAskedSubmission, setLastAskedSubmission] = useState(null); // { submissionId, name } | null
    // 과제 요약/예상문제 로딩 단계: 1 = DB에서 파일 가져오는중, 2 = 요약/예상문제 만드는 중
    const [loadingPhaseForSubmission, setLoadingPhaseForSubmission] = useState(null); // 1 | 2 | null
    // 로딩 문구 말줄임표 애니메이션 (1~3개 순환)
    const [loadingDotsPhase, setLoadingDotsPhase] = useState(0); // 0,1,2 → ., .., ...
    // '과제 목록 보여줘' / '과제' 키워드 입력 시 그 메시지 아래에만 과제 목록 표시 (null이면 목록 미표시)
    const [showAssignmentListAfterIndex, setShowAssignmentListAfterIndex] = useState(null); // 메시지 인덱스 또는 null
    // 출석: '출석' 키워드 입력 시 해당 메시지 아래에 전체 출석 리스트 표시
    const [attendanceData, setAttendanceData] = useState(null); // { studySchedule, attendanceLogs } | null
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [showAttendanceListAfterIndex, setShowAttendanceListAfterIndex] = useState(null); // 메시지 인덱스 또는 null
    // 일정: '일정' 키워드 입력 시 해당 메시지 아래에 일정 목록 표시
    const [scheduleList, setScheduleList] = useState([]); // { id, title, startYmd, startDisplay, endDisplay, type }[]
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [showScheduleListAfterIndex, setShowScheduleListAfterIndex] = useState(null); // 메시지 인덱스 또는 null
    // 게시판: '게시글'/'게시판' 키워드 또는 게시글 조회 버튼 시 최근 5개 게시글 목록 표시
    const [boardList, setBoardList] = useState([]); // { postId, title, nickname, createdAt, category }[]
    const [loadingBoard, setLoadingBoard] = useState(false);
    const [showBoardListAfterIndex, setShowBoardListAfterIndex] = useState(null); // 메시지 인덱스 또는 null

    const navigate = useNavigate();

    // 모달 위치 및 드래그 관련 Ref
    const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const accumulatedMove = useRef(0);
    const lastButtonPos = useRef(null);
    const lastWindowSize = useRef({ w: MODAL_WIDTH, h: MODAL_HEIGHT });

    // 리사이즈 관련 Ref
    const resizeRef = useRef({
        active: false, dir: '', startX: 0, startY: 0, startW: 0, startH: 0, startLeft: 0, startTop: 0
    });

    const ws = useRef(null);        // 웹소켓 객체
    const scrollRef = useRef(null); // 스크롤 자동 이동용
    const modalRef = useRef(null);  // 모달 DOM
    const streamingTimers = useRef(new Map()); // AI 타자 효과용 타이머

    // 최신 메시지 목록을 실시간으로 추적하는 Ref (타이밍 이슈 해결용)
    const latestMessagesRef = useRef(chatMessages);

    // chatMessages가 변할 때마다 Ref도 업데이트
    useEffect(() => {
        latestMessagesRef.current = chatMessages;
    }, [chatMessages]);

    // 로딩 메시지가 있을 때 말줄임표(.) 1→2→3개 순환 애니메이션
    useEffect(() => {
        const hasLoading = aiMessages.some((m) => m.isLoading);
        if (!hasLoading) return;
        const t = setInterval(() => {
            setLoadingDotsPhase((p) => (p + 1) % 3);
        }, 400);
        return () => clearInterval(t);
    }, [aiMessages]);

    // =================================================================
    // 2. 유틸리티 및 초기 설정
    // =================================================================
    
    // 동적 URL 생성
    const { apiBaseUrl, wsUrl } = useMemo(() => {
        const host = getHostnameWithPort();
        const wsProtocol = getWsProtocol();
        const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';
        let wsHost = host;
        if (host.includes(":3000")) wsHost = host.replace(":3000", ":8080");
        return { apiBaseUrl: `${httpProtocol}://${host}`, wsUrl: `${wsProtocol}://${wsHost}` };
    }, []);

    // 사용자 정보
    const myInfo = useMemo(() => {
        try {
            const storedUserId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
            const fallbackName = localStorage.getItem("userName") || sessionStorage.getItem("userName") || localStorage.getItem("nickname");
            const userName = (displayName && displayName.trim()) ? displayName.trim() : (fallbackName || "익명");
            if (storedUserId) return { userId: storedUserId, userName };
        } catch (e) { console.error(e); }
        return null;
    }, [displayName]);

    const currentMessages = isAiMode ? aiMessages : chatMessages;

    // 시간 포맷팅 함수
    const formatTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? '오후' : '오전';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${ampm} ${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    };

    // AI 답변을 한 글자씩 보여주는 타자 효과
    const startStreamingAiMessage = (fullText = "", extra = {}, options = {}) => {
        const { clearLoading = false } = options;
        const text = typeof fullText === "string" ? fullText : String(fullText || "");
        const streamId = `stream-${Date.now()}-${Math.random()}`;
        const createdAt = extra.createdAt || new Date().toISOString();

        setAiMessages((prev) => {
            const base = clearLoading ? prev.filter((m) => !m.isLoading) : prev;
            return [
                ...base,
                {
                    userId: "AI_BOT",
                    userName: "AI 튜터",
                    isAiResponse: true,
                    message: "",
                    streamId,
                    createdAt,
                    ...extra
                }
            ];
        });

        // 타자 속도 튜닝: 느리게 보이도록 한 번에 추가되는 글자 수를 줄임
        const chunk = Math.max(1, Math.round(text.length / 180));
        const timer = setInterval(() => {
            setAiMessages((prev) =>
                prev.map((m) =>
                    m.streamId === streamId
                        ? { ...m, message: text.slice(0, Math.min(m.message.length + chunk, text.length)) }
                        : m
                )
            );

            const current = streamingTimers.current.get(streamId)?.progress || 0;
            const next = current + chunk;
            streamingTimers.current.set(streamId, { timer, progress: next });
            if (next >= text.length) {
                clearInterval(timer);
                streamingTimers.current.delete(streamId);
                setAiMessages((prev) =>
                    prev.map((m) =>
                        m.streamId === streamId ? { ...m, message: text, streamId: undefined } : m
                    )
                );
            }
        }, 35);

        streamingTimers.current.set(streamId, { timer, progress: 0 });
    };

    // 요약노트/문제노트 저장 (type: 'SUMMARY' | 'PROBLEM')
    const getAnswerForProblemNote = (answer) => {
        if (!answer || typeof answer !== "string") return answer || "";
        const match = answer.match(/\n?\s*###\s*1[.)]\s/);
        if (match && match.index != null) return answer.slice(match.index).trim();
        const dashMatch = answer.match(/\n\s*---\s*\n\s*/);
        if (dashMatch && dashMatch.index != null) return answer.slice(dashMatch.index + dashMatch[0].length).trim();
        return answer;
    };

    const getAnswerForSummaryNote = (answer) => {
        if (!answer || typeof answer !== "string") return answer || "";
        let text = answer.trim();
        if (text.includes("(아래는 실제") || text.includes("### 예시)")) {
            const belowBlock = text.match(/\n---\s*\n\s*####\s/);
            if (belowBlock && belowBlock.index != null) {
                text = text.slice(belowBlock.index).replace(/^\s*---\s*\n\s*/, "").trim();
            }
        }
        if (!text.includes("#### ")) {
            const startRe = /\n\s*---\s*\n\s*|(?:^|\n)\s*(##\s+\d|##\s+[^\n]+|###\s+\d|###\s+[^\n]+)/;
            const idx = text.search(startRe);
            if (idx >= 0) text = text.slice(idx).replace(/^\s*---\s*\n\s*/, "").trim();
        }
        const outroRe = /\n\s*(---\s*\n\s*)?(※\s*위\s*내용은|궁금한\s*점이나|도움이 되었길|더 궁금한|감사합니다|필요하면|언제든 질문해|궁금한 점이 있으시면)/i;
        const cutIdx = text.search(outroRe);
        if (cutIdx >= 0) text = text.slice(0, cutIdx).trim();
        text = text.replace(/\n\s*---\s*$/, "").trim();
        return text || answer;
    };

    const handleSaveNoteAs = async (question, answer, noteType) => {
        if (!roomId) return;
        const label = noteType === "SUMMARY" ? "요약노트" : "문제 노트";
        if (!window.confirm(`이 내용을 ${label}에 저장하시겠습니까?`)) return;
        const answerToSave = noteType === "PROBLEM" ? getAnswerForProblemNote(answer) : noteType === "SUMMARY" ? getAnswerForSummaryNote(answer) : (answer || "");
        try {
            await api.post("/answernote", {
                subjectId: String(roomId),
                question: question || "AI 과제 요약/예상문제",
                answer: answerToSave,
                memo: "AI 채팅에서 저장됨",
                type: noteType
            });
            alert(`✅ ${label}에 저장되었습니다!`);
        } catch (err) {
            console.error("노트 저장 오류:", err);
            alert("저장에 실패했습니다.");
        }
    };

    // =================================================================
    // 읽음 처리 로직 (5초 버퍼 적용)
    // =================================================================
    const updateLastReadTime = (targetDate) => {
        if (!roomId) return;
        
        let dateToSave;
        if (targetDate) {
            dateToSave = targetDate; // 메시지 시간이 있으면 그 시간으로
        } else {
            // 메시지 시간 없이 '현재 시점'으로 저장할 때 -> +5초 여유 (서버 시간 오차 보정)
            const now = new Date();
            now.setSeconds(now.getSeconds() + 5); 
            dateToSave = now.toISOString();
        }
        
        localStorage.setItem(`lastRead_${roomId}`, dateToSave);
    };

    // 방 변경 시 초기화
    useEffect(() => {
        if (!roomId) return;

        setChatMessages([]);
        setRoomNickname(null); 
        setUnreadCount(0); // 일단 0으로 (통합 로직이 다시 계산)
        
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
    }, [roomId]);

    // unreadCount가 변할 때마다 localStorage에 저장 (새로고침 대비)
    useEffect(() => {
        if (roomId) localStorage.setItem(`unread_${roomId}`, unreadCount);
    }, [unreadCount, roomId]);


    // =================================================================
    // 3. API 호출 (닉네임 & 내역)
    // =================================================================
    
    // 닉네임 가져오기
    useEffect(() => {
        if (!roomId || !myInfo) return;

        const fetchNickname = async () => {
            try {
                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/nickname`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (res.ok) {
                    const nick = await res.text();
                    console.log(`🏷️ 방(${roomId}) 닉네임 로드: ${nick}`);
                    setRoomNickname(nick);
                } else {
                    setRoomNickname(myInfo.userName);
                }
            } catch (e) {
                console.error("닉네임 로드 실패:", e);
                setRoomNickname(myInfo.userName);
            }
        };

        fetchNickname();
    }, [roomId, myInfo, apiBaseUrl]);


    // 채팅 내역 불러오기 (숫자 계산 로직 제거 -> 통합 로직으로 이관)
    useEffect(() => {
        // isOpen 체크 제거! (방에 들어오면 무조건 데이터를 받아와야 함)
        if (!roomId || !myInfo) return;

        const fetchChatHistory = async () => {
            try {
                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/messages`, {
                    headers: { "Content-Type": "application/json", "Authorization": token ? `Bearer ${token}` : "" }
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    const dbMessages = data.map(msg => ({
                        userId: msg.userId,
                        userName: msg.userName || "알 수 없음",
                        message: msg.message || msg.messageText || "",
                        isSticker: STICKER_LIST.includes(msg.message || ""),
                        createdAt: msg.createdAt || new Date().toISOString(),
                        messageType: msg.messageType || "TALK"
                    })).filter(msg => msg.message); 

                    setChatMessages(dbMessages);
                    
                    // 열려있을 때만 스크롤 이동
                    if (isOpen) {
                        setTimeout(() => {
                             if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }, 100);
                    }
                }
            } catch (err) { console.error("채팅 기록 로드 에러:", err); }
        };

        fetchChatHistory();
    }, [roomId, myInfo, apiBaseUrl]); // isOpen 제거 (항상 로드)


    // 통합 카운터: 메시지 목록이나 상태가 변하면 안 읽은 개수 자동 계산
    useEffect(() => {
        if (!roomId || !myInfo) return;

        if (isOpen) {
            // 창이 열려있으면 무조건 0 & 읽음 시간 갱신
            setUnreadCount(0);
            if (chatMessages.length > 0) {
                const lastMsg = chatMessages[chatMessages.length - 1];
                updateLastReadTime(lastMsg.createdAt);
            } else {
                updateLastReadTime();
            }
        } else {
            // 창이 닫혀있으면: (전체 메시지) 중 (내 것이 아니고) && (마지막 읽은 시간보다 최신인 것) 카운트
            const lastReadTimeStr = localStorage.getItem(`lastRead_${roomId}`);
            if (lastReadTimeStr) {
                const lastReadTime = new Date(lastReadTimeStr).getTime();
                const unread = chatMessages.filter(msg => 
                    msg.userId !== myInfo.userId && 
                    new Date(msg.createdAt).getTime() > lastReadTime
                ).length;
                setUnreadCount(unread);
            } else {
                // 기록이 없으면 0으로 둠 (원하면 chatMessages.length로 해서 전체 안 읽음 처리 가능)
                setUnreadCount(0);
            }
        }
    }, [isOpen, chatMessages, roomId, myInfo]); // 메시지가 추가될 때마다 재계산


    // =================================================================
    // 3-1. [API] AI 모드에서 과제 목록 불러오기
    // =================================================================
    useEffect(() => {
        if (!isOpen || !isAiMode || !roomId) return;
        setLoadingAssignments(true);
        setAssignmentList([]);
        setSubmissionListAfterMessage({});
        setShowAssignmentListAfterIndex(null);
        setShowAttendanceListAfterIndex(null);
        setShowScheduleListAfterIndex(null);
        setShowBoardListAfterIndex(null);

        const fetchAssignments = async () => {
            try {
                const res = await api.get(`/rooms/${roomId}/assignments`);
                const mapped = (res.data || []).map((x) => ({
                    id: x.assignmentId,
                    title: x.title,
                    dueDate: x.dueAt ? String(x.dueAt).slice(0, 10) : "미정",
                    status: x.status,
                }));
                setAssignmentList(mapped);
            } catch (e) {
                console.error("과제 목록 로드 실패:", e);
                setAssignmentList([]);
            } finally {
                setLoadingAssignments(false);
            }
        };
        fetchAssignments();
    }, [isOpen, isAiMode, roomId]);

    // 특정 메시지 인덱스 뒤에 제출한 사람 목록 로드 (타임라인에 인라인 표시용)
    const loadSubmissionsForMessageIndex = async (assignmentId, assignmentTitle, messageIndex) => {
        setLoadingSubmissionForIndex(messageIndex);
        try {
            const res = await api.get(`/assignments/${assignmentId}/submissions`);
            const submissions = (res.data || []).map((x) => ({
                submissionId: x.submissionId,
                name: x.memberName,
                submittedAt: x.submittedAt ? String(x.submittedAt).replace("T", " ").slice(0, 16) : "-",
                status: x.status,
                fileUrl: x.fileUrl,
            }));
            setSubmissionListAfterMessage((prev) => ({
                ...prev,
                [messageIndex]: { assignmentId, title: assignmentTitle, submissions }
            }));
        } catch (e) {
            console.error("제출 목록 로드 실패:", e);
            setSubmissionListAfterMessage((prev) => ({ ...prev, [messageIndex]: { assignmentId, title: assignmentTitle, submissions: [] } }));
        } finally {
            setLoadingSubmissionForIndex(null);
        }
    };

    // 제출한 사람 클릭 시: 제출했으면 요약/예상문제 선택 문구, 미제출이면 바로 안내 메시지
    const handleClickSubmission = (submission) => {
        const hasFile = submission.fileUrl != null && String(submission.fileUrl).trim() !== "";
        if (!hasFile) {
            startStreamingAiMessage(`${submission.name}님의 과제가 아직 제출되지 않았습니다.`, { createdAt: new Date().toISOString() });
            return;
        }
        setLastAskedSubmission({ submissionId: submission.submissionId, name: submission.name });
        startStreamingAiMessage(`${submission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`, { createdAt: new Date().toISOString() });
    };

    // 전체 출석 리스트 로드 (채팅 패널용)
    const fetchAttendanceList = async () => {
        if (!roomId) return;
        setLoadingAttendance(true);
        try {
            const res = await api.get(`/subjects/${roomId}/attendance`, { params: { scope: "all" } });
            setAttendanceData(res.data || null);
        } catch (e) {
            console.error("출석 리스트 로드 실패:", e);
            setAttendanceData(null);
        } finally {
            setLoadingAttendance(false);
        }
    };

    // 일정 목록 로드 (채팅 패널용, 이번 달 + 다음 달)
    const fetchScheduleList = async () => {
        if (!roomId) return;
        setLoadingSchedule(true);
        try {
            const now = new Date();
            const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const endExclusive = new Date(now.getFullYear(), now.getMonth() + 2, 1); // 다음다음달 1일(미포함)
            const startYmd = toYmd(start);
            const endExclusiveYmd = toYmd(endExclusive);
            const res = await api.get(`/rooms/${roomId}/schedule`, { params: { start: startYmd, end: endExclusiveYmd } });
            const items = res.data?.items || [];
            const addDays = (ymd, delta) => {
                if (!ymd || ymd.length < 10) return "";
                const dt = new Date(ymd.slice(0, 10).replace(/-/g, "/"));
                dt.setDate(dt.getDate() + delta);
                const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, "0"), d = String(dt.getDate()).padStart(2, "0");
                return `${y}-${m}-${d}`;
            };
            const mapped = items.map((it) => {
                const startStr = it?.start ? String(it.start).slice(0, 16).replace("T", " ") : "";
                const endStr = it?.end ? String(it.end).slice(0, 16).replace("T", " ") : "";
                const startYmd = (it?.start || "").toString().slice(0, 10);
                const endYmdRaw = (it?.end || "").toString().slice(0, 10);
                const [, m, d] = startYmd.split("-");
                const startDisplay = startYmd && m && d ? `${Number(m)}.${Number(d)}` : "";
                // 같은 날짜(스터디 회차 등)면 기간 표시 안 함. end가 시작일보다 뒤인 경우에만 미포함 end → 포함일로 하루 빼서 표시
                let dateDisplay = startDisplay;
                if (endYmdRaw && endYmdRaw > startYmd) {
                    const endYmdInclusive = addDays(endYmdRaw, -1);
                    const endParts = endYmdInclusive.split("-");
                    const endDisplay = endParts[1] && endParts[2] ? `${Number(endParts[1])}.${Number(endParts[2])}` : "";
                    if (endDisplay && endYmdInclusive !== startYmd) dateDisplay = `${startDisplay} ~ ${endDisplay}`;
                }
                const type = it?.extendedProps?.type || (String(it?.id || "").startsWith("S") ? "STUDY" : "OTHER");
                return {
                    id: it?.id,
                    title: it?.title || "(제목 없음)",
                    startYmd,
                    startDisplay,
                    dateDisplay,
                    startStr,
                    endStr,
                    type
                };
            });
            setScheduleList(mapped);
        } catch (e) {
            console.error("일정 목록 로드 실패:", e);
            setScheduleList([]);
        } finally {
            setLoadingSchedule(false);
        }
    };

    // 게시판 최근 5개 목록 로드 (채팅 패널용)
    const fetchBoardList = async () => {
        if (!roomId) return;
        setLoadingBoard(true);
        try {
            const res = await api.get("/board/posts", { params: { roomId, page: 1, size: 5 } });
            const items = (res.data?.items || []).slice(0, 5);
            const sorted = [...items].sort((a, b) => (b.postId || 0) - (a.postId || 0));
            setBoardList(sorted.map((p) => ({
                postId: p.postId,
                title: p.title || "(제목 없음)",
                nickname: p.nickname || "",
                createdAt: p.createdAt ? String(p.createdAt).replace("T", " ").slice(0, 16) : "",
                category: p.category || ""
            })));
        } catch (e) {
            console.error("게시글 목록 로드 실패:", e);
            setBoardList([]);
        } finally {
            setLoadingBoard(false);
        }
    };

    // 출석 데이터 → 채팅 패널용 뷰 (이름, 출석률, 회차별 ○/×)
    const attendanceViewRows = useMemo(() => {
        if (!attendanceData?.attendanceLogs?.length || !attendanceData?.studySchedule) return [];
        const schedule = attendanceData.studySchedule;
        const totalSessions = schedule.totalSessions || 0;
        const fallbackTotalMin = calcTotalMinutes(schedule.start, schedule.end);
        const requiredRatio = schedule.requiredRatio ?? 0.9;
        return (attendanceData.attendanceLogs || []).map((m) => {
            const sessionsOrdered = m.sessions || [];
            const sessionsView = Array.from({ length: totalSessions }).map((_, idx) => {
                const log = sessionsOrdered[idx];
                const totalMinForSession = log?.startTime && log?.endTime ? calcTotalMinutes(log.startTime, log.endTime) : fallbackTotalMin;
                const judged = log ? judgeAttendance(log, totalMinForSession, requiredRatio) : { isPresent: false };
                return judged;
            });
            const presentCount = sessionsView.filter((s) => s.isPresent).length;
            const ratioOverall = totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100);
            return { memberId: m.memberId, name: m.name, presentCount, totalSessions, ratioOverall, sessionsView };
        });
    }, [attendanceData]);

    // 과제 목록에서 과제 클릭 시: 사용자 답변처럼 메시지 추가 후, 그 뒤에 제출한 사람 리스트 표시
    const handleClickAssignmentInList = (assignment) => {
        const newIndex = aiMessages.length;
        setAiMessages((prev) => [
            ...prev,
            { userId: myInfo.userId, message: `${assignment.title} 과제 제출 목록`, createdAt: new Date().toISOString(), isAiResponse: false }
        ]);
        loadSubmissionsForMessageIndex(assignment.id, assignment.title, newIndex);
    };

    // 띄어쓰기·특수문자 제거 후 비교용 (예: "이름이바뀌었나요" ↔ "이름이 바뀌었나요?(승*)")
    const normalizeForNameMatch = (str) =>
        (str || "").replace(/\s/g, "").replace(/[?()*]/g, "").trim();

    // "이름이 바뀌었나요?" / "이름이바뀌었나요" 등 (정확히 안 써도) 이름 변경 질문인지 판별 → 해당 시 비슷한 사람 제출현황 표시용
    const isNameChangeQuestion = (msg) => {
        const n = normalizeForNameMatch(msg || "");
        return n === "이름이바뀌었나요" || (n.includes("이름") && (n.includes("바뀌") || n.includes("바꿨")));
    };

    // submissionListAfterMessage에서 해당 제출자(submissionId 또는 name)가 속한 과제 정보 반환 { assignmentTitle, submission }
    const getAssignmentInfoForSubmission = (submissionIdOrName, listAfterMessage) => {
        const list = Object.values(listAfterMessage || {});
        for (const entry of list) {
            const subs = entry.submissions || [];
            const found = typeof submissionIdOrName === "object"
                ? subs.find((s) => s.submissionId === submissionIdOrName.submissionId)
                : subs.find((s) => s.submissionId === submissionIdOrName || (s.name && String(s.name) === String(submissionIdOrName)));
            if (found) return { assignmentTitle: entry.title || "과제", submission: found };
        }
        return null;
    };

    // 프롬프트에서 제출한 사람 닉네임으로 매칭 (예: "123의 과제 요약", "이름이바뀌었나요" → 해당 이름 포함된 사람)
    const findSubmissionNameFromMessage = (messageText, listAfterMessage) => {
        if (!messageText?.trim()) return null;
        const trimmed = messageText.trim();
        const allSubmissions = Object.values(listAfterMessage || {}).flatMap((d) => d.submissions || []);
        const exact = allSubmissions.find((s) => s.name && (trimmed === s.name || trimmed.includes(s.name) || s.name.includes(trimmed)));
        if (exact) return exact;
        const words = trimmed.split(/[\s의님,]+/).filter((w) => w.length >= 1);
        const byWord = allSubmissions.find((s) => s.name && words.some((w) => s.name.includes(w)));
        if (byWord) return byWord;
        const normMsg = normalizeForNameMatch(trimmed);
        if (normMsg.length < 2) return null;
        return allSubmissions.find(
            (s) => s.name && (normalizeForNameMatch(s.name).includes(normMsg) || normMsg.includes(normalizeForNameMatch(s.name)))
        ) || null;
    };

    // 프롬프트에서 과제 이름 또는 과제 ID(번호)로 매칭되는 과제 찾기 → 제출한 사람 리스트가 뜨도록 함
    const findAssignmentFromMessage = (messageText, list) => {
        if (!messageText || !list?.length) return null;
        const trimmed = messageText.trim();
        // 1) 과제 제목과 완전 일치
        const byTitle = list.find((a) => trimmed === a.title || trimmed === String(a.id));
        if (byTitle) return byTitle;
        // 2) 메시지에 과제 제목이 포함된 경우
        const byTitleContains = list.find((a) => a.title && trimmed.includes(a.title));
        if (byTitleContains) return byTitleContains;
        // 3) 메시지에서 숫자 추출 후 과제 ID와 일치
        const numbers = trimmed.match(/\d+/g);
        if (numbers) {
            const byId = list.find((a) => numbers.includes(String(a.id)));
            if (byId) return byId;
        }
        return null;
    };


    // =================================================================
    // 4. WebSocket 연결 및 핸들링
    // =================================================================
    useEffect(() => {
        if (!roomId || !myInfo || !roomNickname) return;
        if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

        const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
        const wsUrlStr = `${wsUrl}/ws/chat/${roomId}?userId=${encodeURIComponent(myInfo.userId)}&userName=${encodeURIComponent(roomNickname)}&token=${encodeURIComponent(token)}`;
        
        console.log("📡 웹소켓 연결 시도:", roomNickname);
        const socket = new WebSocket(wsUrlStr);
        ws.current = socket;

        socket.onopen = () => { console.log("✅ 웹소켓 연결 성공!"); };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "TALK") {
                setChatMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.message === data.message && lastMsg.userId === data.userId && 
                        (new Date().getTime() - new Date(lastMsg.createdAt).getTime() < 500)) return prev;
                    
                    return [...prev, {
                        userId: data.userId,
                        userName: data.userName,
                        message: data.message,
                        isSticker: STICKER_LIST.includes(data.message),
                        createdAt: data.createdAt || new Date().toISOString()
                    }];
                });

            } else if (data.type === "USERS_UPDATE") {
                const uniqueUsers = data.users.filter((v, i, a) => a.findIndex(t => (t.userId === v.userId)) === i);
                setUserList(uniqueUsers);
            }
        };

        socket.onclose = () => {
            console.log("🔌 웹소켓 연결 종료");
            if (ws.current === socket) {
                ws.current = null;
            }
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
            if (ws.current === socket) {
                ws.current = null;
            }
        };
    }, [roomId, myInfo, wsUrl, roomNickname]); 

    // AI 로딩 및 스크롤 처리
    useEffect(() => {
        if (loadingPhaseForSubmission !== 1) return;
        const t = setTimeout(() => setLoadingPhaseForSubmission(2), 2000);
        return () => clearTimeout(t);
    }, [loadingPhaseForSubmission]);

    // 컴포넌트 언마운트 시 진행 중인 스트리밍 정리
    useEffect(() => {
        return () => {
            streamingTimers.current.forEach(({ timer }) => clearInterval(timer));
            streamingTimers.current.clear();
        };
    }, []);

    // AI 모드 초기 메시지 스트리밍 표시
    useEffect(() => {
        if (isAiMode && aiMessages.length === 0) {
            startStreamingAiMessage("안녕하세요! LMS에서 궁금한 점을 물어보세요!", { createdAt: new Date().toISOString() });
        }
    }, [isAiMode]);


    // 메시지 추가 시 스크롤 자동 이동 (열려있을 때만)
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentMessages, isOpen]);


    // =================================================================
    // 5. 이벤트 핸들러 (드래그/리사이즈)
    // =================================================================

    // 드래그/리사이즈 핸들러
    const handleMouseDown = (e) => { isDragging.current = false; accumulatedMove.current = 0; dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }; document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); };
    const handleResizeMouseDown = (e, direction) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { active: true, dir: direction, startX: e.clientX, startY: e.clientY, startW: modalRef.current.offsetWidth, startH: modalRef.current.offsetHeight, startLeft: position.x, startTop: position.y }; document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); };
    const handleMouseMove = (e) => { if (resizeRef.current && resizeRef.current.active) { const { dir, startX, startY, startW, startH, startLeft, startTop } = resizeRef.current; const dx = e.clientX - startX; const dy = e.clientY - startY; let newW = startW, newH = startH, newX = startLeft, newY = startTop; if (dir.includes('e')) newW = startW + dx; if (dir.includes('s')) newH = startH + dy; if (dir.includes('w')) { newW = startW - dx; newX = startLeft + dx; } if (dir.includes('n')) { newH = startH - dy; newY = startTop + dy; } if (newW < 360) { newW = 360; if (dir.includes('w')) newX = startLeft + (startW - 360); } if (newH < 600) { newH = 600; if (dir.includes('n')) newY = startTop + (startH - 600); } if (newX < 0) { newW += newX; newX = 0; } if (newY < 0) { newH += newY; newY = 0; } if (newX + newW > window.innerWidth) newW = window.innerWidth - newX; if (newY + newH > window.innerHeight) newH = window.innerHeight - newY; if (modalRef.current) { modalRef.current.style.width = `${newW}px`; modalRef.current.style.height = `${newH}px`; } lastWindowSize.current = { w: newW, h: newH }; setPosition({ x: newX, y: newY }); lastButtonPos.current = null; return; } accumulatedMove.current += Math.abs(e.movementX) + Math.abs(e.movementY); if (accumulatedMove.current > 5) isDragging.current = true; let currentWidth = BUTTON_SIZE, currentHeight = BUTTON_SIZE; if (isOpen && modalRef.current) { currentWidth = modalRef.current.offsetWidth; currentHeight = modalRef.current.offsetHeight; } const maxX = window.innerWidth - currentWidth; const maxY = window.innerHeight - currentHeight; let nextX = Math.min(Math.max(0, e.clientX - dragStart.current.x), maxX); let nextY = Math.min(Math.max(0, e.clientY - dragStart.current.y), maxY); if (isOpen && isDragging.current) lastButtonPos.current = null; setPosition({ x: nextX, y: nextY }); };
    const handleMouseUp = () => { setTimeout(() => { isDragging.current = false; }, 50); if (resizeRef.current) resizeRef.current.active = false; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };

    // 토글 시 처리 (반응 속도 개선 & 읽음 처리)
    const toggleChat = () => {
        if (isDragging.current || accumulatedMove.current > 5) return;

        // 최신 메시지 목록 가져오기 (Ref 사용)
        const currentMsgs = latestMessagesRef.current;
        const lastMsgTime = currentMsgs.length > 0 ? currentMsgs[currentMsgs.length - 1].createdAt : null;

        if (!isOpen) {
            // 열 때
            setUnreadCount(0); // 즉시 0으로 만듦
            
            // 위치 복원
            lastButtonPos.current = { x: position.x, y: position.y };
            const targetW = lastWindowSize.current.w; const targetH = lastWindowSize.current.h;
            let newX = Math.max(0, position.x - (targetW - BUTTON_SIZE));
            let newY = Math.max(0, position.y - (targetH - BUTTON_SIZE));
            if (newX + targetW > window.innerWidth) newX = window.innerWidth - targetW;
            if (newY + targetH > window.innerHeight) newY = window.innerHeight - targetH;
            setPosition({ x: newX, y: newY });

            // 읽음 처리
            updateLastReadTime(lastMsgTime);
        } else {
            // 닫을 때
            // 위치 저장
            if (modalRef.current) lastWindowSize.current = { w: modalRef.current.offsetWidth, h: modalRef.current.offsetHeight };
            if (lastButtonPos.current) { setPosition(lastButtonPos.current); lastButtonPos.current = null; }
            else if (modalRef.current) {
                const currentW = modalRef.current.offsetWidth; const currentH = modalRef.current.offsetHeight;
                let newX = Math.min(Math.max(0, position.x + (currentW - BUTTON_SIZE)), window.innerWidth - BUTTON_SIZE);
                let newY = Math.min(Math.max(0, position.y + (currentH - BUTTON_SIZE)), window.innerHeight - BUTTON_SIZE);
                setPosition({ x: newX, y: newY });
            }
            
            // 닫는 순간 읽음 처리
            updateLastReadTime(lastMsgTime);
        }
        setIsOpen(!isOpen);
    };

    const toggleAiMode = () => setIsAiMode(!isAiMode);

    // 첫 인사 아래 빠른 실행 버튼: 과제 제출 현황 / 출석 현황 / 일정 목록 / 게시글 조회
    const handleQuickAction = (type) => {
        const labels = { assignment: "과제 제출 현황", attendance: "출석 현황", schedule: "일정 목록", board: "게시글 조회" };
        const newIndex = aiMessages.length;
        setAiMessages((prev) => [
            ...prev,
            { userId: myInfo.userId, message: labels[type], createdAt: new Date().toISOString(), isAiResponse: false }
        ]);
        if (type === "assignment") setShowAssignmentListAfterIndex(newIndex);
        else if (type === "attendance") {
            setShowAttendanceListAfterIndex(newIndex);
            fetchAttendanceList();
        } else if (type === "schedule") {
            setShowScheduleListAfterIndex(newIndex);
            fetchScheduleList();
        } else if (type === "board") {
            setShowBoardListAfterIndex(newIndex);
            fetchBoardList();
        }
    };

    const handleSend = async (text = inputValue) => {
        if (!text.trim()) return;
        if (!myInfo) return;
        setInputValue("");
        setShowStickerMenu(false);

        if (isAiMode) {
            // [AI 모드] 사용자 답변 추가
            const userMessageIndex = currentMessages.length;
            setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);

            // '출석'이 포함된 모든 입력 → 해당 메시지 아래에 전체 출석 리스트 표시, AI 호출 안 함
            if (text.includes("출석")) {
                setShowAttendanceListAfterIndex(userMessageIndex);
                fetchAttendanceList();
                return;
            }

            // '일정'이 포함된 모든 입력 → 해당 메시지 아래에 일정 목록 표시, AI 호출 안 함
            if (text.includes("일정")) {
                setShowScheduleListAfterIndex(userMessageIndex);
                fetchScheduleList();
                return;
            }

            // '게시판' 또는 '게시글'이 포함된 입력 → 해당 메시지 아래에 최근 5개 게시글 목록 표시, AI 호출 안 함
            if (text.includes("게시판") || text.includes("게시글")) {
                setShowBoardListAfterIndex(userMessageIndex);
                fetchBoardList();
                return;
            }

            // 인사 등 단순 답변 처리
            const trimmedLower = text.trim().toLowerCase();
            const isGreeting = /^안녕(하세요)?\.?$/.test(trimmedLower) || trimmedLower === "안녕" || trimmedLower === "하이" || trimmedLower === "hello";
            if (isGreeting) {
                startStreamingAiMessage("안녕하세요! 과제 제출 현황이나 목록이 궁금하시다면 '과제 목록을 보여줘' 또는 '과제'라고 입력해보세요.", { createdAt: new Date().toISOString() });
                return;
            }

            // "이름이 바뀌었나요?" 처리
            if (isNameChangeQuestion(text)) {
                let info = null;
                if (lastAskedSubmission) { info = getAssignmentInfoForSubmission(lastAskedSubmission.submissionId, submissionListAfterMessage); }
                if (!info) { const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage); if (matchedSubmission) { info = getAssignmentInfoForSubmission(matchedSubmission.submissionId, submissionListAfterMessage) || { assignmentTitle: "과제", submission: matchedSubmission }; } }
                if (info?.submission) {
                    const submission = info.submission;
                    if (submission.fileUrl) {
                        // 제출 완료: 제출 현황 + 요약/예상문제 유도 (스트리밍)
                        setLastAskedSubmission({ submissionId: submission.submissionId, name: submission.name });
                        startStreamingAiMessage(`${submission.name}님의 제출 현황: [${info.assignmentTitle}] - 제출완료\n${submission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`, { createdAt: new Date().toISOString() });
                    } else {
                        // 미제출: 미제출 안내 (스트리밍)
                        startStreamingAiMessage(`${submission.name}님의 과제가 아직 제출되지 않았습니다.`, { createdAt: new Date().toISOString() });
                    }
                } else {
                    // 정보 없음: 안내 (스트리밍)
                    const reply = lastAskedSubmission?.name ? `${lastAskedSubmission.name}님의 제출 현황을 보려면...` : "어느 분의 제출 현황을 알려드릴까요?";
                    startStreamingAiMessage(reply, { createdAt: new Date().toISOString() });
                }
                return;
            }

            // 과제 이름/번호 매칭
            const matched = findAssignmentFromMessage(text, assignmentList);
            if (matched) { loadSubmissionsForMessageIndex(matched.id, matched.title, userMessageIndex); return; }

            // 제출물 기반 AI 질문 처리 (요약/예상문제)
            const hasSummaryKeyword = text.includes("과제 요약") || text.includes("요약해") || text.includes("요약");
            const hasProblemKeyword =
                text.includes("예상문제") ||
                text.includes("예상 문제") ||
                text.includes("문제 내줘") ||
                text.includes("문제 내주") ||
                text.includes("문제 내 ") ||
                /\d+문제\s*내/.test(text) ||
                (text.includes("객관식") && text.includes("문제")) ||
                (text.includes("주관식") && (text.includes("내줘") || text.includes("내주") || text.includes("문제")));

            // '과제' 키워드가 있어도 "요약/예상문제" 의도면 목록을 띄우지 않음
            // (예: "과제를 요약해줘"가 과제목록으로 빠지는 문제 방지)
            const trimmedText = (text || "").trim();
            const isAssignmentListIntent =
                trimmedText === "과제" ||
                trimmedText === "과제!" ||
                trimmedText === "과제?" ||
                text.includes("과제 목록") ||
                text.includes("과제목록") ||
                text.includes("과제 보여") ||
                text.includes("과제 알려") ||
                text.includes("과제 제출") ||
                text.includes("제출 현황") ||
                text.includes("과제 현황");
            if (text.includes("과제") && isAssignmentListIntent && !hasSummaryKeyword && !hasProblemKeyword) {
                setShowAssignmentListAfterIndex(userMessageIndex);
                return;
            }

            // 프롬프트에 제출한 사람 닉네임이 있으면: 미제출이면 안내, 제출+요약/문제 키워드 있으면 바로 진행, 없으면 "요약할까요? 예상문제?"만 표시
            const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage);
            
            if (matchedSubmission) {
                if (!matchedSubmission.fileUrl) {
                    startStreamingAiMessage(`${matchedSubmission.name}님의 과제가 아직 제출되지 않았습니다.`, { createdAt: new Date().toISOString() });
                    return;
                }
                setLastAskedSubmission({ submissionId: matchedSubmission.submissionId, name: matchedSubmission.name });
                if (!hasSummaryKeyword && !hasProblemKeyword) {
                    startStreamingAiMessage(`${matchedSubmission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`, { createdAt: new Date().toISOString() });
                    return;
                }
            }

            if (lastAskedSubmission && (hasSummaryKeyword || hasProblemKeyword)) {
                // 사용자 메시지(예: "2과목 요약해줘", "1과목 예상문제 내줘")를 그대로 전달해 AI가 해당 부분만 처리
                const loadingType = hasProblemKeyword ? "problem" : "summary";
                setLoadingPhaseForSubmission(1);
                setAiMessages(prev => [...prev, { userId: "AI_BOT", userName: "AI 튜터", message: "DB에서 파일 가져오는중...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true, loadingSubmissionType: loadingType }]);
                try {
                    const res = await api.post("/ai/chat/with-submission", { message: text.trim(), submissionId: String(lastAskedSubmission.submissionId) });
                    const replyText = res.data != null ? String(res.data) : "";
                    setLoadingPhaseForSubmission(null);
                    startStreamingAiMessage(
                        replyText,
                        {
                            createdAt: new Date().toISOString(),
                            saveButtons: { question: text, answer: replyText, type: loadingType }
                        },
                        { clearLoading: true }
                    );
                } catch (err) {
                    setLoadingPhaseForSubmission(null);
                    const is400 = err.response?.status === 400;
                    const friendlyMessage = is400 && lastAskedSubmission?.name
                        ? `${lastAskedSubmission.name}님의 과제가 아직 제출되지 않았습니다.`
                        : "제출물 기반 AI 요청에 실패했어요. " + (err.message || "");
                    setAiMessages((prev) =>
                        prev.map((msg) =>
                            msg.isLoading
                                ? { ...msg, message: friendlyMessage, isLoading: false }
                                : msg
                        )
                    );
                }
                return;
            }

            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "질문에 알맞은 답변을 생각 중입니다.", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

            try {
                // 직전까지의 전체 대화를 history로 보내 LLM이 모든 맥락을 기억하게 함 (state 반영 전이므로 현재 메시지 목록 = 지금까지의 대화)
                const history = [];
                for (let i = 1; i < currentMessages.length; i++) {
                    const msg = currentMessages[i];
                    if (msg.isLoading || !msg.message?.trim()) continue;
                    history.push({
                        role: msg.isAiResponse ? "assistant" : "user",
                        content: msg.message.trim()
                    });
                }
                // 토큰 제한 방지를 위해 최근 30개 메시지만 전송 (백엔드에서도 30개로 제한)
                const trimmedHistory = history.length > 30 ? history.slice(-30) : history;

                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${apiBaseUrl}/api/ai/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        message: text,
                        subject: roomName || "일반 지식",
                        history: trimmedHistory
                    })
                });

                if (!res.ok) throw new Error("AI Error");

                let aiReply = await res.text();
                // AI가 '자격증 관련 학습' 또는 '자격증 이름이 바뀌었는지' 등 일반 인사로 답할 때 → 과제/제출 현황 유도 문구로 대체
                if (aiReply && (aiReply.includes("자격증 관련 학습") || aiReply.includes("어떤 자격증이나") || aiReply.includes("자격증이나 공부 방법") || aiReply.includes("자격증의 이름이 바뀌") || aiReply.includes("어떤 자격증의 이름이 바뀌"))) {
                    aiReply =
                        "안녕하세요! 과제 제출 현황이나 목록이 궁금하시다면 '과제 목록을 보여줘' 또는 '과제'라고 입력해보세요. 과제 목록을 확인한 뒤, 원하는 과제의 제출한 사람을 선택하면 요약이나 예상문제를 요청할 수 있어요.";
                }
                startStreamingAiMessage(
                    aiReply,
                    { createdAt: new Date().toISOString() },
                    { clearLoading: true }
                );
            } catch (err) {
                setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "AI 오류", isLoading: false } : msg));
            }
        } else {
            // 일반 채팅 전송
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "TALK", roomId, userId: myInfo.userId, userName: roomNickname || myInfo.userName, message: text
                }));
            }
            // 내가 보낸 건 바로 읽음 처리 (5초 버퍼)
            updateLastReadTime(new Date().toISOString());
        }
    };

    if (!myInfo) return null;

    return (
        <>
            {!isOpen && (
                <div className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`}
                     onClick={toggleChat}
                     onMouseDown={handleMouseDown}
                     style={{ left: `${position.x}px`, top: `${position.y}px` }}>
                    <img src="/chat-ai-icon.png" alt="채팅" style={{ width: '65px', height: '65px', pointerEvents: 'none' }} />
                    {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
                </div>
            )}

            <div ref={modalRef} className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`}
                 style={{ display: isOpen ? 'flex' : 'none', left: `${position.x}px`, top: `${position.y}px`, width: `${lastWindowSize.current.w}px`, height: `${lastWindowSize.current.h}px` }}>

                {isOpen && (
                    <>
                        <div className="resizer resizer-n"  onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
                        <div className="resizer resizer-s"  onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
                        <div className="resizer resizer-e"  onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
                        <div className="resizer resizer-w"  onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
                        <div className="resizer resizer-ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
                        <div className="resizer resizer-nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
                        <div className="resizer resizer-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
                        <div className="resizer resizer-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
                    </>
                )}

                <div className={`tc-header ${isAiMode ? 'ai-mode' : ''}`} onMouseDown={handleMouseDown} style={{ cursor: 'move' }}>
                    <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 " + (roomName +" 소통방" || "소통방")}</span>
                    <div className="tc-icons">
                        {!isAiMode && <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>}
                        <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>{isAiMode ? "채팅방" : "AI"}</button>
                        <span className="icon-btn" onClick={toggleChat}>×</span>
                    </div>
                </div>

                {isMenuOpen && !isAiMode && (
                    <div className="tc-sidebar">
                        <div className="tc-sidebar-title">접속자 ({userList.length})</div>
                        {userList.map(u => <div key={u.userId} className="tc-user-item"><span className="status-dot">●</span>{u.userName}</div>)}
                    </div>
                )}

                <div className={`tc-body ${isAiMode ? 'ai-mode' : ''}`} ref={scrollRef} onClick={() => { setIsMenuOpen(false); setShowStickerMenu(false); }}>
                    {isAiMode ? (
                        <>
                            {currentMessages.length > 0 && (() => {
                                const msg = currentMessages[0];
                                const isMe = !msg.isAiResponse;
                                return (
                                    <div key={0} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                                        {!isMe && <div className="tc-profile">{msg.isAiResponse ? "🤖" : "👤"}</div>}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                            {!isMe && <div className="tc-name">{msg.userName}</div>}
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''}`}>
                                                    {msg.isSticker ? <div className="sticker-text">{msg.message}</div> : msg.message}
                                                </div>
                                                <span style={{ fontSize: '10px', color: '#888', minWidth: '50px', textAlign: isMe ? 'right' : 'left', marginBottom: '5px' }}>
                                                    {formatTime(msg.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* 첫 인사 아래: 빠른 실행 버튼 (과제 / 출석 / 일정 / 게시글 조회) */}
                            {currentMessages.length > 0 && currentMessages[0].isAiResponse && (
                                <div className="chat-ai-quick-actions">
                                    <div className="chat-ai-quick-actions-title">바로 확인하기</div>
                                    <button type="button" className="chat-ai-quick-btn" onClick={() => handleQuickAction("assignment")}>
                                        ○ 과제 제출 현황
                                    </button>
                                    <button type="button" className="chat-ai-quick-btn" onClick={() => handleQuickAction("attendance")}>
                                        ○ 출석 현황
                                    </button>
                                    <button type="button" className="chat-ai-quick-btn" onClick={() => handleQuickAction("schedule")}>
                                        ○ 일정 목록
                                    </button>
                                    <button type="button" className="chat-ai-quick-btn" onClick={() => handleQuickAction("board")}>
                                        ○ 게시글 조회
                                    </button>
                                </div>
                            )}
                            {/* 2) 사용자 답변 → (과제 목록은 '과제' 키워드 입력 시 해당 메시지 아래에만) → 제출한 사람 리스트 → AI 답변 순 */}
                            {currentMessages.slice(1).map((msg, i) => {
                                const idx = i + 1;
                                const isMe = !msg.isAiResponse;
                                const submissionData = submissionListAfterMessage[idx];
                                const loadingSubmission = loadingSubmissionForIndex === idx;
                                return (
                                    <React.Fragment key={idx}>
                                        <div className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                                            {!isMe && <div className="tc-profile">{msg.isAiResponse ? "🤖" : "👤"}</div>}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                                {!isMe && <div className="tc-name">{msg.userName}</div>}
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                    <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''}`}>
                                                        {msg.isSticker ? (
                                                            <div className="sticker-text">{msg.message}</div>
                                                        ) : msg.isLoading ? (
                                                            (() => {
                                                                const dots = ".".repeat(loadingDotsPhase + 1);
                                                                if (msg.loadingSubmissionType) {
                                                                    const base =
                                                                        loadingPhaseForSubmission === 1
                                                                            ? "DB에서 파일 가져오는 중"
                                                                            : msg.loadingSubmissionType === "summary"
                                                                                ? "요약하는 중"
                                                                                : "예상문제 만드는 중";
                                                                    return base + dots;
                                                                }
                                                                return "질문에 알맞은 답변을 생각 중입니다" + dots;
                                                            })()
                                                        ) : (
                                                            msg.message
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '10px', color: '#888', minWidth: '50px', textAlign: isMe ? 'right' : 'left', marginBottom: '5px' }}>
                                                        {formatTime(msg.createdAt)}
                                                    </span>
                                                </div>
                                                {!isMe && msg.saveButtons && (
                                                    <div className="chat-ai-save-buttons">
                                                        {msg.saveButtons.type === "summary" && (
                                                            <button type="button" className="chat-ai-save-btn summary" onClick={(e) => { e.stopPropagation(); handleSaveNoteAs(msg.saveButtons.question, msg.saveButtons.answer, "SUMMARY"); }}>
                                                                📋 요약노트에 저장
                                                            </button>
                                                        )}
                                                        {msg.saveButtons.type === "problem" && (
                                                            <button type="button" className="chat-ai-save-btn problem" onClick={(e) => { e.stopPropagation(); handleSaveNoteAs(msg.saveButtons.question, msg.saveButtons.answer, "PROBLEM"); }}>
                                                                📝 문제 노트에 저장
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isMe && showAssignmentListAfterIndex === idx && (
                                            <div className="chat-ai-assignment-panel">
                                                <div className="chat-ai-panel-title">📋 과제 목록</div>
                                                {loadingAssignments ? (
                                                    <div className="chat-ai-panel-loading">불러오는 중...</div>
                                                ) : assignmentList.length === 0 ? (
                                                    <div className="chat-ai-panel-empty">과제가 없습니다.</div>
                                                ) : (
                                                    <ul className="chat-ai-assignment-list">
                                                        {assignmentList.map((a) => (
                                                            <li key={a.id} className="chat-ai-assignment-item" onClick={(e) => { e.stopPropagation(); handleClickAssignmentInList(a); }}>
                                                                <span className="chat-ai-assignment-title">{a.title}</span>
                                                                <span className="chat-ai-assignment-due">마감 {a.dueDate}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                        {/* '출석' 입력 시 해당 사용자 메시지 아래에 전체 출석 리스트 표시 */}
                                        {isMe && showAttendanceListAfterIndex === idx && (
                                            <div className="chat-ai-assignment-panel chat-ai-attendance-panel">
                                                <div className="chat-ai-panel-title">📅 출석 현황</div>
                                                {loadingAttendance ? (
                                                    <div className="chat-ai-panel-loading">불러오는 중...</div>
                                                ) : attendanceViewRows.length === 0 ? (
                                                    <div className="chat-ai-panel-empty">출석 데이터가 없습니다.</div>
                                                ) : (
                                                    <div className="chat-ai-attendance-table-wrap">
                                                        <table className="chat-ai-attendance-table">
                                                            <thead>
                                                                <tr>
                                                                    <th className="chat-ai-at-name">이름</th>
                                                                    <th className="chat-ai-at-ratio">출석률</th>
                                                                    {Array.from({ length: attendanceData?.studySchedule?.totalSessions || 0 }).map((_, i) => (
                                                                        <th key={i} className="chat-ai-at-session">{i + 1}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {attendanceViewRows.map((r) => (
                                                                    <tr key={r.memberId}>
                                                                        <td className="chat-ai-at-name">{r.name}</td>
                                                                        <td className="chat-ai-at-ratio">
                                                                            <span className="chat-ai-at-ratio-bar" style={{ width: `${r.ratioOverall}%` }} />
                                                                            <span className="chat-ai-at-ratio-text">({r.presentCount}/{r.totalSessions}) {r.ratioOverall}%</span>
                                                                        </td>
                                                                        {r.sessionsView.map((s, i) => (
                                                                            <td key={i} className="chat-ai-at-mark">
                                                                                <span className={s.isPresent ? "chat-ai-at-ok" : "chat-ai-at-absent"}>{s.isPresent ? "○" : "×"}</span>
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* '일정' 입력 시 해당 사용자 메시지 아래에 일정 목록 표시 */}
                                        {isMe && showScheduleListAfterIndex === idx && (
                                            <div className="chat-ai-assignment-panel chat-ai-schedule-panel">
                                                <div className="chat-ai-panel-title">📅 일정 목록</div>
                                                {loadingSchedule ? (
                                                    <div className="chat-ai-panel-loading">불러오는 중...</div>
                                                ) : scheduleList.length === 0 ? (
                                                    <div className="chat-ai-panel-empty">일정이 없습니다.</div>
                                                ) : (
                                                    <ul className="chat-ai-assignment-list chat-ai-schedule-list">
                                                        {scheduleList.map((s) => (
                                                            <li key={s.id} className="chat-ai-assignment-item chat-ai-schedule-item">
                                                                <span className="chat-ai-schedule-title">{s.title}</span>
                                                                <span className="chat-ai-schedule-date">
                                                                    {s.dateDisplay}
                                                                    {s.type === "STUDY" ? " (스터디)" : ""}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                        {/* '게시글 조회' 또는 '게시판'/'게시글' 입력 시 해당 메시지 아래에 최근 5개 게시글 목록 표시 */}
                                        {isMe && showBoardListAfterIndex === idx && (
                                            <div className="chat-ai-assignment-panel chat-ai-board-panel">
                                                <div className="chat-ai-panel-title">📌 최근 게시글 (5개)</div>
                                                {loadingBoard ? (
                                                    <div className="chat-ai-panel-loading">불러오는 중...</div>
                                                ) : boardList.length === 0 ? (
                                                    <div className="chat-ai-panel-empty">게시글이 없습니다.</div>
                                                ) : (
                                                    <ul className="chat-ai-assignment-list chat-ai-board-list">
                                                        {boardList.map((p) => (
                                                            <li
                                                                key={p.postId}
                                                                className="chat-ai-assignment-item chat-ai-board-item"
                                                                onClick={(e) => { e.stopPropagation(); navigate(`/lms/${roomId}/board/${p.postId}`); }}
                                                            >
                                                                <span className="chat-ai-board-title">{p.title}</span>
                                                                <span className="chat-ai-board-meta">{p.nickname} · {p.createdAt}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                        {/* 사용자 메시지 뒤에 제출한 사람 리스트 인라인 표시 */}
                                        {isMe && (submissionData || loadingSubmission) && (
                                            <div className="chat-ai-assignment-panel chat-ai-inline-submission">
                                                <div className="chat-ai-panel-title chat-ai-panel-title-sub">👥 제출한 사람</div>
                                                {loadingSubmission ? (
                                                    <div className="chat-ai-panel-loading">불러오는 중...</div>
                                                ) : submissionData?.submissions?.length ? (
                                                    <ul className="chat-ai-submission-list">
                                                        {submissionData.submissions.map((s) => (
                                                            <li key={s.submissionId} className="chat-ai-submission-item clickable" onClick={(e) => { e.stopPropagation(); handleClickSubmission(s); }}>
                                                                <span className="chat-ai-submission-name">{s.name}</span>
                                                                <span className="chat-ai-submission-date">{s.submittedAt}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="chat-ai-panel-empty">아직 제출한 사람이 없습니다.</div>
                                                )}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </>
                    ) : (
                        currentMessages.map((msg, idx) => {
                            const isMe = msg.userId === myInfo.userId;
                            return (
                                <div key={idx} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                                    {!isMe && <div className="tc-profile">👤</div>}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                        {!isMe && <div className="tc-name">{msg.userName}</div>}
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                            <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''}`}>
                                                {msg.isSticker ? <div className="sticker-text">{msg.message}</div> : msg.message}
                                            </div>
                                            <span style={{ fontSize: '10px', color: '#888', minWidth: '50px', textAlign: isMe ? 'right' : 'left', marginBottom: '5px' }}>
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {showStickerMenu && !isAiMode && (
                    <div className="sticker-menu-container">
                        {STICKER_LIST.map((s, i) => <button key={i} className="sticker-grid-btn" onClick={() => handleSend(s)}>{s}</button>)}
                    </div>
                )}

                <div className="tc-input-area">
                    {!isAiMode && <button className="tc-sticker-toggle-btn" onClick={() => setShowStickerMenu(!showStickerMenu)}>😊</button>}
                    <input
                        className="tc-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="메시지 입력"
                    />
                    <button className={`tc-send-btn ${isAiMode ? 'ai-mode' : ''}`} onClick={() => handleSend()}>전송</button>
                </div>
            </div>
        </>
    );
};

export default ChatModal;