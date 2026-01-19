// src/lms/chat/ChatModal.js
import React, { useState, useEffect, useRef } from 'react';
import './ChatModal.css'; // 새로 만든 초록색 CSS 연결

const MOCK_USERS = [
  { id: 'user1', name: '김팀장', avatar: '👨‍💼' },
  { id: 'user2', name: '이대리', avatar: '👩‍💻' },
  { id: 'user3', name: '박신입', avatar: '🐣' },
  { id: 'user4', name: '멘토님', avatar: '🧙‍♂️' },
];

const RANDOM_RESPONSES = [
  "오, 그거 좋은 생각이네요!", "확인했습니다~", "잠시만요, 코드 좀 볼게요.", 
  "식사는 하셨나요?", "화이팅입니다! 🔥", "ㅋㅋㅋㅋㅋㅋ", "넵!", "서버 로그 확인해볼게요."
];

const ChatModal = ({ onClose, isOpen, onNotificationChange }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [myNickname, setMyNickname] = useState("나");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [localBadgeCount, setLocalBadgeCount] = useState(0);
  const scrollRef = useRef(null);

  const getCurrentTime = () => {
    const now = new Date();
    const ampm = now.getHours() >= 12 ? '오후' : '오전';
    const hours = now.getHours() % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${ampm} ${hours}:${minutes}`;
  };

  useEffect(() => {
    setMessages([
      { type: 'system', text: "2024년 1월 25일 목요일" },
      { type: 'system', text: "채팅방에 입장했습니다." },
      { type: 'other', id: 1, text: "안녕하세요! 정보처리기사 스터디방입니다.", sender: MOCK_USERS[0], time: getCurrentTime(), unread: 0 }
    ]);
  }, []);

  useEffect(() => {
    if (isOpen) setLocalBadgeCount(0);
  }, [isOpen]);

  useEffect(() => {
    if (onNotificationChange) onNotificationChange(localBadgeCount);
  }, [localBadgeCount, onNotificationChange]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typingUsers, isPlusMenuOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prevMsgs => prevMsgs.map(msg => {
        if (msg.unread > 0 && Math.random() > 0.7) return { ...msg, unread: msg.unread - 1 };
        return msg;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (inputValue.trim() !== "") {
        setTypingUsers(prev => prev.includes(myNickname) ? prev : [myNickname, ...prev]);
    } else {
        setTypingUsers(prev => prev.filter(u => u !== myNickname));
    }
  }, [inputValue, myNickname]);

  useEffect(() => {
    const triggerBotAction = () => {
        const availableUsers = MOCK_USERS.filter(u => !typingUsers.includes(u.name));
        if (availableUsers.length === 0) return;

        const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
        const randomText = RANDOM_RESPONSES[Math.floor(Math.random() * RANDOM_RESPONSES.length)];

        setTypingUsers(prev => [...prev, randomUser.name]);

        const typingDuration = Math.floor(Math.random() * 2000) + 2000;

        setTimeout(() => {
            setMessages(prev => [...prev, {
                type: 'other', text: randomText, sender: randomUser,
                time: getCurrentTime(), id: Date.now() + Math.random(),
                unread: Math.floor(Math.random() * 3) + 1 
            }]);
            setTypingUsers(prev => prev.filter(name => name !== randomUser.name));
            if (!isOpen) setLocalBadgeCount(prev => prev + 1);
        }, typingDuration);
    };
    const interval = setInterval(() => { if (Math.random() > 0.6) triggerBotAction(); }, 3000);
    return () => clearInterval(interval);
  }, [typingUsers, isOpen]);

  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]}님이 입력 중...`;
    return `${typingUsers[0]}님 외 ${typingUsers.length - 1}명이 입력 중...`;
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages(prev => [...prev, { type: 'me', text: inputValue, time: getCurrentTime(), id: Date.now(), unread: 4 }]);
    setInputValue("");
  };

  const startEditing = () => { setTempName(myNickname); setIsEditingName(true); };
  const saveName = () => { if (tempName.trim()) setMyNickname(tempName); setIsEditingName(false); };

  return (
    <div className="tc-wrapper">
      <div className="tc-header">
        <div className="tc-title-row"><span className="tc-title">정보처리기사 뽀개기</span><span className="tc-count">{MOCK_USERS.length + 1}</span></div>
        <div className="tc-icons"><span onClick={() => setShowDrawer(true)}>≡</span><span onClick={onClose}>×</span></div>
      </div>
      <div className="tc-body" ref={scrollRef}>
        {messages.map((msg) => {
          if (msg.type === 'system') return <div key={msg.id} className="tc-system">{msg.text}</div>;
          const isMe = msg.type === 'me';
          return (
            <div key={msg.id} className={`tc-msg-row ${isMe ? 'me' : 'other'}`}>
              {!isMe && <div className="tc-profile">{msg.sender.avatar}</div>}
              <div style={{display:'flex', flexDirection:'column', alignItems: isMe?'flex-end':'flex-start'}}>
                {!isMe && <div className="tc-name">{msg.sender.name}</div>}
                <div className="tc-msg-inner">
                    <div className={`tc-bubble ${isMe ? 'me' : 'other'}`}>{msg.text}</div>
                    <div className="tc-meta">
                        {msg.unread > 0 && <span className="tc-unread">{msg.unread}</span>}
                        <span className="tc-time">{msg.time}</span>
                    </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {typingUsers.length > 0 && (
          <div className="tc-typing-bar"><div className="tc-dots"><div className="tc-dot"></div><div className="tc-dot"></div><div className="tc-dot"></div></div><span>{getTypingText()}</span></div>
      )}
      <div className="tc-input-area">
        {isPlusMenuOpen && (
            <div className="tc-plus-menu">
                <div className="tc-menu-item"><div className="tc-menu-icon">🖼️</div>앨범</div>
                <div className="tc-menu-item"><div className="tc-menu-icon">📷</div>카메라</div>
                <div className="tc-menu-item"><div className="tc-menu-icon">📁</div>파일</div>
                <div className="tc-menu-item"><div className="tc-menu-icon">📅</div>일정</div>
                <div className="tc-menu-item"><div className="tc-menu-icon">📞</div>통화</div>
                <div className="tc-menu-item"><div className="tc-menu-icon">📍</div>지도</div>
            </div>
        )}
        <button className={`tc-plus-btn ${isPlusMenuOpen ? 'active' : ''}`} onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}>+</button>
        <input className="tc-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="메시지 입력" onClick={() => setIsPlusMenuOpen(false)} />
        <button className="tc-send-btn" onClick={handleSend} disabled={!inputValue.trim()}>전송</button>
      </div>
      {showDrawer && (
        <div className="tc-drawer-overlay" onClick={() => setShowDrawer(false)}>
           <div className="tc-drawer-panel" onClick={(e) => e.stopPropagation()}>
              <div className="tc-drawer-header">대화상대</div>
              <div className="tc-drawer-list">
                 <div className="tc-drawer-item">
                    <div className="tc-drawer-info">
                        <div className="tc-profile" style={{width:'30px', height:'30px', fontSize:'18px'}}>👤</div>
                        {isEditingName ? (<input className="tc-edit-input" value={tempName} onChange={(e) => setTempName(e.target.value)} autoFocus onKeyPress={(e) => e.key==='Enter' && saveName()}/>) : (<div className="tc-drawer-name" style={{fontWeight:'bold'}}>{myNickname} (나)</div>)}
                    </div>
                    {isEditingName ? (<button className="tc-edit-btn" onClick={saveName}>저장</button>) : (<button className="tc-edit-btn" onClick={startEditing}>✏️</button>)}
                 </div>
                 <hr style={{margin:'10px 0', border:'0', borderTop:'1px solid #eee'}}/>
                 {MOCK_USERS.map(user => (
                   <div key={user.id} className="tc-drawer-item"><div className="tc-drawer-info"><div className="tc-profile" style={{width:'30px', height:'30px', fontSize:'18px'}}>{user.avatar}</div><div className="tc-drawer-name">{user.name}</div></div></div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export default ChatModal;