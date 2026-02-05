import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    const [aiMessages, setAiMessages] = useState([{       // AI 채팅 메시지 목록 (초기값)
        userId: 'AI_BOT',
        userName: 'AI 튜터',
        message: `안녕하세요! 과제에 대해 궁금한 점을 물어보세요!`,
        createdAt: new Date().toISOString(),
        isAiResponse: true
    }]);

    // AI 모드 관련 상태들
    const [assignmentList, setAssignmentList] = useState([]);
    const [submissionListAfterMessage, setSubmissionListAfterMessage] = useState({});
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [loadingSubmissionForIndex, setLoadingSubmissionForIndex] = useState(null);
    const [lastAskedSubmission, setLastAskedSubmission] = useState(null);
    const [loadingPhaseForSubmission, setLoadingPhaseForSubmission] = useState(null);
    const [showAssignmentListAfterIndex, setShowAssignmentListAfterIndex] = useState(null);

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

    // 최신 메시지 목록을 실시간으로 추적하는 Ref (타이밍 이슈 해결용)
    const latestMessagesRef = useRef(chatMessages);

    // chatMessages가 변할 때마다 Ref도 업데이트
    useEffect(() => {
        latestMessagesRef.current = chatMessages;
    }, [chatMessages]);

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

    // AI 노트 저장 관련 함수들 (기존 유지)
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

        socket.onclose = () => { console.log("🔌 웹소켓 연결 종료"); };

        return () => {
            if (socket.readyState === WebSocket.OPEN) socket.close();
        };
    }, [isOpen, roomId, myInfo, wsUrl, roomNickname]); 

    // AI 로딩 및 스크롤 처리
    useEffect(() => {
        if (loadingPhaseForSubmission !== 1) return;
        const t = setTimeout(() => setLoadingPhaseForSubmission(2), 2000);
        return () => clearTimeout(t);
    }, [loadingPhaseForSubmission]);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentMessages, isOpen]);


    // =================================================================
    // 5. 이벤트 핸들러
    // =================================================================
    const loadSubmissionsForMessageIndex = async (assignmentId, assignmentTitle, messageIndex) => { setLoadingSubmissionForIndex(messageIndex); try { const res = await api.get(`/assignments/${assignmentId}/submissions`); const submissions = (res.data || []).map((x) => ({ submissionId: x.submissionId, name: x.memberName, submittedAt: x.submittedAt ? String(x.submittedAt).replace("T", " ").slice(0, 16) : "-", status: x.status, fileUrl: x.fileUrl })); setSubmissionListAfterMessage((prev) => ({ ...prev, [messageIndex]: { assignmentId, title: assignmentTitle, submissions } })); } catch (e) { setSubmissionListAfterMessage((prev) => ({ ...prev, [messageIndex]: { assignmentId, title: assignmentTitle, submissions: [] } })); } finally { setLoadingSubmissionForIndex(null); } };
    const handleClickSubmission = (submission) => { const hasFile = submission.fileUrl != null && String(submission.fileUrl).trim() !== ""; if (!hasFile) { setAiMessages((prev) => [ ...prev, { userId: "AI_BOT", userName: "AI 튜터", message: `${submission.name}님의 과제가 아직 제출되지 않았습니다.`, createdAt: new Date().toISOString(), isAiResponse: true } ]); return; } setLastAskedSubmission({ submissionId: submission.submissionId, name: submission.name }); setAiMessages((prev) => [ ...prev, { userId: "AI_BOT", userName: "AI 튜터", message: `${submission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`, createdAt: new Date().toISOString(), isAiResponse: true } ]); };
    const handleClickAssignmentInList = (assignment) => { const newIndex = aiMessages.length; setAiMessages((prev) => [ ...prev, { userId: myInfo.userId, message: `${assignment.title} 과제 제출 목록`, createdAt: new Date().toISOString(), isAiResponse: false } ]); loadSubmissionsForMessageIndex(assignment.id, assignment.title, newIndex); };
    const normalizeForNameMatch = (str) => (str || "").replace(/\s/g, "").replace(/[?()*]/g, "").trim();
    const isNameChangeQuestion = (msg) => { const n = normalizeForNameMatch(msg || ""); return n === "이름이바뀌었나요" || (n.includes("이름") && (n.includes("바뀌") || n.includes("바꿨"))); };
    const getAssignmentInfoForSubmission = (submissionIdOrName, listAfterMessage) => { const list = Object.values(listAfterMessage || {}); for (const entry of list) { const subs = entry.submissions || []; const found = typeof submissionIdOrName === "object" ? subs.find((s) => s.submissionId === submissionIdOrName.submissionId) : subs.find((s) => s.submissionId === submissionIdOrName || (s.name && String(s.name) === String(submissionIdOrName))); if (found) return { assignmentTitle: entry.title || "과제", submission: found }; } return null; };
    const findSubmissionNameFromMessage = (messageText, listAfterMessage) => { if (!messageText?.trim()) return null; const trimmed = messageText.trim(); const allSubmissions = Object.values(listAfterMessage || {}).flatMap((d) => d.submissions || []); const exact = allSubmissions.find((s) => s.name && (trimmed === s.name || trimmed.includes(s.name) || s.name.includes(trimmed))); if (exact) return exact; const words = trimmed.split(/[\s의님,]+/).filter((w) => w.length >= 1); const byWord = allSubmissions.find((s) => s.name && words.some((w) => s.name.includes(w))); if (byWord) return byWord; const normMsg = normalizeForNameMatch(trimmed); if (normMsg.length < 2) return null; return allSubmissions.find( (s) => s.name && (normalizeForNameMatch(s.name).includes(normMsg) || normMsg.includes(normalizeForNameMatch(s.name))) ) || null; };
    const findAssignmentFromMessage = (messageText, list) => { if (!messageText || !list?.length) return null; const trimmed = messageText.trim(); const byTitle = list.find((a) => trimmed === a.title || trimmed === String(a.id)); if (byTitle) return byTitle; const byTitleContains = list.find((a) => a.title && trimmed.includes(a.title)); if (byTitleContains) return byTitleContains; const numbers = trimmed.match(/\d+/g); if (numbers) { const byId = list.find((a) => numbers.includes(String(a.id))); if (byId) return byId; } return null; };
    
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

    const handleSend = async (text = inputValue) => {
        if (!text.trim()) return;
        if (!myInfo) return;
        setInputValue("");
        setShowStickerMenu(false);

        if (isAiMode) {
            // [AI 모드] 사용자 답변 추가
            const userMessageIndex = currentMessages.length;
            setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);

            // '과제' 키워드 처리
            if (text.includes("과제")) { setShowAssignmentListAfterIndex(userMessageIndex); return; }

            // 인사 등 단순 답변 처리
            const trimmedLower = text.trim().toLowerCase();
            const isGreeting = /^안녕(하세요)?\.?$/.test(trimmedLower) || trimmedLower === "안녕" || trimmedLower === "하이" || trimmedLower === "hello";
            if (isGreeting) { setAiMessages((prev) => [ ...prev, { userId: "AI_BOT", userName: "AI 튜터", message: "안녕하세요! 과제 제출 현황이나 목록이 궁금하시다면 '과제 목록을 보여줘' 또는 '과제'라고 입력해보세요.", createdAt: new Date().toISOString(), isAiResponse: true } ]); return; }

            // "이름이 바뀌었나요?" 처리
            if (isNameChangeQuestion(text)) {
                let info = null;
                if (lastAskedSubmission) { info = getAssignmentInfoForSubmission(lastAskedSubmission.submissionId, submissionListAfterMessage); }
                if (!info) { const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage); if (matchedSubmission) { info = getAssignmentInfoForSubmission(matchedSubmission.submissionId, submissionListAfterMessage) || { assignmentTitle: "과제", submission: matchedSubmission }; } }
                let reply = info?.submission ? `${info.submission.name}님의 제출 현황: [${info.assignmentTitle}] - ${info.submission.fileUrl ? "제출완료" : "미제출"}` : (lastAskedSubmission?.name ? `${lastAskedSubmission.name}님의 제출 현황을 보려면...` : "어느 분의 제출 현황을 알려드릴까요?");
                setAiMessages((prev) => [ ...prev, { userId: "AI_BOT", userName: "AI 튜터", message: reply, createdAt: new Date().toISOString(), isAiResponse: true } ]); return;
            }

            // 과제 이름/번호 매칭
            const matched = findAssignmentFromMessage(text, assignmentList);
            if (matched) { loadSubmissionsForMessageIndex(matched.id, matched.title, userMessageIndex); return; }

            // 제출물 기반 AI 질문 처리 (요약/예상문제)
            const hasSummaryKeyword = text.includes("과제 요약") || text.includes("요약해") || text.includes("요약");
            const hasProblemKeyword = text.includes("예상문제") || text.includes("문제 내줘");
            const matchedSubmission = findSubmissionNameFromMessage(text, submissionListAfterMessage);
            
            if (matchedSubmission) {
                if (!matchedSubmission.fileUrl) { setAiMessages(prev => [...prev, { userId: "AI_BOT", userName: "AI 튜터", message: `${matchedSubmission.name}님의 과제가 아직 제출되지 않았습니다.`, createdAt: new Date().toISOString(), isAiResponse: true }]); return; }
                setLastAskedSubmission({ submissionId: matchedSubmission.submissionId, name: matchedSubmission.name });
                if (!hasSummaryKeyword && !hasProblemKeyword) { setAiMessages(prev => [...prev, { userId: "AI_BOT", userName: "AI 튜터", message: `${matchedSubmission.name}님의 과제를 요약할까요? 예상문제를 낼까요?`, createdAt: new Date().toISOString(), isAiResponse: true }]); return; }
            }

            if (lastAskedSubmission && (hasSummaryKeyword || hasProblemKeyword)) {
                const loadingType = hasProblemKeyword ? "problem" : "summary";
                setLoadingPhaseForSubmission(1);
                setAiMessages(prev => [...prev, { userId: "AI_BOT", userName: "AI 튜터", message: "DB에서 파일 가져오는중...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true, loadingSubmissionType: loadingType }]);
                try {
                    const res = await api.post("/ai/chat/with-submission", { message: text.trim(), submissionId: String(lastAskedSubmission.submissionId) });
                    const replyText = res.data != null ? String(res.data) : "";
                    setLoadingPhaseForSubmission(null);
                    setAiMessages(prev => { const clean = prev.filter(msg => !msg.isLoading); return [...clean, { userId: 'AI_BOT', userName: 'AI 튜터', message: replyText, createdAt: new Date().toISOString(), isAiResponse: true, saveButtons: { question: text, answer: replyText, type: loadingType } }]; });
                } catch (err) { setLoadingPhaseForSubmission(null); setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "제출물 기반 AI 요청 실패", isLoading: false } : msg)); }
                return;
            }

            // 일반 AI 대화
            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);
            try {
                const token = sessionStorage.getItem("accessToken");
                const res = await fetch(`${apiBaseUrl}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ message: text, subject: roomName || "일반 지식" }) });
                if (!res.ok) throw new Error("AI Error");
                const aiReply = await res.text();
                setAiMessages(prev => { const clean = prev.filter(msg => !msg.isLoading); return [...clean, { userId: 'AI_BOT', userName: 'AI 튜터', message: aiReply, createdAt: new Date().toISOString(), isAiResponse: true }]; });
            } catch (err) { setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "AI 오류", isLoading: false } : msg)); }
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
                                                                ? "DB에서 문제 가져오는중..."
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
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="메시지 입력"
                    />
                    <button className={`tc-send-btn ${isAiMode ? 'ai-mode' : ''}`} onClick={() => handleSend()}>전송</button>
                </div>
            </div>
        </>
    );
};

export default ChatModal;