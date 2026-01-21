// src/test/TestChatroom.js
import React, { useState, useEffect, useRef } from 'react';
import './TestChatroom.css';

const MOCK_USERS = [
  { id: 'user1', name: '김팀장', avatar: '👨‍💼' },
  { id: 'user2', name: '이대리', avatar: '👩‍💻' },
  { id: 'user3', name: '박신입', avatar: '🐣' },
  { id: 'user4', name: '멘토님', avatar: '🧙‍♂️' },
];

const RANDOM_RESPONSES = [
  "오, 좋은 접근이네요!", "잠시만요, 확인해볼게요.", "ㅋㅋㅋㅋㅋㅋ", 
  "식사는 하셨나요?", "화이팅입니다! 🔥", "서버 로그 확인 부탁드려요.", 
  "API 문서는 보셨나요?", "넵 알겠습니다.", "오.. 그렇군요."
];

// [NEW] props로 isOpen과 onNotificationChange를 받습니다.
const TestChatroom = ({ onClose, isOpen, onNotificationChange }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  
  const [showDrawer, setShowDrawer] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  const [myNickname, setMyNickname] = useState("나");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // [NEW] 내가 안 읽은 메시지 개수 (뱃지용)
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
      { type: 'other', id: 1, text: "안녕하세요! 스터디방입니다.", sender: MOCK_USERS[0], time: getCurrentTime(), unread: 0 }
    ]);
  }, []);

  // [NEW] 채팅방이 열리면 뱃지 카운트 초기화
  useEffect(() => {
    if (isOpen) {
      setLocalBadgeCount(0);
    }
  }, [isOpen]);

  // [NEW] 뱃지 카운트가 변하면 부모(LmsMain)에게 알림
  useEffect(() => {
    if (onNotificationChange) {
      onNotificationChange(localBadgeCount);
    }
  }, [localBadgeCount, onNotificationChange]);

  // 스크롤 (열려있을 때만 동작하도록 조건 추가 가능하지만, display:none이라 상관없음)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typingUsers, isPlusMenuOpen]);


  // 읽음 숫자 줄어드는 로직
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prevMsgs => 
        prevMsgs.map(msg => {
          if (msg.unread > 0 && Math.random() > 0.7) {
            return { ...msg, unread: msg.unread - 1 };
          }
          return msg;
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // 입력 감지
  useEffect(() => {
    if (inputValue.trim() !== "") {
        setTypingUsers(prev => prev.includes(myNickname) ? prev : [myNickname, ...prev]);
    } else {
        setTypingUsers(prev => prev.filter(u => u !== myNickname));
    }
  }, [inputValue, myNickname]);

  // --- 봇 시뮬레이션 ---
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
                type: 'other',
                text: randomText,
                sender: randomUser,
                time: getCurrentTime(),
                id: Date.now() + Math.random(),
                unread: Math.floor(Math.random() * 3) + 1 
            }]);
            
            setTypingUsers(prev => prev.filter(name => name !== randomUser.name));

            // [핵심] 채팅방이 닫혀있으면(!isOpen) 뱃지 카운트 증가!
            if (!isOpen) {
                setLocalBadgeCount(prev => prev + 1);
            }

        }, typingDuration);
    };

    const interval = setInterval(() => { if (Math.random() > 0.6) triggerBotAction(); }, 3000);
    return () => clearInterval(interval);
  }, [typingUsers, isOpen]); // isOpen 의존성 추가

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

  // 이름 변경
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
              <div className="tc-content-col" style={{alignItems: isMe ? 'flex-end' : 'flex-start'}}>
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
          <div className="tc-typing-bar">
              <div className="tc-dots"><div className="tc-dot"></div><div className="tc-dot"></div><div className="tc-dot"></div></div>
              <span>{getTypingText()}</span>
          </div>
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

export default TestChatroom;