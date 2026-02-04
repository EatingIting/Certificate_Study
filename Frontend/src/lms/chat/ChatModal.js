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

    // 이 방에서 사용할 전용 닉네임 (기본값 null)
    const [roomNickname, setRoomNickname] = useState(null);

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

    // 사용자 정보 가져오기
    const myInfo = useMemo(() => {
        try {
            const storedUserId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
            const storedUserName = localStorage.getItem("userName") || sessionStorage.getItem("userName") || localStorage.getItem("nickname");
            if (storedUserId) return { userId: storedUserId, userName: storedUserName || "익명" };
        } catch (e) { console.error(e); }
        return null;
    }, []);

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

    // [API] 오답노트 저장 함수
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
    }, [roomId, myInfo, wsUrl, roomNickname, isOpen]); // isOpen이 바뀌면 읽음 처리 로직 갱신


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

    const handleSend = async (text = inputValue) => {
        if (!text.trim()) return;
        if (!myInfo) return;

        setInputValue("");
        setShowStickerMenu(false);

        if (isAiMode) {
            setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);
            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

            try {
                const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
                const res = await fetch(`${apiBaseUrl}/api/ai/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ message: text, subject: roomName || "일반 지식" })
                });

                if (!res.ok) throw new Error("AI Error");
                const aiReply = await res.text();
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
                    {currentMessages.map((msg, idx) => {
                        const isMe = isAiMode ? !msg.isAiResponse : msg.userId === myInfo.userId;
                        let relatedQuestion = "";
                        if (msg.isAiResponse && idx > 0) relatedQuestion = currentMessages[idx - 1].message;

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
                                    {isAiMode && msg.isAiResponse && (
                                        <button className="ai-save-btn" onClick={() => handleSaveNote(relatedQuestion, msg.message)}>📝 오답노트 저장</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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