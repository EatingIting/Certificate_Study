import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';

// 🔹 상수 및 환경 설정
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360; 
const MODAL_HEIGHT = 600;

const HOST = window.location.hostname;
const API_BASE_URL = `http://${HOST}:8080`; 
const WS_BASE_URL = `ws://${HOST}:8080`;

const ChatModal = ({ roomId, roomName }) => {
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
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const ws = useRef(null);        
  const scrollRef = useRef(null); 

  // =================================================================
  // 2. 사용자 정보 가져오기 (게스트 모드 추가 - 절대 안 막힘!)
  // =================================================================
  const myInfo = useMemo(() => {
    try {
        // 1. 로컬스토리지 시도
        const storedUserId = localStorage.getItem("stableUserId") || localStorage.getItem("userId");
        const storedUserName = localStorage.getItem("stableUserName") || localStorage.getItem("userName") || localStorage.getItem("nickname");

        if (storedUserId) {
            return { userId: storedUserId, userName: storedUserName || "익명" };
        }
    } catch (e) { console.error(e); }
    
    // 🚨 [핵심 해결책] 정보가 없으면 '게스트'로라도 통과시킴 (더 이상 빨간창 안 뜸)
    console.warn("로그인 정보 없음 -> 게스트 모드로 진입");
    const randomId = "GUEST-" + Math.random().toString(36).substr(2, 9);
    return { userId: randomId, userName: "게스트" }; 
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

  // 3. API & WebSocket
  useEffect(() => {
    if (!isOpen || !roomId || !myInfo) return;

    const fetchChatHistory = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/rooms/${roomId}/messages`);
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
            }
        } catch (err) { console.error(err); }
    };
    fetchChatHistory();
  }, [isOpen, roomId, myInfo]);

  useEffect(() => {
    if (!roomId || !myInfo) return;

    const socket = new WebSocket(
        `${WS_BASE_URL}/ws/chat/${roomId}?userId=${myInfo.userId}&userName=${myInfo.userName}`
    );

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "TALK") {
            setChatMessages(prev => [...prev, { 
                userId: data.userId, 
                userName: data.userName, 
                message: data.message, 
                isSticker: STICKER_LIST.includes(data.message),
                createdAt: data.createdAt || new Date().toISOString()
            }]);
            if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);
        } else if (data.type === "USERS_UPDATE") {
            setUserList(data.users);
        }
    };

    ws.current = socket;
    return () => socket.close();
  }, [isOpen, isAiMode, myInfo, roomId]);

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages, isOpen]);

  // 4. 이벤트 핸들러
  const handleMouseDown = (e) => {
    isDragging.current = false;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    isDragging.current = true;
    const maxX = window.innerWidth - 70; 
    const maxY = window.innerHeight - 70;
    
    let nextX = e.clientX - dragStart.current.x;
    let nextY = e.clientY - dragStart.current.y;

    nextX = Math.min(Math.max(0, nextX), maxX);
    nextY = Math.min(Math.max(0, nextY), maxY);

    setPosition({ x: nextX, y: nextY });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const toggleChat = () => { if (!isDragging.current) { setIsOpen(!isOpen); if (!isOpen) setUnreadCount(0); } };
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
            const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, subject: roomName || "일반 지식" })
            });

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) throw new Error("Security Block");

            if (!res.ok) throw new Error("AI Error");
            const aiReply = await res.text();
            
            setAiMessages(prev => {
                const clean = prev.filter(msg => !msg.isLoading);
                return [...clean, { userId: 'AI_BOT', userName: 'AI 튜터', message: aiReply, createdAt: new Date().toISOString(), isAiResponse: true }];
            });
        } catch (err) {
            setAiMessages(prev => prev.map(msg => msg.isLoading ? { ...msg, message: "AI 서버 연결 실패 😭", isLoading: false } : msg));
        }
    } else {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "TALK", roomId, userId: myInfo.userId, userName: myInfo.userName, message: text }));
        }
    }
  };

  // 5. 렌더링 (위치 계산)
  const modalLeft = Math.min(Math.max(10, position.x - MODAL_WIDTH + 60), window.innerWidth - MODAL_WIDTH - 10);
  const modalTop = Math.min(Math.max(10, position.y - MODAL_HEIGHT + 60), window.innerHeight - MODAL_HEIGHT - 10);

  // 더 이상 에러창을 띄우지 않고, 그냥 버튼을 보여줍니다.
  return (
    <>
      {!isOpen && (
        <div 
            className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`} 
            onClick={toggleChat} 
            onMouseDown={handleMouseDown} 
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <img src="/chat-ai-icon.png" alt="채팅" style={{ width: '65px', height: '65px', pointerEvents: 'none' }} />
            {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </div>
      )}

      <div className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`} style={{ display: isOpen ? 'flex' : 'none', left: `${modalLeft}px`, top: `${modalTop}px`, width: `${MODAL_WIDTH}px`, height: `${MODAL_HEIGHT}px` }}>
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