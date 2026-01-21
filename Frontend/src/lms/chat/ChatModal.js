import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ChatModal.css';

const ROOM_ID = 1;

// ✅ 사용할 스티커 목록 (원하는 거 더 추가하셔도 됩니다)
const STICKER_LIST = ["👌", "👍", "🎉", "😭", "🔥", "🤔"];

const ChatModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [userList, setUserList] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [customNicknames, setCustomNicknames] = useState({});

  // ✅ 스티커 메뉴 열림/닫힘 상태
  const [showStickerMenu, setShowStickerMenu] = useState(false);

  const ws = useRef(null);
  const scrollRef = useRef(null);

  const myInfo = useMemo(() => {
    const randomId = Math.floor(Math.random() * 1000);
    return { userId: `user_${randomId}`, userName: `익명_${randomId}` };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(
        `wss://localhost:8080/ws/room/${ROOM_ID}?userId=${myInfo.userId}&userName=${myInfo.userName}`
    );

    socket.onopen = () => console.log("✅ 웹소켓 연결됨");

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "CHAT") {
            setMessages(prev => [...prev, { 
                userId: data.userId, 
                message: data.message,
                // ✅ 메시지 내용이 스티커 목록에 있으면 스티커로 취급
                isSticker: STICKER_LIST.includes(data.message) 
            }]);
            if (!isOpen) setUnreadCount(prev => prev + 1);
        } else if (data.type === "USERS_UPDATE") {
            setUserList(data.users);
        }
    };
    socket.onclose = () => console.log("❌ 연결 끊김");
    ws.current = socket;
    return () => socket.close();
  }, [isOpen, myInfo.userId, myInfo.userName]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const toggleChat = () => {
    if (!isOpen) setUnreadCount(0);
    setIsOpen(!isOpen);
    // 창 닫을 때 메뉴들도 같이 닫기
    if (isOpen) { setIsMenuOpen(false); setShowStickerMenu(false); }
  };

  const handleSend = (text = inputValue) => {
    if (!text.trim() || !ws.current) return;
    const chatData = { type: "CHAT", message: text };
    ws.current.send(JSON.stringify(chatData));
    setInputValue("");
    setShowStickerMenu(false); // 전송 후 스티커 메뉴 닫기
  };

  // ✅ 스티커 전송 함수
  const sendSticker = (stickerText) => {
    handleSend(stickerText);
  };

  const editNickname = (targetId) => {
    const newName = prompt("이 사용자의 별명을 무엇으로 설정할까요?");
    if (newName) setCustomNicknames(prev => ({ ...prev, [targetId]: newName }));
  };

  const getDisplayName = (user) => customNicknames[user.userId] || user.userName || user.userId;

  // 빈 공간 클릭 시 메뉴 닫기
  const handleBodyClick = () => {
      setIsMenuOpen(false);
      setShowStickerMenu(false);
  };

  return (
    <>
      {!isOpen && (
        <div className="chat-floating-btn" onClick={toggleChat}>
            💬 {unreadCount > 0 && <span className="chat-badge">{unreadCount}</span>}
        </div>
      )}

      <div className="tc-wrapper" style={{ display: isOpen ? 'flex' : 'none' }}>
        <div className="tc-header">
          <div className="tc-title-row"><span className="tc-title">스터디룸 채팅</span></div>
          <div className="tc-icons">
             <span className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</span>
             <span className="icon-btn" onClick={toggleChat}>×</span>
          </div>
        </div>

        {isMenuOpen && (
            <div className="tc-sidebar">
                <div className="tc-sidebar-title">접속자 목록 ({userList.length})</div>
                {userList.map(user => (
                    <div key={user.userId} className="tc-user-item" onClick={() => editNickname(user.userId)}>
                        <span className="status-dot">●</span>
                        {getDisplayName(user)} {user.userId === myInfo.userId && "(나)"}
                        <span className="edit-hint">✎</span>
                    </div>
                ))}
            </div>
        )}
        
        <div className="tc-body" ref={scrollRef} onClick={handleBodyClick}>
          {messages.map((msg, index) => {
            const isMe = msg.userId === myInfo.userId;
            const displayName = customNicknames[msg.userId] || msg.userId;
            return (
              <div key={index} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
                {!isMe && <div className="tc-profile">👤</div>}
                <div style={{display:'flex', flexDirection:'column', alignItems: isMe?'flex-end':'flex-start'}}>
                  {!isMe && <div className="tc-name">{displayName}</div>}
                  
                  {/* ✅ 스티커인 경우 말풍선 스타일(sticker-bubble) 적용 */}
                  <div className={`tc-bubble ${isMe ? 'me' : 'other'} ${msg.isSticker ? 'sticker-bubble' : ''}`}>
                      {msg.isSticker ? <div className="sticker-text">{msg.message}</div> : msg.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ 스티커 선택 메뉴판 */}
        {showStickerMenu && (
            <div className="sticker-menu-container">
                {STICKER_LIST.map((sticker, idx) => (
                    <button key={idx} className="sticker-grid-btn" onClick={() => sendSticker(sticker)}>
                        {sticker}
                    </button>
                ))}
            </div>
        )}

        <div className="tc-input-area">
          {/* 스티커 토글 버튼 */}
          <button className={`tc-sticker-toggle-btn ${showStickerMenu ? 'active' : ''}`} onClick={() => setShowStickerMenu(!showStickerMenu)}>😊</button>
          
          <input 
              className="tc-input" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
              placeholder="메시지 입력"
              onFocus={() => setShowStickerMenu(false)}
          />
          <button className="tc-send-btn" onClick={() => handleSend()}>전송</button>
        </div>
      </div>
    </>
  );
};

export default ChatModal;