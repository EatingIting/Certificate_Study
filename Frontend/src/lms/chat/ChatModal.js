import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';
// ✅ 팀장님이 만드신 유틸리티 함수 임포트
import { getHostnameWithPort, getWsProtocol } from "../../utils/backendUrl";

// 🔹 상수 및 환경 설정
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360; 
const MODAL_HEIGHT = 600;
const BUTTON_SIZE = 70; 

const ChatModal = ({ roomId, roomName }) => {
  // =================================================================
  // 1. 상태 관리
  // =================================================================
  const [isOpen, setIsOpen] = useState(false);         
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [showStickerMenu, setShowStickerMenu] = useState(false); 
  const [unreadCount, setUnreadCount] = useState(0);   

  const [isAiMode, setIsAiMode] = useState(false);     
  const [inputValue, setInputValue] = useState("");    
  const [userList, setUserList] = useState([]);        

  const [chatMessages, setChatMessages] = useState([]); 
  const [aiMessages, setAiMessages] = useState([{       
    userId: 'AI_BOT',
    userName: 'AI 튜터',
    message: `안녕하세요! '${roomName || '이 스터디'}'에 대해 궁금한 점을 물어보세요.`,
    createdAt: new Date().toISOString(),
    isAiResponse: true
  }]);

  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  
  // Refs
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const accumulatedMove = useRef(0); 
  const lastButtonPos = useRef(null); 
  const lastWindowSize = useRef({ w: MODAL_WIDTH, h: MODAL_HEIGHT });

  const resizeRef = useRef({ 
    active: false, dir: '', startX: 0, startY: 0, startW: 0, startH: 0, startLeft: 0, startTop: 0 
  });

  const ws = useRef(null);        
  const scrollRef = useRef(null); 
  const modalRef = useRef(null); 

  // URL 설정
  const { apiBaseUrl, wsUrl } = useMemo(() => {
      const host = getHostnameWithPort();
      const wsProtocol = getWsProtocol(); 
      const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';
      return { apiBaseUrl: `${httpProtocol}://${host}`, wsUrl: `${wsProtocol}://${host}` };
  }, []);

  // 사용자 정보 (로컬/세션 둘 다 확인)
  const myInfo = useMemo(() => {
    try {
        const storedUserId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
        const storedUserName = localStorage.getItem("userName") || sessionStorage.getItem("userName") || localStorage.getItem("nickname");
        if (storedUserId) return { userId: storedUserId, userName: storedUserName || "익명" };
    } catch (e) { console.error(e); }
    return null; 
  }, []);

  const currentMessages = isAiMode ? aiMessages : chatMessages;

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

  // =================================================================
  // 🟢 1. 채팅 기록 불러오기 (Session Storage 우선 적용!)
  // =================================================================
  useEffect(() => {
    if (!isOpen || !roomId || !myInfo) return;

    const fetchChatHistory = async () => {
        try {
            // 🚨 [핵심 수정] 세션 스토리지에서 먼저 찾고, 없으면 로컬 스토리지 확인
            const token = sessionStorage.getItem("accessToken") || sessionStorage.getItem("token") || localStorage.getItem("accessToken") || localStorage.getItem("token");
            
            console.log("채팅 기록 로드 시도 - 토큰:", token ? "있음" : "없음");

            const headers = {
                "Content-Type": "application/json"
            };

            // 토큰이 있으면 헤더에 추가
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/messages`, {
                method: "GET",
                headers: headers
            });

            if (res.ok) {
                const data = await res.json();
                const dbMessages = data.map(msg => ({
                    userId: msg.user_id,          
                    userName: msg.nickname,       
                    message: msg.messagetext,     
                    isSticker: STICKER_LIST.includes(msg.messagetext),
                    createdAt: msg.created_at
                }));
                setChatMessages(dbMessages);
            } else if (res.status === 401) {
                console.error("🚨 채팅 기록 로드 실패: 401 Unauthorized (토큰 만료/누락)");
            }
        } catch (err) { console.error("채팅 기록 로드 에러:", err); }
    };
    
    fetchChatHistory();
  }, [isOpen, roomId, myInfo, apiBaseUrl]);

  // WebSocket 연결
  useEffect(() => {
    if (!roomId || !myInfo) return;

    const socket = new WebSocket(
        `${wsUrl}/ws/chat/${roomId}?userId=${encodeURIComponent(myInfo.userId)}&userName=${encodeURIComponent(myInfo.userName)}`
    );

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "TALK") {
            setChatMessages(prev => [...prev, { 
                userId: data.userId, userName: data.userName, message: data.message, 
                isSticker: STICKER_LIST.includes(data.message), createdAt: data.createdAt || new Date().toISOString() 
            }]);
            if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);
        } else if (data.type === "USERS_UPDATE") {
            setUserList(data.users);
        }
    };

    ws.current = socket;
    return () => socket.close();
  }, [isOpen, isAiMode, myInfo, roomId, wsUrl]);

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages, isOpen]);

  // 이벤트 핸들러
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
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
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

  const toggleChat = () => { 
      if (isDragging.current || accumulatedMove.current > 5) return; 

      if (isOpen) {
          if (modalRef.current) lastWindowSize.current = { w: modalRef.current.offsetWidth, h: modalRef.current.offsetHeight };
          if (lastButtonPos.current) {
              setPosition(lastButtonPos.current);
              lastButtonPos.current = null;
          } else if (modalRef.current) {
              const currentW = modalRef.current.offsetWidth;
              const currentH = modalRef.current.offsetHeight;
              let newX = Math.min(Math.max(0, position.x + (currentW - BUTTON_SIZE)), window.innerWidth - BUTTON_SIZE);
              let newY = Math.min(Math.max(0, position.y + (currentH - BUTTON_SIZE)), window.innerHeight - BUTTON_SIZE);
              setPosition({ x: newX, y: newY });
          }
      } else {
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

  const toggleAiMode = () => setIsAiMode(!isAiMode);

  // =================================================================
  // 🟢 2. 메시지 전송 (Session Storage 우선 적용!)
  // =================================================================
  const handleSend = async (text = inputValue) => {
    if (!text.trim()) return;
    if (!myInfo) return;

    setInputValue("");
    setShowStickerMenu(false);

    if (isAiMode) {
        setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);
        setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

        try {
            // 🚨 [핵심 수정] 여기도 Session Storage를 먼저 보도록 수정했습니다.
            const token = sessionStorage.getItem("accessToken") || sessionStorage.getItem("token") || localStorage.getItem("accessToken") || localStorage.getItem("token");
            console.log("AI 요청 전송 시도 - 토큰:", token);

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
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ 
                type: "TALK", roomId, userId: myInfo.userId, userName: myInfo.userName, message: text 
            }));
        }
    }
  };

  if (!myInfo) return null;

  return (
    <>
      {!isOpen && (
        <div className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`} onClick={toggleChat} onMouseDown={handleMouseDown} style={{ left: `${position.x}px`, top: `${position.y}px` }}>
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
          <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 스터디룸 채팅"}</span>
          <div className="tc-icons">
             {!isAiMode && <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>}
             <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>{isAiMode ? "채팅방" : "AI"}</button>
             <span className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleChat(); }}>×</span>
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
            return (
              <div key={idx} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                {!isMe && <div className="tc-profile">{isAiMode && msg.isAiResponse ? "🤖" : "👤"}</div>}
                <div style={{display:'flex', flexDirection:'column', alignItems: isMe?'flex-end':'flex-start'}}>
                  {!isMe && <div className="tc-name">{msg.userName}</div>}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''}`}>{msg.isSticker ? <div className="sticker-text">{msg.message}</div> : msg.message}</div>
                      <span style={{ fontSize: '10px', color: '#888', minWidth: '50px', textAlign: isMe ? 'right' : 'left', marginBottom: '5px' }}>{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {showStickerMenu && !isAiMode && (
            <div className="sticker-menu-container">{STICKER_LIST.map((s, i) => <button key={i} className="sticker-grid-btn" onClick={() => handleSend(s)}>{s}</button>)}</div>
        )}

        {/* 입력창 */}
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