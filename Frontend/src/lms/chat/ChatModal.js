import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';

// 🔹 상수 및 설정
const ROOM_ID = 1;
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];

/**
 * ChatModal 컴포넌트
 * - 기능: 실시간 채팅(WebSocket), AI 튜터 대화, 스티커 전송
 * - 특징: 드래그 가능한 플로팅 버튼 및 모달 창 (화면 밖 이탈 방지 적용)
 */
const ChatModal = () => {
  // =================================================================
  // 1. 상태 관리 (State)
  // =================================================================
  
  // UI 상태
  const [isOpen, setIsOpen] = useState(false);         // 채팅창 열림 여부
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 사이드바(접속자) 열림 여부
  const [showStickerMenu, setShowStickerMenu] = useState(false); // 스티커 메뉴 열림 여부
  const [unreadCount, setUnreadCount] = useState(0);   // 안 읽은 메시지 배지

  // 모드 및 데이터 상태
  const [isAiMode, setIsAiMode] = useState(false);     // 🤖 AI 모드 활성화 여부
  const [inputValue, setInputValue] = useState("");    // 입력창 텍스트
  const [userList, setUserList] = useState([]);        // 접속자 목록
  const [customNicknames, setCustomNicknames] = useState({}); // 사용자 별명

  // 메시지 목록 (일반 / AI 분리)
  const [chatMessages, setChatMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([{
    userId: 'AI_BOT',
    userName: 'AI 튜터',
    message: '안녕하세요! 무엇을 도와드릴까요? 궁금한 IT 지식을 물어보세요!',
    isAiResponse: true
  }]);

  // 📍 위치 및 드래그 관련 상태
  // 초기값: 화면 오른쪽 아래 (여유 공간 100px)
  const [position, setPosition] = useState({ 
    x: window.innerWidth - 100, 
    y: window.innerHeight - 100 
  });
  
  // 📍 드래그 판별용 Refs (렌더링 없이 값만 저장)
  const isDragging = useRef(false);   // 현재 드래그 중인가?
  const dragStart = useRef({ x: 0, y: 0 }); // 드래그 시작 시 마우스 오프셋

  // 기타 Refs
  const ws = useRef(null);        // 웹소켓 객체
  const scrollRef = useRef(null); // 스크롤 자동 이동용

  // =================================================================
  // 2. 초기화 및 유틸
  // =================================================================

  // 현재 모드에 따른 메시지 소스 선택
  const currentMessages = isAiMode ? aiMessages : chatMessages;

  // 내 정보 생성 (임시 랜덤 ID)
  const myInfo = useMemo(() => {
    const randomId = Math.floor(Math.random() * 1000);
    return { userId: `user_${randomId}`, userName: `익명_${randomId}` };
  }, []);

  // =================================================================
  // 3. 웹소켓 연결 (useEffect)
  // =================================================================
  useEffect(() => {
    const socket = new WebSocket(
        `wss://localhost:8080/ws/room/${ROOM_ID}?userId=${myInfo.userId}&userName=${myInfo.userName}`
    );

    socket.onopen = () => console.log("✅ 웹소켓 연결됨");

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // 💬 채팅 메시지 수신
        if (data.type === "CHAT") {
            setChatMessages(prev => [...prev, { 
                userId: data.userId, 
                message: data.message, 
                isSticker: STICKER_LIST.includes(data.message) 
            }]);
            
            // 창이 닫혀있고 AI 모드가 아니면 배지 증가
            if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);
        
        // 👥 접속자 목록 갱신
        } else if (data.type === "USERS_UPDATE") {
            setUserList(data.users);
        }
    };

    ws.current = socket;
    return () => socket.close(); // 언마운트 시 연결 종료
  }, [isOpen, isAiMode, myInfo.userId, myInfo.userName]);

  // 자동 스크롤 (새 메시지 오면 맨 아래로)
  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isOpen]);

  // =================================================================
  // 4. 🖱️ 드래그 앤 드롭 로직 (핵심 기능)
  // =================================================================
  
  // 드래그 시작
  const handleMouseDown = (e) => {
    isDragging.current = false; // 일단은 클릭으로 간주
    // 마우스 좌표와 현재 버튼 위치의 차이(offset)를 저장
    dragStart.current = { 
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
    };
    
    // 전역 이벤트 등록 (빠르게 움직여도 놓치지 않게 document에 등록)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 드래그 중 (위치 업데이트)
  const handleMouseMove = (e) => {
    isDragging.current = true; // 움직였으니 드래그 상태로 변경
    
    // 1. 새로운 예상 좌표 계산
    let newX = e.clientX - dragStart.current.x;
    let newY = e.clientY - dragStart.current.y;

    // 2. ⛔ 화면 밖 이탈 방지 (Boundary Check)
    // 버튼 크기(약 70px)를 고려하여 화면 최대 좌표 설정
    const maxX = window.innerWidth - 70; 
    const maxY = window.innerHeight - 70;

    // 0보다 작으면 0으로, max보다 크면 max로 고정
    newX = Math.min(Math.max(0, newX), maxX);
    newY = Math.min(Math.max(0, newY), maxY);

    setPosition({ x: newX, y: newY });
  };

  // 드래그 종료
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // =================================================================
  // 5. 이벤트 핸들러 (UI 조작)
  // =================================================================

  // 채팅창 열기/닫기 (드래그 중이면 실행 안 함)
  const toggleChat = () => {
    if (isDragging.current) return; // 드래그였다면 클릭 무시
    
    if (!isOpen) setUnreadCount(0);
    setIsOpen(!isOpen);
    
    // 닫을 때 메뉴들도 같이 닫기
    if (isOpen) { 
        setIsMenuOpen(false); 
        setShowStickerMenu(false); 
    }
  };

  // AI 모드 전환
  const toggleAiMode = () => {
    setIsAiMode(!isAiMode);
    setIsMenuOpen(false);
    setShowStickerMenu(false);
  };

  // 메시지 전송
  const handleSend = (text = inputValue) => {
    if (!text.trim()) return;

    if (isAiMode) {
        // [AI 모드]
        setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, isAiResponse: false }]);
        // (임시) AI 응답 시뮬레이션
        setTimeout(() => {
            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: `"${text}" 답변...`, isAiResponse: true }]);
        }, 1000);
    } else {
        // [일반 채팅]
        if (!ws.current) return;
        ws.current.send(JSON.stringify({ type: "CHAT", message: text }));
    }
    setInputValue("");
    setShowStickerMenu(false);
  };

  // 기타 핸들러
  const sendSticker = (sticker) => handleSend(sticker);
  
  const editNickname = (targetId) => {
    const newName = prompt("별명 설정");
    if (newName) setCustomNicknames(prev => ({ ...prev, [targetId]: newName }));
  };
  
  const getDisplayName = (user) => customNicknames[user.userId] || user.userName || user.userId;
  
  const handleBodyClick = () => { 
      setIsMenuOpen(false); 
      setShowStickerMenu(false); 
  };

  // =================================================================
  // 6. 모달 위치 계산 (렌더링 직전)
  // =================================================================
  
  // 📍 모달 창이 화면 위로 잘리는 것 방지
  // 기본적으로 버튼 위(position.y - 480)에 뜨게 하되, 최소 10px(천장) 아래에 위치시킴
  const modalTop = Math.max(10, position.y - 480);
  
  // 📍 모달 창이 화면 오른쪽으로 잘리는 것 방지
  // 기본적으로 버튼 왼쪽(position.x - 290)에 뜨게 하되, 화면 너비를 넘지 않게 조정
  const modalLeft = Math.min(Math.max(10, position.x - 290), window.innerWidth - 370);


  // =================================================================
  // 7. 렌더링
  // =================================================================
  return (
    <>
      {/* 🟢 1. 플로팅 버튼 */}
      {!isOpen && (
        <div 
            className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`} 
            onClick={toggleChat}
            onMouseDown={handleMouseDown} // 드래그 시작
            style={{ left: `${position.x}px`, top: `${position.y}px` }} // 동적 위치 적용
        >
            <img 
                src="/chat-ai-icon.png" 
                alt="채팅 및 AI" 
                style={{ width: '65px', height: '65px', pointerEvents: 'none' }} 
            />
            {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </div>
      )}

      {/* 🟢 2. 모달 창 본체 */}
      <div 
        className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`} 
        style={{ 
            display: isOpen ? 'flex' : 'none',
            left: `${modalLeft}px`, // 계산된 안전 좌표 적용
            top: `${modalTop}px`   
        }}
      >
        
        {/* === 헤더 (드래그 손잡이 역할) === */}
        <div 
            className={`tc-header ${isAiMode ? 'ai-mode' : ''}`}
            onMouseDown={handleMouseDown} // 헤더를 잡고 드래그 가능
            style={{ cursor: 'move' }}
        >
          <div className="tc-title-row">
              <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 스터디룸 채팅"}</span>
          </div>
          <div className="tc-icons">
             {/* 🛑 stopPropagation: 버튼 클릭 시 드래그(부모 이벤트)가 발생하지 않게 막음 */}
             {!isAiMode && (
                <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>
             )}
             <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>
                 {isAiMode ? "채팅방으로" : "AI와 대화하기"}
             </button>
             <span className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleChat(); }}>×</span>
          </div>
        </div>

        {/* === 사이드바 === */}
        {isMenuOpen && !isAiMode && (
            <div className="tc-sidebar">
                <div className="tc-sidebar-title">접속자 목록 ({userList.length})</div>
                {userList.map(user => (
                    <div key={user.userId} className="tc-user-item" onClick={() => editNickname(user.userId)}>
                        <span className="status-dot">●</span>
                        {getDisplayName(user)}
                    </div>
                ))}
            </div>
        )}
        
        {/* === 채팅 내용 === */}
        <div className={`tc-body ${isAiMode ? 'ai-mode' : ''}`} ref={scrollRef} onClick={handleBodyClick}>
          {currentMessages.map((msg, index) => {
            const isMe = isAiMode ? !msg.isAiResponse : msg.userId === myInfo.userId;
            const displayName = isAiMode ? (msg.isAiResponse ? msg.userName : "나") : (customNicknames[msg.userId] || msg.userId);
            return (
              <div key={index} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                {!isMe && (
                    <div className={`tc-profile ${isAiMode && msg.isAiResponse ? 'ai-profile' : ''}`}>
                        {isAiMode && msg.isAiResponse ? "🤖" : "👤"}
                    </div>
                )}
                <div style={{display:'flex', flexDirection:'column', alignItems: isMe?'flex-end':'flex-start'}}>
                  {!isMe && <div className="tc-name">{displayName}</div>}
                  <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''} ${isAiMode && msg.isAiResponse ? 'ai-bubble' : ''}`}>
                      {msg.isSticker ? <div className="sticker-text">{msg.message}</div> : msg.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* === 스티커 메뉴 === */}
        {showStickerMenu && !isAiMode && (
            <div className="sticker-menu-container">
                {STICKER_LIST.map((sticker, idx) => (
                    <button key={idx} className="sticker-grid-btn" onClick={() => sendSticker(sticker)}>{sticker}</button>
                ))}
            </div>
        )}

        {/* === 입력창 === */}
        <div className="tc-input-area">
          {!isAiMode && <button className={`tc-sticker-toggle-btn ${showStickerMenu ? 'active' : ''}`} onClick={() => setShowStickerMenu(!showStickerMenu)}>😊</button>}
          
          <input 
              className="tc-input" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="메시지 입력" 
              onFocus={() => setShowStickerMenu(false)} 
          />
          <button className={`tc-send-btn ${isAiMode ? 'ai-mode' : ''}`} onClick={() => handleSend()}>전송</button>
        </div>

      </div>
    </>
  );
};

export default ChatModal;