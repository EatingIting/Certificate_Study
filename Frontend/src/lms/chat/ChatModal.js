import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';
// ✅ 팀장님이 만드신 유틸리티 함수 임포트 (경로 확인 필요)
import { getHostnameWithPort, getWsProtocol } from "../../utils/backendUrl";

// 🔹 상수 및 환경 설정
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360; 
const MODAL_HEIGHT = 600;

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

  // 메시지 목록
  const [chatMessages, setChatMessages] = useState([]); 
  const [aiMessages, setAiMessages] = useState([{       
    userId: 'AI_BOT',
    userName: 'AI 튜터',
    message: `안녕하세요! '${roomName || '이 스터디'}'에 대해 궁금한 점을 물어보세요.`,
    createdAt: new Date().toISOString(),
    isAiResponse: true
  }]);

  // 창 위치 상태 (초기값: 우측 하단)
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const ws = useRef(null);        
  const scrollRef = useRef(null); 

  // =================================================================
  // 2. 동적 URL 생성 (팀장님 코드 스타일 적용)
  // =================================================================
  const { apiBaseUrl, wsUrl } = useMemo(() => {
      const host = getHostnameWithPort();
      const wsProtocol = getWsProtocol(); // ws:// 또는 wss://
      // ws -> http, wss -> https 로 변환
      const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';

      return {
          apiBaseUrl: `${httpProtocol}://${host}`,
          wsUrl: `${wsProtocol}://${host}`
      };
  }, []);

  // =================================================================
  // 3. 사용자 정보 가져오기
  // =================================================================
  const myInfo = useMemo(() => {
    try {
        const storedUserId = localStorage.getItem("userId") || localStorage.getItem("user_id");
        const storedUserName = localStorage.getItem("userName") || localStorage.getItem("nickname") || localStorage.getItem("name");

        if (storedUserId) {
            return { userId: storedUserId, userName: storedUserName || "익명" };
        }
    } catch (e) { console.error("사용자 정보 파싱 실패:", e); }
    
    // 로그인이 안 되어 있으면 null 반환
    return null; 
  }, []);

  const currentMessages = isAiMode ? aiMessages : chatMessages;

  // 시간 포맷 (오전/오후 HH:MM)
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
  // 4. API & WebSocket 연동
  // =================================================================
  useEffect(() => {
    // 로그인이 안 되어 있거나 방 정보가 없으면 실행 안 함
    if (!isOpen || !roomId || !myInfo) return;

    // 4-1. 지난 대화 내용 불러오기 (fetch URL 수정됨)
    const fetchChatHistory = async () => {
        try {
            // ✅ 수정: 동적 apiBaseUrl 사용
            const res = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/messages`);
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
        } catch (err) { console.error("채팅 기록 로드 실패:", err); }
    };
    fetchChatHistory();
  }, [isOpen, roomId, myInfo, apiBaseUrl]); // dependency에 apiBaseUrl 추가

  useEffect(() => {
    if (!roomId || !myInfo) return;

    console.log(`📡 [Room ${roomId}] WebSocket 연결 시도...`);

    // 4-2. 소켓 연결 (팀장님 코드 적용)
    // ✅ 수정: wsUrl 및 쿼리 파라미터 인코딩 적용
    const socket = new WebSocket(
        `${wsUrl}/ws/chat/${roomId}?userId=${encodeURIComponent(myInfo.userId)}&userName=${encodeURIComponent(myInfo.userName)}`
    );

    socket.onopen = () => {
        console.log("✅ WebSocket 연결 성공!");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // (1) 일반 대화 수신
        if (data.type === "TALK") {
            setChatMessages(prev => [...prev, { 
                userId: data.userId, 
                userName: data.userName, 
                message: data.message, 
                isSticker: STICKER_LIST.includes(data.message),
                createdAt: data.createdAt || new Date().toISOString()
            }]);
            
            if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);
        
        // (2) 접속자 목록 갱신
        } else if (data.type === "USERS_UPDATE") {
            console.log("👥 접속자 목록 갱신:", data.users);
            setUserList(data.users);
        }
    };

    ws.current = socket;
    return () => socket.close();
  }, [isOpen, isAiMode, myInfo, roomId, wsUrl]); // dependency에 wsUrl 추가

  // 스크롤 자동 이동
  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isOpen]);

  // =================================================================
  // 5. 이벤트 핸들러 (드래그 & 전송)
  // =================================================================
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

  const toggleChat = () => { 
      if (!isDragging.current) { 
          setIsOpen(!isOpen); 
          if (!isOpen) setUnreadCount(0); 
      } 
  };
  const toggleAiMode = () => setIsAiMode(!isAiMode);

  // 메시지 전송
  const handleSend = async (text = inputValue) => {
    if (!text.trim()) return;
    if (!myInfo) return;

    setInputValue("");
    setShowStickerMenu(false);

    if (isAiMode) {
        // [AI 모드] Gemini API 호출
        setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);
        setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

        try {
            // ✅ 수정: 동적 apiBaseUrl 사용
            const res = await fetch(`${apiBaseUrl}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, subject: roomName || "일반 지식" })
            });
            
            // HTML 응답(로그인 페이지)이 오면 에러 처리
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
                throw new Error("Security Block");
            }

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
        // [일반 모드] 소켓 전송
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ 
                type: "TALK", 
                roomId, 
                userId: myInfo.userId, 
                userName: myInfo.userName, 
                message: text 
            }));
        }
    }
  };

  // =================================================================
  // 6. 렌더링
  // =================================================================
  const modalLeft = Math.min(Math.max(10, position.x - MODAL_WIDTH + 60), window.innerWidth - MODAL_WIDTH - 10);
  const modalTop = Math.min(Math.max(10, position.y - MODAL_HEIGHT + 60), window.innerHeight - MODAL_HEIGHT - 10);

  if (!myInfo) return null;

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

      <div className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`} style={{ display: isOpen ? 'flex' : 'none', left: `${modalLeft}px`, top: `${modalTop}px`}}>
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