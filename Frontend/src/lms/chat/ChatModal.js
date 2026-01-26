import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';

// 🔹 상수 설정
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];

/**
 * ChatModal 컴포넌트
 * - 기능: 실시간 채팅(WebSocket), AI 튜터, DB 대화 내용 불러오기
 * - 특징: 드래그 가능, 화면 이탈 방지, roomId 기반 방 분리
 * - 상태: 현재는 테스트용 임시 ID 사용 중 (로그인 기능 병합 후 주석 해제 필요)
 */
const ChatModal = ({ roomId }) => {
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

  // 메시지 목록
  const [chatMessages, setChatMessages] = useState([]); // DB + 실시간 메시지
  const [aiMessages, setAiMessages] = useState([{
    userId: 'AI_BOT',
    userName: 'AI 튜터',
    message: '안녕하세요! 무엇을 도와드릴까요? 궁금한 IT 지식을 물어보세요!',
    isAiResponse: true
  }]);

  // 📍 위치 및 드래그 상태 (초기값: 우측 하단)
  const [position, setPosition] = useState({ 
    x: window.innerWidth - 100, 
    y: window.innerHeight - 100 
  });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Refs
  const ws = useRef(null);        // 웹소켓 객체
  const scrollRef = useRef(null); // 스크롤 자동 이동용

  // =================================================================
  // 2. 사용자 정보 설정 (Real User 매핑)
  // =================================================================
  const myInfo = useMemo(() => {
    // 🚧 [TODO] 로그인 기능 병합 후 아래 주석을 풀어주세요!
    // const storedUser = JSON.parse(localStorage.getItem("user"));
    // if (storedUser) {
    //    return { 
    //        userId: storedUser.userId || storedUser.user_id, 
    //        userName: storedUser.nickname || storedUser.name 
    //    };
    // }

    // 👇 (현재 상태) 로그인 전이므로 임시 랜덤 ID 사용
    const randomId = Math.floor(Math.random() * 1000);
    return { userId: `user_${randomId}`, userName: `익명_${randomId}` };
  }, []);

  const currentMessages = isAiMode ? aiMessages : chatMessages;

  // =================================================================
  // 3. [DB 연동] 지난 대화 내용 불러오기
  // =================================================================
  useEffect(() => {
    // 방이 열려있고 roomId가 있을 때만 실행
    if (!isOpen || !roomId) return;

    const fetchChatHistory = async () => {
        try {
            // 🚧 [TODO] 백엔드 API가 준비되면 주석 해제
            // const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
            // const data = await res.json();
            
            // 👇 (임시) API 연결 전까지는 빈 배열로 둠
            const data = []; 

            // DB 컬럼(snake_case)을 프론트 변수(camelCase)로 변환
            const dbMessages = data.map(msg => ({
                userId: msg.user_id,          
                userName: msg.nickname,       
                message: msg.messagetext,     
                isSticker: STICKER_LIST.includes(msg.messagetext),
                created_at: msg.created_at    
            }));
            setChatMessages(dbMessages);
        } catch (err) {
            console.error("채팅 기록 불러오기 실패:", err);
        }
    };
    fetchChatHistory();
  }, [isOpen, roomId]);


  // =================================================================
  // 4. [WebSocket] 실시간 통신 연결
  // =================================================================
  useEffect(() => {
    if (!roomId) return;

    console.log(`📡 [Room ${roomId}] 연결 시도...`);

    // ✅ ws:// 사용 (로컬 개발 환경) + 우리 전용 주소 (/ws/chat)
    const socket = new WebSocket(
        `ws://localhost:8080/ws/chat/${roomId}?userId=${myInfo.userId}&userName=${myInfo.userName}`
    );

    socket.onopen = () => console.log(`✅ [Room ${roomId}] 웹소켓 연결 성공!`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // 💬 일반 대화 (TALK 타입)
        if (data.type === "TALK") {
            setChatMessages(prev => [...prev, { 
                userId: data.userId, 
                userName: data.userName, // 보낸 사람 이름 표시
                message: data.message, 
                isSticker: STICKER_LIST.includes(data.message) 
            }]);
            
            // 창이 닫혀있으면 배지 카운트 증가
            if (!isOpen && !isAiMode) setUnreadCount(prev => prev + 1);
        
        // 👥 접속자 목록 업데이트
        } else if (data.type === "USERS_UPDATE") {
            setUserList(data.users);
        }
    };

    socket.onclose = () => console.log("❌ 웹소켓 연결 종료");

    ws.current = socket;
    return () => socket.close();
  }, [isOpen, isAiMode, myInfo.userId, myInfo.userName, roomId]);

  // 자동 스크롤 (새 메시지 수신 시)
  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isOpen]);


  // =================================================================
  // 5. 드래그 앤 드롭 로직 (UI)
  // =================================================================
  const handleMouseDown = (e) => {
    isDragging.current = false;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    isDragging.current = true;
    let newX = e.clientX - dragStart.current.x;
    let newY = e.clientY - dragStart.current.y;
    // 화면 밖 이탈 방지
    const maxX = window.innerWidth - 70; 
    const maxY = window.innerHeight - 70;
    setPosition({ x: Math.min(Math.max(0, newX), maxX), y: Math.min(Math.max(0, newY), maxY) });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };


  // =================================================================
  // 6. 이벤트 핸들러
  // =================================================================
  const toggleChat = () => {
    if (isDragging.current) return;
    if (!isOpen) setUnreadCount(0);
    setIsOpen(!isOpen);
    if (isOpen) { setIsMenuOpen(false); setShowStickerMenu(false); }
  };

  const toggleAiMode = () => {
    setIsAiMode(!isAiMode);
    setIsMenuOpen(false);
    setShowStickerMenu(false);
  };

  // ✅ 메시지 전송 핸들러
  const handleSend = (text = inputValue) => {
    if (!text.trim()) return;

    if (isAiMode) {
        // [AI 모드]
        setAiMessages(prev => [...prev, { userId: myInfo.userId, message: text, isAiResponse: false }]);
        setTimeout(() => {
            setAiMessages(prev => [...prev, { userId: 'AI_BOT', userName: 'AI 튜터', message: `"${text}" 답변...`, isAiResponse: true }]);
        }, 1000);
    } else {
        // [일반 채팅] - 안전 장치 추가
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
             console.error("❌ 웹소켓이 연결되지 않았습니다.");
             return;
        }

        // 🛠️ 백엔드 DTO(ChatMessageDTO) 규격에 맞춰 전송
        const messageData = {
            type: "TALK",           // 백엔드 Enum 타입
            roomId: roomId,         
            userId: myInfo.userId,  
            userName: myInfo.userName, 
            message: text           
        };

        ws.current.send(JSON.stringify(messageData));
    }
    setInputValue("");
    setShowStickerMenu(false);
  };

  const sendSticker = (sticker) => handleSend(sticker);
  
  const editNickname = (targetId) => {
    const newName = prompt("별명 설정");
    if (newName) setCustomNicknames(prev => ({ ...prev, [targetId]: newName }));
  };
  
  const getDisplayName = (user) => customNicknames[user.userId] || user.userName || user.userId;
  const handleBodyClick = () => { setIsMenuOpen(false); setShowStickerMenu(false); };

  // 모달 위치 계산 (화면 잘림 방지)
  const modalTop = Math.max(10, position.y - 480);
  const modalLeft = Math.min(Math.max(10, position.x - 290), window.innerWidth - 370);

  // =================================================================
  // 7. 렌더링
  // =================================================================
  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <div 
            className={`chat-floating-btn ${isAiMode ? 'ai-mode' : ''}`} 
            onClick={toggleChat}
            onMouseDown={handleMouseDown}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <img 
                src="/chat-ai-icon.png" 
                alt="채팅 및 AI" 
                style={{ width: '65px', height: '65px', pointerEvents: 'none' }} 
            />
            {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </div>
      )}

      {/* 모달 창 */}
      <div 
        className={`tc-wrapper ${isAiMode ? 'ai-mode' : ''}`} 
        style={{ display: isOpen ? 'flex' : 'none', left: `${modalLeft}px`, top: `${modalTop}px` }}
      >
        {/* 헤더 */}
        <div 
            className={`tc-header ${isAiMode ? 'ai-mode' : ''}`}
            onMouseDown={handleMouseDown}
            style={{ cursor: 'move' }}
        >
          <div className="tc-title-row">
              <span className="tc-title">{isAiMode ? "🤖 AI 튜터" : "💬 스터디룸 채팅"}</span>
          </div>
          <div className="tc-icons">
             {!isAiMode && (
                <span className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}>☰</span>
             )}
             <button className="ai-toggle-btn" onClick={(e) => { e.stopPropagation(); toggleAiMode(); }}>
                 {isAiMode ? "채팅방으로" : "AI와 대화하기"}
             </button>
             <span className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleChat(); }}>×</span>
          </div>
        </div>

        {/* 사이드바 */}
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
        
        {/* 채팅 내용 */}
        <div className={`tc-body ${isAiMode ? 'ai-mode' : ''}`} ref={scrollRef} onClick={handleBodyClick}>
          {currentMessages.map((msg, index) => {
            const isMe = isAiMode ? !msg.isAiResponse : msg.userId === myInfo.userId;
            const displayName = isAiMode ? (msg.isAiResponse ? msg.userName : "나") : (msg.userName || customNicknames[msg.userId] || msg.userId);
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

        {/* 스티커 메뉴 */}
        {showStickerMenu && !isAiMode && (
            <div className="sticker-menu-container">
                {STICKER_LIST.map((sticker, idx) => (
                    <button key={idx} className="sticker-grid-btn" onClick={() => sendSticker(sticker)}>{sticker}</button>
                ))}
            </div>
        )}

        {/* 입력창 */}
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