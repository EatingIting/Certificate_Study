import {
  LayoutGrid,
  MessageSquare,
  Mic, MicOff,
  Monitor,
  MoreHorizontal,
  Phone,
  Send,
  Share,
  Smile,
  Users,
  Video, VideoOff,
  X
} from 'lucide-react';
import 'pretendard/dist/web/static/pretendard.css';
import { useEffect, useRef, useState } from 'react';
import './MeetingPage.css';

// --- Components ---

const ButtonControl = ({ active, danger, icon: Icon, onClick, label }) => (
  <button
    onClick={onClick}
    className={`btn-control ${danger ? 'danger' : ''} ${active ? 'active' : ''}`}
    title={label}
  >
    <Icon size={20} strokeWidth={2.5} />
    <span className="tooltip">{label}</span>
  </button>
);

const UserAvatar = ({ name, size = "md", src }) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);
  
  if (src) return <img src={src} alt={name} className={`user-avatar ${size}`} />;

  return (
    <div className={`user-avatar ${size} placeholder`}>
      {initials}
    </div>
  );
};

const VideoTile = ({ user, isMain = false, reaction, stream }) => {
  const videoEl = useRef(null);

  useEffect(() => {
    if (!videoEl.current) return;
    if (!stream) return;

    videoEl.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`video-tile ${isMain ? 'main' : ''}`}>
      <div className="video-content">
        {user.isMe && (
          <video
            ref={videoEl}
            autoPlay
            playsInline
            muted
            className={`video-element ${user.cameraOff ? 'hidden' : ''}`}
          />
        )}

        {user.cameraOff && (
          <div className="camera-off-placeholder">
            <UserAvatar name={user.name} />
            <p className="stream-label">{user.name}</p>
          </div>
        )}
      </div>
      <div className="camera-off-placeholder">
        <UserAvatar name={user.name} />
        <p className="stream-label">{user.name}</p>
      </div>
    </div>
  );
};

// --- Main App Component ---

function MeetingPage() {
  const [layoutMode, setLayoutMode] = useState('speaker'); // 'speaker' | 'grid'
  const [sidebarView, setSidebarView] = useState('chat'); // 'chat' | 'participants' | null
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // My State
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showReactions, setShowReactions] = useState(false);
  const [myReaction, setMyReaction] = useState(null);  
  const [participants] = useState([
    { id: 'u1', name: '정지우', muted: true, cameraOff: false, speaking: false, handRaised: false },
    { id: 'u2', name: '김민아', muted: false, cameraOff: true, speaking: true, handRaised: false },
    { id: 'u3', name: '박서준', muted: false, cameraOff: false, speaking: false, handRaised: true },
    { id: 'u4', name: '이도현', muted: true, cameraOff: false, speaking: false, handRaised: false },
    { id: 'u5', name: '최준호', muted: true, cameraOff: true, speaking: false, handRaised: false },
    { id: 'u6', name: '강현우', muted: false, cameraOff: false, speaking: false, handRaised: false },
  ]);

  const [messages, setMessages] = useState([
    { id: 1, sender: '김민아', text: '다들 LMS에 올린 기출문제 확인하셨나요??', time: '10:02 AM', isMe: false },
    { id: 2, sender: '박서준', text: '네, 잘 봤습니다! 4번 문제 관련해서 질문이 있어요.', time: '10:03 AM', isMe: false },
    { id: 3, sender: '나', text: '제 화면 공유해서 보여드릴게요.', time: '10:05 AM', isMe: true },
  ]);
  const [chatDraft, setChatDraft] = useState("");

  const [localStream, setLocalStream] = useState(null);

  const [activeSpeakerId, setActiveSpeakerId] = useState('u2');
  const reactionEmojis = [
    '👍', '👏', '❤️', '🎉', '😂', '😮', '😢', '🤔', '👋', '🔥', '👀', '💯', '✨', '🙏', '🤝', '🙌'
  ];

  // WebRTC refs
  const localVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    setMessages([...messages, {
      id: Date.now(),
      sender: '나',
      text: chatDraft,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isMe: true
    }]);
    setChatDraft("");
  };

  const handleReaction = (emoji) => {
    setMyReaction(emoji);
    setShowReactions(false);
    setTimeout(() => { setMyReaction(null); }, 2500);
  };

  const toggleSidebar = (view) => {
    if (sidebarOpen && sidebarView === view) {
      setSidebarOpen(false);
    } else {
      setSidebarView(view);
      setSidebarOpen(true);
    }
  };

  const getMainUser = () => {
    if (activeSpeakerId === 'me') {
      return { id: 'me', name: '나', muted: !micOn, cameraOff: !camOn, isMe: true };
    }
    return participants.find(p => p.id === activeSpeakerId) || participants[0];
  };

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // 로컬 스트림 저장
      localStreamRef.current = stream;
      setLocalStream(stream);

      // video 태그에 연결 (미리보기용)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 🔥 핵심: 스트림 반환
      return stream;

    } catch (err) {
      console.error("미디어 접근 실패:", err);
      return null; // 실패 시 null 반환 (중요)
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    // ICE 후보 생성될 때
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate:", event.candidate);
        // 👉 다음 단계에서 WebSocket으로 보냄
      }
    };

    // 상대방 스트림 수신 (지금은 안 씀)
    pc.ontrack = (event) => {
      console.log("상대방 스트림 수신", event.streams);
    };

    // 내 미디어 트랙 추가
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    peerConnectionRef.current = pc;
  };

  useEffect(() => {
    const init = async () => {
      const stream = await startLocalMedia();

      if (!stream) {
        console.error("로컬 스트림 생성 실패");
        return;
      }

      createPeerConnection(stream);
    };

    init();

    return () => {
      peerConnectionRef.current?.close();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = camOn;
    });
  }, [camOn, localStream]);

  return (
    <>
      <div className="meet-layout">
        
        {/* --- Main Stage Area --- */}
        <main className="meet-main">
          
          {/* Header (Floating) */}
          <div className="meet-header">
            <div className="header-info glass-panel">
              <div className="header-icon">
                <Monitor size={20} />
              </div>
              <div>
                <h1 className="header-title">주간 제품 회의</h1>
                <div className="header-meta">
                  <span><Users size={10} /> 7명 접속 중</span>
                  <span className="dot" />
                  <span>00:24:15</span>
                </div>
              </div>
            </div>

            <div className="header-actions glass-panel">
              <button 
                  onClick={() => setLayoutMode('speaker')}
                  className={`view-btn ${layoutMode === 'speaker' ? 'active' : ''}`}
                  title="발표자 보기"
              >
                  <Monitor size={18} />
              </button>
              <button 
                  onClick={() => setLayoutMode('grid')}
                  className={`view-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                  title="그리드 보기"
              >
                  <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          {/* Video Grid Logic */}
          <div className="meet-stage">
            {layoutMode === 'speaker' ? (
              // Speaker View Layout
              <div className="layout-speaker">
                <div className="main-stage">
                  <VideoTile
                    user={getMainUser()}
                    isMain
                    stream={getMainUser().isMe ? localStream : null}
                  />
                </div>
                
                <div className="bottom-strip custom-scrollbar">
                  {/* [수정 3-1] '나' 타일 클릭 시 activeSpeakerId를 'me'로 설정 */}
                  <div 
                    className={`strip-item ${activeSpeakerId === 'me' ? 'active-strip' : ''}`} 
                    onClick={() => setActiveSpeakerId('me')}
                  >
                    <VideoTile
                      user={{ id:'me', name: '나', muted: !micOn, cameraOff: !camOn, isMe: true }}
                      reaction={myReaction}
                      stream={localStream}
                    />
                  </div>

                  {/* [수정 3-2] 다른 참가자 타일 클릭 시 해당 ID로 설정 */}
                  {/* 팁: filter를 제거하면 클릭해도 하단 리스트에서 사라지지 않아 더 자연스럽습니다. */}
                  {participants.map(p => (
                    <div 
                        key={p.id} 
                        className={`strip-item ${activeSpeakerId === p.id ? 'active-strip' : ''}`}
                        onClick={() => setActiveSpeakerId(p.id)}
                    >
                        <VideoTile user={p} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Grid View Layout (기존 유지)
              <div className="layout-grid custom-scrollbar">
                <div className="video-tile-wrapper">
                  <VideoTile user={{ name: '나', muted: !micOn, cameraOff: !camOn, isMe: true }} reaction={myReaction} />
                </div>
                {participants.map(p => (
                  <div key={p.id} className="video-tile-wrapper">
                    <VideoTile user={p} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- Bottom Control Bar --- */}
          <div className="meet-controls-container">
            
            {/* Reaction Popup */}
            {showReactions && (
              <div className="reaction-popup glass-panel">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="reaction-btn"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="controls-toolbar glass-panel">
              <ButtonControl 
                  label={micOn ? "마이크 끄기" : "마이크 켜기"} 
                  active={!micOn} 
                  icon={micOn ? Mic : MicOff} 
                  onClick={() => setMicOn(!micOn)} 
              />
              <ButtonControl 
                  label={camOn ? "카메라 끄기" : "카메라 켜기"} 
                  active={!camOn} 
                  icon={camOn ? Video : VideoOff} 
                  onClick={() => setCamOn(!camOn)} 
              />
              <div className="divider"></div>
              
              <ButtonControl label="화면 공유" icon={Monitor} onClick={() => {}} />
              
              <ButtonControl 
                label="반응" 
                icon={Smile} 
                active={showReactions}
                onClick={() => setShowReactions(!showReactions)} 
              />
              
              <ButtonControl 
                  label="채팅" 
                  active={sidebarOpen && sidebarView === 'chat'} 
                  icon={MessageSquare} 
                  onClick={() => toggleSidebar('chat')} 
              />
              <ButtonControl 
                  label="참여자" 
                  active={sidebarOpen && sidebarView === 'participants'} 
                  icon={Users} 
                  onClick={() => toggleSidebar('participants')} 
              />
              <div className="divider"></div>
              <ButtonControl label="통화 종료" danger icon={Phone} onClick={() => alert("통화가 종료되었습니다.")} />
            </div>
          </div>
        </main>

        {/* --- Right Sidebar Panel --- */}
        <aside className={`meet-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-inner">
            <div className="sidebar-header">
                <h2 className="sidebar-title">
                  {sidebarView === 'chat' ? '회의 채팅' : '참여자 목록'}
                </h2>
                <button onClick={() => setSidebarOpen(false)} className="close-btn">
                  <X size={20} />
                </button>
            </div>

            {/* Chat Content */}
            {sidebarView === 'chat' && (
              <>
                <div className="chat-area custom-scrollbar">
                    {messages.map(msg => (
                      <div key={msg.id} className={`chat-msg ${msg.isMe ? 'me' : 'others'}`}>
                        <div className="msg-content-wrapper">
                            {!msg.isMe && <UserAvatar name={msg.sender} size="sm" />}
                            <div className="msg-bubble">
                              {msg.text}
                            </div>
                        </div>
                        <span className="msg-time">{msg.sender}, {msg.time}</span>
                      </div>
                    ))}
                </div>
                
                <div className="chat-input-area">
                  <form onSubmit={handleSendMessage} className="chat-form">
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="chat-input"
                      />
                      <button 
                        type="submit"
                        className="send-btn"
                        disabled={!chatDraft.trim()}
                      >
                        <Send size={16} />
                      </button>
                  </form>
                </div>
              </>
            )}

            {/* Participants Content */}
            {sidebarView === 'participants' && (
              <div className="participants-area custom-scrollbar">
                <div className="section-label">참여 중 ({participants.length + 1})</div>
                
                {/* Me */}
                <div className="participant-card me">
                    <div className="p-info">
                      <UserAvatar name="나" />
                      <div>
                          <div className="p-name me">나 (호스트)</div>
                          <div className="p-role">나</div>
                      </div>
                    </div>
                    <div className="p-status">
                      {!micOn && <MicOff size={16} className="icon-red" />}
                      {!camOn && <VideoOff size={16} className="icon-red" />}
                    </div>
                </div>

                {/* Others */}
                {participants.map(p => (
                  <div key={p.id} className="participant-card">
                      <div className="p-info">
                        <UserAvatar name={p.name} />
                        <div>
                            <div className="p-name">{p.name}</div>
                            <div className="p-role">팀원</div>
                        </div>
                      </div>
                      <div className="p-status">
                        {p.muted ? <MicOff size={16} className="icon-red" /> : <Mic size={16} className="icon-hidden" />}
                        {p.cameraOff ? <VideoOff size={16} className="icon-red" /> : <Video size={16} className="icon-hidden" />}
                        <button className="more-btn">
                            <MoreHorizontal size={16} />
                        </button>
                      </div>
                  </div>
                ))}

                <div className="invite-section">
                    <button className="invite-btn">
                      <Share size={16} /> 초대하기
                    </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export default MeetingPage;