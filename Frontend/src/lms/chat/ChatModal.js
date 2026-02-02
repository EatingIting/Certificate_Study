import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';
import { getHostnameWithPort, getWsProtocol } from "../../utils/backendUrl";

// =================================================================
// [상수 및 환경 설정]
// =================================================================
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360;
const MODAL_HEIGHT = 600;
const BUTTON_SIZE = 70;

const ChatModal = ({ roomId, roomName }) => {
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

    const [chatMessages, setChatMessages] = useState([]); // 일반 채팅 메시지 목록
    const [aiMessages, setAiMessages] = useState([{       // AI 채팅 메시지 목록 (초기값)
        userId: 'AI_BOT',
        userName: 'AI 튜터',
        message: `안녕하세요! '${roomName || '이 스터디'}'에 대해 궁금한 점을 물어보세요.`,
        createdAt: new Date().toISOString(),
        isAiResponse: true
    }]);

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
    
    // 동적 URL 생성 (소켓 포트 8080 강제 지정)
    const { apiBaseUrl, wsUrl } = useMemo(() => {
        const host = getHostnameWithPort();
        const wsProtocol = getWsProtocol();
        const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';

        let wsHost = host;
        // 로컬 환경일 경우 3000 -> 8080 포트 변경
        if (host.includes(":3000")) {
            wsHost = host.replace(":3000", ":8080");
        }

        return {
            apiBaseUrl: `${httpProtocol}://${host}`,
            wsUrl: `${wsProtocol}://${wsHost}`
        };
    }, []);

    // 사용자 정보 가져오기
    const myInfo = useMemo(() => {
        try {
            const storedUserId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
            const storedUserName = localStorage.getItem("userName") || sessionStorage.getItem("userName") || localStorage.getItem("nickname");
            if (storedUserId) return { userId: storedUserId, userName: storedUserName || "익명" };
        } catch (e) { console.error(e); }
        return null;
    }, []);

    // 현재 모드에 따른 메시지 목록 선택
    const currentMessages = isAiMode ? aiMessages : chatMessages;

    // 시간 포맷팅 함수 (오전/오후 hh:mm)
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

    // 🟢 [API] 오답노트 저장 함수
    const handleSaveNote = async (question, answer) => {
        if (!window.confirm("이 내용을 오답노트에 저장하시겠습니까?")) return;

        try {
            const token = sessionStorage.getItem("accessToken");
            const res = await fetch(`${apiBaseUrl}/api/answernote`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId: roomId,
                    question: question,
                    answer: answer,
                    memo: "AI 채팅에서 저장됨"
                })
            });

            if (res.ok) {
                alert("✅ 오답노트에 저장되었습니다!");
            } else {
                alert("저장에 실패했습니다.");
            }
        } catch (err) {
            console.error("오답노트 저장 오류:", err);
        }
    };

    // =================================================================
    // 3. [API] 지난 대화 내용 불러오기
    // =================================================================
    useEffect(() => {
        if (!isOpen || !roomId || !myInfo) return;

        const fetchChatHistory = async () => {
            try {
                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");

                const res = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/messages`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": token ? `Bearer ${token}` : ""
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    // DB 데이터를 프론트엔드 형식으로 변환
                    const dbMessages = data.map(msg => {
                        // 백엔드 엔티티 필드명(messageText)과 DTO 필드명(message) 호환 처리
                        const text = msg.messageText || msg.message || ""; 
                        
                        return {
                            userId: msg.userId,
                            userName: msg.userName || "알 수 없음", // DB에서 가져온 이름 사용
                            message: text,
                            isSticker: STICKER_LIST.includes(text),
                            createdAt: msg.createdAt || new Date().toISOString(),
                            messageType: msg.messageType || "TALK"
                        };
                    }).filter(msg => msg.message && msg.message.trim() !== ""); // 빈 메시지 제외

                    setChatMessages(dbMessages);
                    // 스크롤을 맨 아래로 이동시키기 위해 약간의 지연 후 실행 (선택 사항)
                    setTimeout(() => {
                         if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }, 100);
                }
            } catch (err) {
                console.error("채팅 기록 로드 에러:", err);
            }
        };

        fetchChatHistory();
    }, [isOpen, roomId, myInfo, apiBaseUrl]);


    // =================================================================
    // 4. WebSocket 연결 및 핸들링
    // =================================================================
    useEffect(() => {
        if (!roomId || !myInfo) return;

        const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
        
        // 소켓 URL 생성 (쿼리 파라미터로 정보 전달)
        const wsUrlStr = `${wsUrl}/ws/chat/${roomId}?userId=${encodeURIComponent(myInfo.userId)}&userName=${encodeURIComponent(myInfo.userName)}&token=${encodeURIComponent(token)}`;
        console.log("웹소켓 연결 시도:", wsUrlStr);

        const socket = new WebSocket(wsUrlStr);
        ws.current = socket;

        socket.onopen = () => {
            console.log("✅ 웹소켓 연결 성공!");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "TALK") {
                // 🚨 [중복 방지 로직]
                setChatMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    // 내용, 보낸사람, 시간이 거의 일치하면 중복으로 간주
                    if (lastMsg &&
                        lastMsg.message === data.message &&
                        lastMsg.userId === data.userId &&
                        (new Date().getTime() - new Date(lastMsg.createdAt).getTime() < 500)) {
                        return prev;
                    }
                    return [...prev, {
                        userId: data.userId,
                        userName: data.userName,
                        message: data.message,
                        isSticker: STICKER_LIST.includes(data.message),
                        createdAt: data.createdAt || new Date().toISOString()
                    }];
                });

                // 채팅창이 닫혀있거나 AI모드일 때 알림 배지 증가
                if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);

            } else if (data.type === "USERS_UPDATE") {
                // 접속자 목록 갱신 (중복 제거)
                const uniqueUsers = data.users.filter((v, i, a) => a.findIndex(t => (t.userId === v.userId)) === i);
                console.log("👥 접속자 목록 갱신:", uniqueUsers);
                setUserList(uniqueUsers);
            }
        };

        socket.onclose = () => {
            console.log("🔌 웹소켓 연결 종료");
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
        };
    }, [isOpen, roomId, myInfo, wsUrl]); 

    // 메시지 추가 시 스크롤 자동 이동
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentMessages, isOpen]);


    // =================================================================
    // 5. 이벤트 핸들러 (드래그, 리사이즈, 전송 등)
    // =================================================================
    
    // 드래그 시작
    const handleMouseDown = (e) => {
        isDragging.current = false;
        accumulatedMove.current = 0;
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // 리사이즈 시작
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

    // 마우스 이동 (드래그 및 리사이즈 공용)
    const handleMouseMove = (e) => {
        // 리사이즈 로직
        if (resizeRef.current && resizeRef.current.active) {
            const { dir, startX, startY, startW, startH, startLeft, startTop } = resizeRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newW = startW, newH = startH, newX = startLeft, newY = startTop;

            if (dir.includes('e')) newW = startW + dx;
            if (dir.includes('s')) newH = startH + dy;
            if (dir.includes('w')) { newW = startW - dx; newX = startLeft + dx; }
            if (dir.includes('n')) { newH = startH - dy; newY = startTop + dy; }

            // 최소 크기 제한
            if (newW < 360) { newW = 360; if (dir.includes('w')) newX = startLeft + (startW - 360); }
            if (newH < 600) { newH = 600; if (dir.includes('n')) newY = startTop + (startH - 600); }

            // 화면 이탈 방지
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

        // 드래그 로직
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

    // 마우스 업 (이벤트 해제)
    const handleMouseUp = () => {
        setTimeout(() => { isDragging.current = false; }, 50);
        if (resizeRef.current) resizeRef.current.active = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // 채팅창 열기/닫기 토글
    const toggleChat = () => {
        if (isDragging.current || accumulatedMove.current > 5) return;

        if (isOpen) {
            // 닫을 때 현재 위치/크기 저장
            if (modalRef.current) lastWindowSize.current = { w: modalRef.current.offsetWidth, h: modalRef.current.offsetHeight };
            if (lastButtonPos.current) {
                setPosition(lastButtonPos.current);
                lastButtonPos.current = null;
            } else if (modalRef.current) {
                // 버튼으로 축소되는 애니메이션 효과를 위한 위치 계산
                const currentW = modalRef.current.offsetWidth;
                const currentH = modalRef.current.offsetHeight;
                let newX = Math.min(Math.max(0, position.x + (currentW - BUTTON_SIZE)), window.innerWidth - BUTTON_SIZE);
                let newY = Math.min(Math.max(0, position.y + (currentH - BUTTON_SIZE)), window.innerHeight - BUTTON_SIZE);
                setPosition({ x: newX, y: newY });
            }
        } else {
            // 열 때 이전 위치/크기 복원
            lastButtonPos.current = { x: position.x, y: position.y };
            const targetW = lastWindowSize.current.w;
            const targetH = lastWindowSize.current.h;
            let newX = Math.max(0, position.x - (targetW - BUTTON_SIZE));
            let newY = Math.max(0, position.y - (targetH - BUTTON_SIZE));

            if (newX + targetW > window.innerWidth) newX = window.innerWidth - targetW;
            if (newY + targetH > window.innerHeight) newY = window.innerHeight - targetH;
            setPosition({ x: newX, y: newY });
        }
        setIsOpen(!isOpen);
        if (!isOpen) setUnreadCount(0);
    };

    // AI 모드 토글
    const toggleAiMode = () => setIsAiMode(!isAiMode);

    // 메시지 전송
    const handleSend = async (text = inputValue) => {
        if (!text.trim()) return;
        if (!myInfo) return;

        setInputValue("");
        setShowStickerMenu(false);

        if (isAiMode) {
            // [AI 모드]
            setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);
            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

            try {
                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
                if (!token) throw new Error("로그인 토큰이 없습니다.");

                const res = await fetch(`${apiBaseUrl}/api/ai/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: text, subject: roomName || "일반 지식" })
                });

                if (res.status === 401) throw new Error("Unauthorized");
                if (!res.ok) throw new Error("AI Error");

                const aiReply = await res.text();
                setAiMessages(prev => {
                    const clean = prev.filter(msg => !msg.isLoading);
                    return [...clean, { userId: 'AI_BOT', userName: 'AI 튜터', message: aiReply, createdAt: new Date().toISOString(), isAiResponse: true }];
                });
            } catch (err) {
                setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "AI 서버 연결 실패 😭 (로그인 확인 필요)", isLoading: false } : msg));
            }
        } else {
            // [일반 채팅 모드]
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "TALK",
                    roomId,
                    userId: myInfo.userId,
                    userName: myInfo.userName,
                    message: text
                }));
            } else {
                console.error("웹소켓 연결이 끊겨있어 메시지를 보낼 수 없습니다.");
            }
        }
    };

    if (!myInfo) return null;

    return (
        <>
            {/* 플로팅 버튼 (채팅창 닫혀있을 때) */}
            {!isOpen && (
                <div className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`}
                     onClick={toggleChat}
                     onMouseDown={handleMouseDown}
                     style={{ left: `${position.x}px`, top: `${position.y}px` }}>
                    <img src="/chat-ai-icon.png" alt="채팅" style={{ width: '65px', height: '65px', pointerEvents: 'none' }} />
                    {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
                </div>
            )}

            {/* 채팅 모달 창 */}
            <div ref={modalRef} className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`}
                 style={{ display: isOpen ? 'flex' : 'none', left: `${position.x}px`, top: `${position.y}px`, width: `${lastWindowSize.current.w}px`, height: `${lastWindowSize.current.h}px` }}>

                {/* 리사이즈 핸들러들 */}
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

                {/* 헤더 */}
                <div className={`tc-header ${isAiMode ? 'ai-mode' : ''}`} onMouseDown={handleMouseDown} style={{ cursor: 'move' }}>
                    <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 스터디룸 채팅"}</span>
                    <div className="tc-icons">
                        {!isAiMode && <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>}
                        <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>{isAiMode ? "채팅방" : "AI"}</button>
                        <span className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleChat(); }}>×</span>
                    </div>
                </div>

                {/* 접속자 사이드바 (일반 모드일 때) */}
                {isMenuOpen && !isAiMode && (
                    <div className="tc-sidebar">
                        <div className="tc-sidebar-title">접속자 ({userList.length})</div>
                        {userList.map(u => <div key={u.userId} className="tc-user-item"><span className="status-dot">●</span>{u.userName}</div>)}
                    </div>
                )}

                {/* 메시지 영역 */}
                <div className={`tc-body ${isAiMode ? 'ai-mode' : ''}`} ref={scrollRef} onClick={() => { setIsMenuOpen(false); setShowStickerMenu(false); }}>
                    {currentMessages.map((msg, idx) => {
                        const isMe = isAiMode ? !msg.isAiResponse : msg.userId === myInfo.userId;

                        // AI 답변일 경우 바로 위 질문 찾기
                        let relatedQuestion = "질문 내용을 찾을 수 없습니다.";
                        if (msg.isAiResponse && idx > 0) {
                            const prevMsg = currentMessages[idx - 1];
                            if (!prevMsg.isAiResponse) {
                                relatedQuestion = prevMsg.message;
                            }
                        }

                        return (
                            <div key={idx} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                                {!isMe && <div className="tc-profile">{isAiMode && msg.isAiResponse ? "🤖" : "👤"}</div>}
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

                                    {/* AI 답변 밑에 '오답노트 저장' 버튼 노출 */}
                                    {isAiMode && msg.isAiResponse && (
                                        <button
                                            className="ai-save-btn"
                                            onClick={() => handleSaveNote(relatedQuestion, msg.message)}
                                        >
                                            📝 오답노트 저장
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 이모티콘 메뉴 */}
                {showStickerMenu && !isAiMode && (
                    <div className="sticker-menu-container">
                        {STICKER_LIST.map((s, i) => <button key={i} className="sticker-grid-btn" onClick={() => handleSend(s)}>{s}</button>)}
                    </div>
                )}

                {/* 입력창 영역 */}
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