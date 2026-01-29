import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';
// 유틸리티 함수 임포트
import { getHostnameWithPort, getWsProtocol } from "../../utils/backendUrl";

// =================================================================
// 🔹 상수 및 환경 설정
// =================================================================
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];
const MODAL_WIDTH = 360; 
const MODAL_HEIGHT = 600;
const BUTTON_SIZE = 70; // 버튼 크기 (좌표 계산 오차 방지용)

const ChatModal = ({ roomId, roomName }) => {
  // =================================================================
  // 1. 상태 관리 (State)
  // =================================================================
  const [isOpen, setIsOpen] = useState(false);         // 채팅창 열림 여부
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 사이드바(접속자) 열림 여부
  const [showStickerMenu, setShowStickerMenu] = useState(false); 
  const [unreadCount, setUnreadCount] = useState(0);   

  const [isAiMode, setIsAiMode] = useState(false);     // AI 모드 여부
  const [inputValue, setInputValue] = useState("");    
  const [userList, setUserList] = useState([]);        

  // 메시지 목록 (일반 / AI 분리)
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
  
  // =================================================================
  // 2. Refs (드래그, 리사이즈, 소켓 등 변수 관리)
  // =================================================================
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const accumulatedMove = useRef(0);  // [Fix] 클릭 vs 드래그 구분용 이동 거리 누적
  const lastButtonPos = useRef(null); // [Fix] 버튼 위치 기억 (닫았다 열 때 제자리 복귀용)
  
  // 🚨 [중요] 창 크기 기억 (초기값: CSS와 동일)
  const lastWindowSize = useRef({ w: MODAL_WIDTH, h: MODAL_HEIGHT });

  // 리사이즈 상태 관리
  const resizeRef = useRef({ 
    active: false, 
    dir: '',        // 방향 (n, s, e, w, ne...)
    startX: 0, startY: 0, 
    startW: 0, startH: 0, 
    startLeft: 0, startTop: 0 
  });

  const ws = useRef(null);        
  const scrollRef = useRef(null); 
  const modalRef = useRef(null); // 실제 DOM 접근용

  // =================================================================
  // 3. 동적 URL 및 사용자 정보
  // =================================================================
  const { apiBaseUrl, wsUrl } = useMemo(() => {
      const host = getHostnameWithPort();
      const wsProtocol = getWsProtocol(); 
      const httpProtocol = wsProtocol === 'wss' ? 'https' : 'http';

      return {
          apiBaseUrl: `${httpProtocol}://${host}`,
          wsUrl: `${wsProtocol}://${host}`
      };
  }, []);

  const myInfo = useMemo(() => {
    try {
        const storedUserId = localStorage.getItem("userId") || localStorage.getItem("user_id");
        const storedUserName = localStorage.getItem("userName") || localStorage.getItem("nickname") || localStorage.getItem("name");

        if (storedUserId) {
            return { userId: storedUserId, userName: storedUserName || "익명" };
        }
    } catch (e) { console.error("사용자 정보 파싱 실패:", e); }
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
  // 4. API & WebSocket 연동 (기존 로직 유지)
  // =================================================================
  useEffect(() => {
    if (!isOpen || !roomId || !myInfo) return;

    // 4-1. 이전 채팅 기록 불러오기
    const fetchChatHistory = async () => {
        try {
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
  }, [isOpen, roomId, myInfo, apiBaseUrl]);

  // 4-2. 웹소켓 연결
  useEffect(() => {
    if (!roomId || !myInfo) return;

    const socket = new WebSocket(
        `${wsUrl}/ws/chat/${roomId}?userId=${encodeURIComponent(myInfo.userId)}&userName=${encodeURIComponent(myInfo.userName)}`
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
  }, [isOpen, isAiMode, myInfo, roomId, wsUrl]);

  // 스크롤 자동 이동
  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isOpen]);

  // =================================================================
  // 5. 이벤트 핸들러 (드래그 & 리사이즈 & 토글)
  // =================================================================
  
  // 마우스 누름 (드래그 시작)
  const handleMouseDown = (e) => {
    isDragging.current = false;
    accumulatedMove.current = 0; // 누적 이동 거리 초기화
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 리사이즈 핸들 누름
  const handleResizeMouseDown = (e, direction) => {
    e.preventDefault(); 
    e.stopPropagation();

    resizeRef.current = {
        active: true,
        dir: direction,
        startX: e.clientX,
        startY: e.clientY,
        startW: modalRef.current.offsetWidth,
        startH: modalRef.current.offsetHeight,
        startLeft: position.x,
        startTop: position.y
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 🖱️ 마우스 이동 (드래그 & 리사이즈 통합 처리)
  const handleMouseMove = (e) => {
    // 1️⃣ [리사이즈 동작]
    if (resizeRef.current && resizeRef.current.active) {
        const { dir, startX, startY, startW, startH, startLeft, startTop } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startLeft;
        let newY = startTop;

        // 방향별 크기 및 위치 계산
        if (dir.includes('e')) newW = startW + dx;
        if (dir.includes('s')) newH = startH + dy;
        if (dir.includes('w')) { newW = startW - dx; newX = startLeft + dx; }
        if (dir.includes('n')) { newH = startH - dy; newY = startTop + dy; }

        // [최소 크기 제한]
        if (newW < 360) { newW = 360; if (dir.includes('w')) newX = startLeft + (startW - 360); }
        if (newH < 600) { newH = 600; if (dir.includes('n')) newY = startTop + (startH - 600); }

        // [화면 침범 방지] 리사이즈 중에도 화면 밖으로 나가지 않게 막음
        if (newX < 0) { newW += newX; newX = 0; }
        if (newY < 0) { newH += newY; newY = 0; }
        if (newX + newW > window.innerWidth) newW = window.innerWidth - newX;
        if (newY + newH > window.innerHeight) newH = window.innerHeight - newY;

        if (modalRef.current) {
            modalRef.current.style.width = `${newW}px`;
            modalRef.current.style.height = `${newH}px`;
        }
        
        // 변경된 크기 기억 (열 때 사용)
        lastWindowSize.current = { w: newW, h: newH };

        setPosition({ x: newX, y: newY });
        lastButtonPos.current = null; // 리사이즈했으면 원래 버튼 위치는 무효화
        return; 
    }

    // 2️⃣ [드래그 동작]
    accumulatedMove.current += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (accumulatedMove.current > 5) { // 5px 이상 움직여야 드래그로 인정
        isDragging.current = true;
    }

    let currentWidth = BUTTON_SIZE;  
    let currentHeight = BUTTON_SIZE;

    if (isOpen && modalRef.current) {
        currentWidth = modalRef.current.offsetWidth;
        currentHeight = modalRef.current.offsetHeight;
    }

    // 화면 끝(0px) 기준 경계 체크
    const maxX = window.innerWidth - currentWidth; 
    const maxY = window.innerHeight - currentHeight;
    
    let nextX = e.clientX - dragStart.current.x;
    let nextY = e.clientY - dragStart.current.y;

    nextX = Math.min(Math.max(0, nextX), maxX); 
    nextY = Math.min(Math.max(0, nextY), maxY); 

    if (isOpen && isDragging.current) {
        lastButtonPos.current = null; // 드래그했으면 원래 버튼 위치 무효화
    }

    setPosition({ x: nextX, y: nextY });
  };

  const handleMouseUp = () => {
    // 드래그 종료 시 약간의 딜레이를 주어 toggleChat의 클릭 로직과 충돌 방지
    setTimeout(() => { isDragging.current = false; }, 50); 
    if (resizeRef.current) resizeRef.current.active = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 🚀 [채팅창 열기/닫기 로직]
  const toggleChat = () => { 
      // 드래그 중이었다면 클릭 무시
      if (isDragging.current || accumulatedMove.current > 5) return; 

      // 1️⃣ [닫기] 창 -> 버튼
      if (isOpen) {
          // 닫기 전 현재 크기 저장
          if (modalRef.current) {
              lastWindowSize.current = {
                  w: modalRef.current.offsetWidth,
                  h: modalRef.current.offsetHeight
              };
          }

          if (lastButtonPos.current) {
              // 드래그 안 했으면 원래 버튼 자리로 복귀
              setPosition(lastButtonPos.current);
              lastButtonPos.current = null;
          } else if (modalRef.current) {
              // 드래그 했으면 현재 창의 '우측 하단'에 버튼 배치
              const currentW = modalRef.current.offsetWidth;
              const currentH = modalRef.current.offsetHeight;
              
              let newX = position.x + (currentW - BUTTON_SIZE);
              let newY = position.y + (currentH - BUTTON_SIZE);

              // 화면 밖으로 튀지 않게 안전장치
              const maxX = window.innerWidth - BUTTON_SIZE;
              const maxY = window.innerHeight - BUTTON_SIZE;
              newX = Math.min(Math.max(0, newX), maxX);
              newY = Math.min(Math.max(0, newY), maxY);

              setPosition({ x: newX, y: newY });
          }
      }
      // 2️⃣ [열기] 버튼 -> 창
      else {
          // 버튼 위치 기억해둠
          lastButtonPos.current = { x: position.x, y: position.y };

          // 기억해둔 '마지막 창 크기'를 기준으로 좌표 역계산 (우측 하단 기준)
          const targetW = lastWindowSize.current.w;
          const targetH = lastWindowSize.current.h;

          let newX = position.x - (targetW - BUTTON_SIZE);
          let newY = position.y - (targetH - BUTTON_SIZE);

          // 화면 밖 침범 방지
          newX = Math.max(0, newX);
          newY = Math.max(0, newY);
          
          if (newX + targetW > window.innerWidth) newX = window.innerWidth - targetW;
          if (newY + targetH > window.innerHeight) newY = window.innerHeight - targetH;

          setPosition({ x: newX, y: newY });
      }

      setIsOpen(!isOpen); 
      if (!isOpen) setUnreadCount(0); 
  };

  const toggleAiMode = () => setIsAiMode(!isAiMode);

  // 메시지 전송 로직 (AI / 소켓 분기)
  const handleSend = async (text = inputValue) => {
    if (!text.trim()) return;
    if (!myInfo) return;

    setInputValue("");
    setShowStickerMenu(false);

    if (isAiMode) {
        // [AI 모드] OpenAI API 호출
        setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, createdAt: new Date().toISOString(), isAiResponse: false }]);
        setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: "...", createdAt: new Date().toISOString(), isAiResponse: true, isLoading: true }]);

        try {
            const res = await fetch(`${apiBaseUrl}/api/ai/chat`, {
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
        // [일반 모드] WebSocket 전송
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

  if (!myInfo) return null;

  return (
    <>
      {/* 🟢 플로팅 버튼 (닫혀있을 때만 표시) */}
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

      {/* 🟢 메인 채팅창 모달 */}
      <div ref={modalRef} className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`} 
           style={{ 
               display: isOpen ? 'flex' : 'none', 
               left: `${position.x}px`, 
               top: `${position.y}px`,
               // [중요] 기억된 크기를 적용하여 열릴 때 크기 유지
               width: `${lastWindowSize.current.w}px`,
               height: `${lastWindowSize.current.h}px`
           }}>
           
        {/* 🔹 8방향 리사이즈 핸들 */}
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

        {/* 🔹 헤더 (드래그 핸들) */}
        <div className={`tc-header ${isAiMode ? 'ai-mode' : ''}`} onMouseDown={handleMouseDown} style={{ cursor: 'move' }}>
          <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 스터디룸 채팅"}</span>
          <div className="tc-icons">
             {!isAiMode && <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>}
             <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>{isAiMode ? "채팅방" : "AI"}</button>
             <span className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleChat(); }}>×</span>
          </div>
        </div>

        {/* 🔹 사이드바 (접속자 목록) */}
        {isMenuOpen && !isAiMode && (
            <div className="tc-sidebar">
                <div className="tc-sidebar-title">접속자 ({userList.length})</div>
                {userList.map(u => <div key={u.userId} className="tc-user-item"><span className="status-dot">●</span>{u.userName}</div>)}
            </div>
        )}

        {/* 🔹 채팅 바디 (메시지 목록) */}
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
        
        {/* 🔹 스티커 메뉴 */}
        {showStickerMenu && !isAiMode && (
            <div className="sticker-menu-container">{STICKER_LIST.map((s, i) => <button key={i} className="sticker-grid-btn" onClick={() => handleSend(s)}>{s}</button>)}</div>
        )}

        {/* 🔹 입력창 영역 */}
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