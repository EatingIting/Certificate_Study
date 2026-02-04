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
    // 출석부/스터디원/게시판/헤더와 동일한 표시명 (방별 닉네임 우선 → 전역 닉네임 → 이름)
    const { displayName } = useLMS();

    // =================================================================
    // 1. 상태 관리 (State)
    // =================================================================
    const [isOpen, setIsOpen] = useState(false);         // 채팅창 열림 여부
    const [isMenuOpen, setIsMenuOpen] = useState(false); // 햄버거 메뉴 열림 여부
    const [showStickerMenu, setShowStickerMenu] = useState(false); // 이모티콘 메뉴
    const [unreadCount, setUnreadCount] = useState(0);   // 읽지 않은 메시지 수

    const [isAiMode, setIsAiMode] = useState(false);     // AI 모드 여부
    const [inputValue, setInputValue] = useState("");    // 입력창 값
    const [userList, setUserList] = useState([]);        // 접속자 목록

    // 이 방에서 사용할 전용 닉네임 (기본값 null)
    const [roomNickname, setRoomNickname] = useState(null);

    const [chatMessages, setChatMessages] = useState([]); // 일반 채팅 메시지 목록
    const [aiMessages, setAiMessages] = useState([{       // AI 채팅 메시지 목록 (초기값)
        userId: 'AI_BOT',
        userName: 'AI 튜터',
        message: `안녕하세요! LMS에서 궁금한 점을 물어보세요!`,
        createdAt: new Date().toISOString(),
        isAiResponse: true
    }]);

    // AI 모드: 과제 목록 / 메시지별 제출한 사람 목록 (메시지 인덱스 → 제출 목록)
    const [assignmentList, setAssignmentList] = useState([]);
    const [submissionListAfterMessage, setSubmissionListAfterMessage] = useState({}); // { [index]: { assignmentId, title, submissions } }
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [loadingSubmissionForIndex, setLoadingSubmissionForIndex] = useState(null); // 메시지 인덱스 또는 null
    // "xxx님의 과제를 요약할까요? 예상문제를 낼까요?" 대상 제출자 → 이후 '과제 요약'/'예상문제' 입력 시 사용
    const [lastAskedSubmission, setLastAskedSubmission] = useState(null); // { submissionId, name } | null
    // 과제 요약/예상문제 로딩 단계: 1 = DB에서 파일 가져오는중, 2 = 요약/예상문제 만드는 중
    const [loadingPhaseForSubmission, setLoadingPhaseForSubmission] = useState(null); // 1 | 2 | null
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

    // =================================================================
    // 2. 유틸리티 및 초기 설정
    // =================================================================
    
    // 동적 URL 생성
    const { apiBaseUrl, wsUrl } = useMemo(() => {
        const host = getHostnameWithPort();
        const wsProtocol = getWsProtocol();
        const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';

        let wsHost = host;
        if (host.includes(":3000")) {
            wsHost = host.replace(":3000", ":8080");
        }

        return {
            apiBaseUrl: `${httpProtocol}://${host}`,
            wsUrl: `${wsProtocol}://${wsHost}`
        };
    }, []);

    // 사용자 정보: LMSContext displayName과 동일하게 (방별 닉네임 우선)
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

    // 🟢 [API] 요약노트/문제노트 저장 (type: 'SUMMARY' | 'PROBLEM')
    // 문제 노트 저장 시 AI 인사/안내 문장(첫 문장~첫 문제 전까지) 제외하고 실제 문제 부분만 저장
    const getAnswerForProblemNote = (answer) => {
        if (!answer || typeof answer !== "string") return answer || "";
        const match = answer.match(/\n?\s*###\s*1[.)]\s/);
        if (match && match.index != null) return answer.slice(match.index).trim();
        const dashMatch = answer.match(/\n\s*---\s*\n\s*/);
        if (dashMatch && dashMatch.index != null) return answer.slice(dashMatch.index + dashMatch[0].length).trim();
        return answer;
    };

    // 요약 노트 저장 시 AI 인사·마무리 문장 제거하고 본문만 저장
    const getAnswerForSummaryNote = (answer) => {
        if (!answer || typeof answer !== "string") return answer || "";
        let text = answer.trim();
        // 0) "(아래는 실제...)" / "### 예시)" 다음 --- 부터 "※ 위 내용은" 전까지만 보이게 (위·아래 잘라내기)
        if (text.includes("(아래는 실제") || text.includes("### 예시)")) {
            const belowBlock = text.match(/\n---\s*\n\s*####\s/);
            if (belowBlock && belowBlock.index != null) {
                text = text.slice(belowBlock.index).replace(/^\s*---\s*\n\s*/, "").trim();
            }
        }
        // 1) 본문 시작: 첫 '## ' / '### ' / '---' 다음부터 (일반 케이스)
        if (!text.includes("#### ")) {
            const startRe = /\n\s*---\s*\n\s*|(?:^|\n)\s*(##\s+\d|##\s+[^\n]+|###\s+\d|###\s+[^\n]+)/;
            const idx = text.search(startRe);
            if (idx >= 0) text = text.slice(idx).replace(/^\s*---\s*\n\s*/, "").trim();
        }
        // 2) 맨 끝 멘트 제거: '※ 위 내용은', '궁금한 점이나', '도움이 되었길' 등 이후 잘라내기
        const outroRe = /\n\s*(---\s*\n\s*)?(※\s*위\s*내용은|궁금한\s*점이나|도움이 되었길|더 궁금한|감사합니다|필요하면|언제든 질문해|궁금한 점이 있으시면)/i;
        const cutIdx = text.search(outroRe);
        if (cutIdx >= 0) text = text.slice(0, cutIdx).trim();
        // 끝의 불필요한 '---' 제거
        text = text.replace(/\n\s*---\s*$/, "").trim();
        return text || answer;
    };

    const handleSaveNoteAs = async (question, answer, noteType) => {
        if (!roomId) return;
        const label = noteType === "SUMMARY" ? "요약노트" : "문제 노트";
        if (!window.confirm(`이 내용을 ${label}에 저장하시겠습니까?`)) return;
        const answerToSave =
            noteType === "PROBLEM" ? getAnswerForProblemNote(answer) : noteType === "SUMMARY" ? getAnswerForSummaryNote(answer) : (answer || "");
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

    // 🟢 [추가] 마지막 읽은 시간 업데이트 함수
    const updateLastReadTime = () => {
        if (!roomId) return;
        const now = new Date().toISOString();
        localStorage.setItem(`lastRead_${roomId}`, now);
    };

    // 🟢 [수정] 방 변경 시 초기화
    useEffect(() => {
        if (!roomId) return;

        setChatMessages([]);
        setRoomNickname(null); // 닉네임 초기화 (재로딩 유도)
        setUnreadCount(0); // 일단 0으로 시작 (fetchChatHistory에서 계산됨)
        
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
    }, [roomId]);

    // 🟢 [수정] 채팅창 열 때 처리 (읽음 처리)
    useEffect(() => {
        if (isOpen && roomId) {
            setUnreadCount(0);
            updateLastReadTime(); // 열었으니 현재 시간까지 다 읽은 것으로 처리
        }
    }, [isOpen, roomId]);


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


    // 🟢 [핵심 수정] 채팅 내역 불러오기 + 안 읽은 개수 계산
    useEffect(() => {
        // isOpen 체크 제거! (방에 들어오면 무조건 데이터를 받아와서 계산해야 함)
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
                    
                    // 🚀 [여기서 안 읽은 개수 계산]
                    if (!isOpen && !isAiMode) {
                        const lastReadTimeStr = localStorage.getItem(`lastRead_${roomId}`);
                        
                        if (lastReadTimeStr) {
                            const lastReadTime = new Date(lastReadTimeStr).getTime();
                            // 마지막 읽은 시간보다 뒤에 온 메시지 개수 카운트
                            const unread = dbMessages.filter(msg => 
                                new Date(msg.createdAt).getTime() > lastReadTime
                            ).length;
                            setUnreadCount(unread);
                        } else {
                            // 한 번도 읽은 적 없으면 0으로 두거나, 전체를 안 읽음으로 할 수 있음.
                            // 여기서는 깔끔하게 0으로 시작 (사용자가 클릭하면 그때부터 카운트 시작)
                            setUnreadCount(0);
                        }
                    }

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
            setAiMessages((prev) => [
                ...prev,
                {
                    userId: "AI_BOT",
                    userName: "AI 튜터",
                    message: `${submission.name}님의 과제가 아직 제출되지 않았습니다.`,
                    createdAt: new Date().toISOString(),
                    isAiResponse: true
                }
            ]);
            return;
        }
        setLastAskedSubmission({ submissionId: submission.submissionId, name: submission.name });
        setAiMessages((prev) => [
            ...prev,
            {
                userId: "AI_BOT",
                userName: "AI 튜터",
                message: `${submission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`,
                createdAt: new Date().toISOString(),
                isAiResponse: true
            }
        ]);
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

                // 🟢 창이 닫혀있으면 안 읽은 숫자 증가
                if (!isOpen && !isAiMode) {
                    setUnreadCount(prev => prev + 1);
                } else {
                    // 창이 열려있으면 마지막 읽은 시간 갱신 (실시간 읽음 처리)
                    updateLastReadTime();
                }

            } else if (data.type === "USERS_UPDATE") {
                const uniqueUsers = data.users.filter((v, i, a) => a.findIndex(t => (t.userId === v.userId)) === i);
                setUserList(uniqueUsers);
            }
        };

        socket.onclose = () => { console.log("🔌 웹소켓 연결 종료"); };

        return () => {
            if (socket.readyState === WebSocket.OPEN) socket.close();
        };
    }, [isOpen, roomId, myInfo, wsUrl]);

    // 과제 요약/예상문제 로딩 시 단계별 문구: 1 → 2초 후 → 2
    useEffect(() => {
        if (loadingPhaseForSubmission !== 1) return;
        const t = setTimeout(() => setLoadingPhaseForSubmission(2), 2000);
        return () => clearTimeout(t);
    }, [loadingPhaseForSubmission]);


    // 메시지 추가 시 스크롤 자동 이동 (열려있을 때만)
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentMessages, isOpen]);


    // =================================================================
    // 5. 이벤트 핸들러
    // =================================================================
    
    const handleMouseDown = (e) => {
        isDragging.current = false;
        accumulatedMove.current = 0;
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeMouseDown = (e, direction) => {
        e.preventDefault(); e.stopPropagation();
        resizeRef.current = {
            active: true, dir: direction, startX: e.clientX, startY: e.clientY,
            startW: modalRef.current.offsetWidth, startH: modalRef.current.offsetHeight,
            startLeft: position.x, startTop: position.y
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (resizeRef.current && resizeRef.current.active) {
            const { dir, startX, startY, startW, startH, startLeft, startTop } = resizeRef.current;
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            let newW = startW, newH = startH, newX = startLeft, newY = startTop;

            if (dir.includes('e')) newW = startW + dx;
            if (dir.includes('s')) newH = startH + dy;
            if (dir.includes('w')) { newW = startW - dx; newX = startLeft + dx; }
            if (dir.includes('n')) { newH = startH - dy; newY = startTop + dy; }

            if (newW < 360) { newW = 360; if (dir.includes('w')) newX = startLeft + (startW - 360); }
            if (newH < 600) { newH = 600; if (dir.includes('n')) newY = startTop + (startH - 600); }

            if (newX < 0) { newW += newX; newX = 0; }
            if (newY < 0) { newH += newY; newY = 0; }
            if (newX + newW > window.innerWidth) newW = window.innerWidth - newX;
            if (newY + newH > window.innerHeight) newH = window.innerHeight - newY;

            if (modalRef.current) {
                modalRef.current.style.width = `${newW}px`;
                modalRef.current.style.height = `${newH}px`;
            }
            lastWindowSize.current = { w: newW, h: newH };
            setPosition({ x: newX, y: newY });
            lastButtonPos.current = null;
            return;
        }

        accumulatedMove.current += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (accumulatedMove.current > 5) isDragging.current = true;

        let currentWidth = BUTTON_SIZE, currentHeight = BUTTON_SIZE;
        if (isOpen && modalRef.current) {
            currentWidth = modalRef.current.offsetWidth;
            currentHeight = modalRef.current.offsetHeight;
        }

        const maxX = window.innerWidth - currentWidth;
        const maxY = window.innerHeight - currentHeight;
        let nextX = Math.min(Math.max(0, e.clientX - dragStart.current.x), maxX);
        let nextY = Math.min(Math.max(0, e.clientY - dragStart.current.y), maxY);

        if (isOpen && isDragging.current) lastButtonPos.current = null;
        setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
        setTimeout(() => { isDragging.current = false; }, 50);
        if (resizeRef.current) resizeRef.current.active = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // 토글 (열 때만 읽음 처리)
    const toggleChat = () => {
        if (isDragging.current || accumulatedMove.current > 5) return;

        if (isOpen) {
            // 닫을 때
            if (modalRef.current) lastWindowSize.current = { w: modalRef.current.offsetWidth, h: modalRef.current.offsetHeight };
            if (lastButtonPos.current) { setPosition(lastButtonPos.current); lastButtonPos.current = null; }
            else if (modalRef.current) {
                const currentW = modalRef.current.offsetWidth; const currentH = modalRef.current.offsetHeight;
                let newX = Math.min(Math.max(0, position.x + (currentW - BUTTON_SIZE)), window.innerWidth - BUTTON_SIZE);
                let newY = Math.min(Math.max(0, position.y + (currentH - BUTTON_SIZE)), window.innerHeight - BUTTON_SIZE);
                setPosition({ x: newX, y: newY });
            }
            // 🟢 닫을 때는 숫자를 0으로 초기화하지 않음 (열 때 이미 0 처리됨)
        } else {
            // 열 때
            lastButtonPos.current = { x: position.x, y: position.y };
            const targetW = lastWindowSize.current.w; const targetH = lastWindowSize.current.h;
            let newX = Math.max(0, position.x - (targetW - BUTTON_SIZE));
            let newY = Math.max(0, position.y - (targetH - BUTTON_SIZE));
            if (newX + targetW > window.innerWidth) newX = window.innerWidth - targetW;
            if (newY + targetH > window.innerHeight) newY = window.innerHeight - targetH;
            setPosition({ x: newX, y: newY });
            
            // 🟢 열자마자 읽음 처리
            setUnreadCount(0);
            updateLastReadTime();
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

            // '과제'가 포함된 모든 입력 → 해당 메시지 아래에 과제 목록 표시, AI 호출 안 함 (과제목록, 과제 목록, 과제 제출 현황, 과제 현황 등)
            if (text.includes("과제")) {
                setShowAssignmentListAfterIndex(userMessageIndex);
                return;
            }

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

            // '안녕' 등 인사 → 자격증 AI 호출 대신, 과제 목록 보기로 유도
            const trimmedLower = text.trim().toLowerCase();
            const isGreeting = /^안녕(하세요)?\.?$/.test(trimmedLower) || trimmedLower === "안녕" || trimmedLower === "하이" || trimmedLower === "hello";
            if (isGreeting) {
                setAiMessages((prev) => [
                    ...prev,
                    {
                        userId: "AI_BOT",
                        userName: "AI 튜터",
                        message: "안녕하세요! 과제 제출 현황이나 목록이 궁금하시다면 '과제 목록을 보여줘' 또는 '과제'라고 입력해보세요. 과제 목록을 확인한 뒤, 원하는 과제의 제출한 사람을 선택하면 요약이나 예상문제를 요청할 수 있어요.",
                        createdAt: new Date().toISOString(),
                        isAiResponse: true
                    }
                ]);
                return;
            }

            // "이름이 바뀌었나요?" / "이름이바뀌었나요" 등 → 자격증 AI 응답 대신, 비슷한 사람(또는 마지막에 말한 사람) 제출현황만 표시
            if (isNameChangeQuestion(text)) {
                let info = null;
                if (lastAskedSubmission) {
                    info = getAssignmentInfoForSubmission(lastAskedSubmission.submissionId, submissionListAfterMessage);
                }
                if (!info) {
                    const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage);
                    if (matchedSubmission) {
                        info = getAssignmentInfoForSubmission(matchedSubmission.submissionId, submissionListAfterMessage) || { assignmentTitle: "과제", submission: matchedSubmission };
                    }
                }
                let reply;
                if (info?.submission) {
                    const name = info.submission.name;
                    const hasFile = info.submission.fileUrl != null && String(info.submission.fileUrl).trim() !== "";
                    const statusText = hasFile ? "제출완료" : "미제출";
                    reply = `${name}님의 제출 현황: [${info.assignmentTitle}] - ${statusText}`;
                } else if (lastAskedSubmission?.name) {
                    reply = `${lastAskedSubmission.name}님의 제출 현황을 보려면, 먼저 '과제 목록'에서 해당 과제를 선택한 뒤 다시 말씀해 주세요.`;
                } else {
                    reply = "어느 분의 제출 현황을 알려드릴까요? 과제 목록에서 과제를 선택한 뒤, 이름을 말씀해 주세요.";
                }
                setAiMessages((prev) => [
                    ...prev,
                    {
                        userId: "AI_BOT",
                        userName: "AI 튜터",
                        message: reply,
                        createdAt: new Date().toISOString(),
                        isAiResponse: true
                    }
                ]);
                return;
            }

            // 프롬프트에 과제 이름/번호가 있으면 해당 메시지 뒤에 제출한 사람 리스트만 표시하고, AI 답변은 요청하지 않음
            const matched = findAssignmentFromMessage(text, assignmentList);
            if (matched) {
                loadSubmissionsForMessageIndex(matched.id, matched.title, userMessageIndex);
                return; // 리스트가 뜨면 AI 답변은 보내지 않음
            }

            // 요약/예상문제 키워드 (닉네임+키워드 한 번에 요청 시 바로 진행용)
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

            // 프롬프트에 제출한 사람 닉네임이 있으면: 미제출이면 안내, 제출+요약/문제 키워드 있으면 바로 진행, 없으면 "요약할까요? 예상문제?"만 표시
            const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage);
            if (matchedSubmission) {
                const hasFile = matchedSubmission.fileUrl != null && String(matchedSubmission.fileUrl).trim() !== "";
                if (!hasFile) {
                    setAiMessages((prev) => [
                        ...prev,
                        {
                            userId: "AI_BOT",
                            userName: "AI 튜터",
                            message: `${matchedSubmission.name}님의 과제가 아직 제출되지 않았습니다.`,
                            createdAt: new Date().toISOString(),
                            isAiResponse: true
                        }
                    ]);
                    return;
                }
                setLastAskedSubmission({ submissionId: matchedSubmission.submissionId, name: matchedSubmission.name });
                if (hasSummaryKeyword || hasProblemKeyword) {
                    // 닉네임 + 요약/예상문제 키워드가 함께 있으면 중간 확인 없이 바로 제출물 기반 요청 진행
                } else {
                    setAiMessages((prev) => [
                        ...prev,
                        {
                            userId: "AI_BOT",
                            userName: "AI 튜터",
                            message: `${matchedSubmission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`,
                            createdAt: new Date().toISOString(),
                            isAiResponse: true
                        }
                    ]);
                    return;
                }
            }

            // 제출물 기반 요청 (lastAskedSubmission 있음 = 방금 닉네임 매칭했거나 이전에 선택함) + 요약/예상문제 키워드 → 바로 API 호출
            if (lastAskedSubmission && (hasSummaryKeyword || hasProblemKeyword)) {
                // 사용자 메시지(예: "2과목 요약해줘", "1과목 예상문제 내줘")를 그대로 전달해 AI가 해당 부분만 처리
                const loadingType = hasProblemKeyword ? "problem" : "summary";
                setLoadingPhaseForSubmission(1);
                setAiMessages((prev) => [
                    ...prev,
                    {
                        userId: "AI_BOT",
                        userName: "AI 튜터",
                        message: "DB에서 파일 가져오는중...",
                        createdAt: new Date().toISOString(),
                        isAiResponse: true,
                        isLoading: true,
                        loadingSubmissionType: loadingType
                    }
                ]);
                try {
                    const res = await api.post("/ai/chat/with-submission", {
                        message: text.trim(),
                        submissionId: String(lastAskedSubmission.submissionId)
                    });
                    const replyText = res.data != null ? String(res.data) : "";
                    setLoadingPhaseForSubmission(null);
                    setAiMessages((prev) => {
                        const clean = prev.filter((msg) => !msg.isLoading);
                        return [
                            ...clean,
                            {
                                userId: "AI_BOT",
                                userName: "AI 튜터",
                                message: replyText,
                                createdAt: new Date().toISOString(),
                                isAiResponse: true,
                                saveButtons: { question: text, answer: replyText, type: loadingType }
                            }
                        ];
                    });
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
                setAiMessages(prev => {
                    const clean = prev.filter(msg => !msg.isLoading);
                    return [...clean, { userId: 'AI_BOT', userName: 'AI 튜터', message: aiReply, createdAt: new Date().toISOString(), isAiResponse: true }];
                });
            } catch (err) {
                setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "AI 오류", isLoading: false } : msg));
            }
        } else {
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "TALK",
                    roomId,
                    userId: myInfo.userId,
                    userName: roomNickname || myInfo.userName, 
                    message: text
                }));
            }
            // 내가 보낸 건 바로 읽은 걸로 처리
            updateLastReadTime();
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
                    <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 " + (roomNickname || "로딩중...")}</span>
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
                            {/* 1) 첫 메시지: 안녕하세요! ... */}
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
                                                        ) : msg.isLoading && msg.loadingSubmissionType ? (
                                                            loadingPhaseForSubmission === 1
                                                                ? "DB에서 파일 가져오는중..."
                                                                : msg.loadingSubmissionType === "summary"
                                                                    ? "요약하는 중..."
                                                                    : "예상문제 만드는 중..."
                                                        ) : (
                                                            msg.message
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '10px', color: '#888', minWidth: '50px', textAlign: isMe ? 'right' : 'left', marginBottom: '5px' }}>
                                                        {formatTime(msg.createdAt)}
                                                    </span>
                                                </div>
                                                {/* 과제 요약/예상문제 응답 시 맨 아래 저장 버튼 */}
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
                                        {/* '과제 목록 보여줘' / '과제' 입력 시 해당 사용자 메시지 아래에 과제 목록 표시 */}
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
                                                            <li
                                                                key={a.id}
                                                                className="chat-ai-assignment-item"
                                                                onClick={(e) => { e.stopPropagation(); handleClickAssignmentInList(a); }}
                                                            >
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
                                                            <li
                                                                key={s.submissionId}
                                                                className="chat-ai-submission-item clickable"
                                                                onClick={(e) => { e.stopPropagation(); handleClickSubmission(s); }}
                                                            >
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
                    <input className="tc-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="메시지 입력" />
                    <button className={`tc-send-btn ${isAiMode ? 'ai-mode' : ''}`} onClick={() => handleSend()}>전송</button>
                </div>
            </div>
        </>
    );
};

export default ChatModal;