import React, { useMemo, useRef, useState } from "react";
import "./MeetingPage.css";

function MeetingPage() {
  // UI용 더미 데이터 (3번/1번 단계에서 서버/RTC로 치환)
  const myId = useMemo(() => crypto.randomUUID(), []);
  const [roomId] = useState("room-1");
  const [me] = useState({ id: myId, name: "Me", muted: false, cameraOff: false });

  const [participants, setParticipants] = useState([
    { id: "u1", name: "Cassie Jung", muted: true, cameraOff: false },
    { id: "u2", name: "Alice Wong", muted: false, cameraOff: false },
    { id: "u3", name: "Theresa Webb", muted: false, cameraOff: false },
    { id: "u4", name: "Christian Wong", muted: true, cameraOff: false },
  ]);

  // 메인(발표자)로 보여줄 사람
  const [activeSpeakerId, setActiveSpeakerId] = useState("u2");

  // 채팅 UI
  const [chatTab, setChatTab] = useState("group"); // group | personal
  const [messages, setMessages] = useState([
    { id: 1, from: "Kathryn Murphy", text: "Good afternoon, everyone.", time: "11:01 AM" },
    { id: 2, from: "Kathryn Murphy", text: "We will start this meeting", time: "11:01 AM" },
    { id: 3, from: "Joshua Abraham", text: "Yes, let's start this meeting", time: "11:02 AM" },
    { id: 4, from: "Kathryn Murphy", text: "Today, we are here to discuss last week's sales.", time: "12:04 AM" },
  ]);
  const [draft, setDraft] = useState("");

  // 하단 컨트롤(실제 기능은 1번 단계에서 연결)
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // 메인/썸네일용 video ref (1번 단계에서 실제 stream 연결)
  const mainVideoRef = useRef(null);

  const activeSpeaker = participants.find(p => p.id === activeSpeakerId) || participants[0];

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now(), from: me.name, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setDraft("");
  };

  return (
    <div className="meet-root">
      {/* Top bar */}
      <header className="meet-topbar">
        <div className="meet-topbar-left">
          <div className="meet-appicon" aria-hidden />
          <div className="meet-title">
            <div className="meet-title-main">[Internal] Weekly Report Marketing + Sales</div>
            <div className="meet-title-sub">Room: <span className="mono">{roomId}</span></div>
          </div>
        </div>

        <div className="meet-topbar-right">
          <div className="meet-host">
            <div className="meet-host-avatar" />
            <div className="meet-host-meta">
              <div className="meet-host-name">Moderator</div>
              <div className="meet-host-sub">You are connected (UI only)</div>
            </div>
          </div>
        </div>
      </header>

      <div className="meet-body">
        {/* Left: Video area */}
        <main className="meet-stage">
          <section className="meet-mainvideo">
            <div className="meet-record-badge">
              <span className="dot" />
              <span>24:01:45</span>
            </div>

            {/* 실제 단계(1번)에서 mainVideoRef에 stream 연결 */}
            <video ref={mainVideoRef} className="meet-video-el" autoPlay playsInline muted />

            {/* 더미 배경(스트림 없을 때 보이도록) */}
            <div className="meet-video-placeholder">
              <div className="meet-placeholder-face" />
              <div className="meet-placeholder-text">
                메인 화면(발표자): <b>{activeSpeaker?.name}</b>
              </div>
            </div>

            <div className="meet-namechip">{activeSpeaker?.name}</div>

            <button className="meet-fullscreen" title="Fullscreen" type="button">
              ⤢
            </button>
          </section>

          <section className="meet-strip">
            {[...participants].map(p => (
              <button
                key={p.id}
                className={`meet-thumb ${p.id === activeSpeakerId ? "active" : ""}`}
                onClick={() => setActiveSpeakerId(p.id)}
                type="button"
                title={`Set ${p.name} as main`}
              >
                <div className="meet-thumb-video">
                  <div className="meet-thumb-placeholder" />
                </div>
                <div className="meet-thumb-name">{p.name}</div>
                <div className="meet-thumb-badges">
                  <span className={`badge ${p.muted ? "off" : "on"}`}>{p.muted ? "🔇" : "🎙️"}</span>
                  <span className={`badge ${p.cameraOff ? "off" : "on"}`}>{p.cameraOff ? "📷⛔" : "📷"}</span>
                </div>
              </button>
            ))}
          </section>

          <footer className="meet-controls">
            <div className="ctl-group">
              <button className="ctl">🎙️</button>
              <button className="ctl">📷</button>
              <button className="ctl">🖥️</button>
            </div>

            <button className="endcall">●</button>

            <div className="ctl-group">
              <button className="ctl">💬</button>
              <button className="ctl">⋯</button>
            </div>
          </footer>
        </main>

        {/* Right: Side panel */}
        <aside className="meet-side">
          <div className="side-section">
            <div className="side-header">
              <div className="side-title">Participants</div>
              <button className="side-action" type="button">Add Participant</button>
            </div>

            <div className="side-list">
              {[me, ...participants].map(u => (
                <div key={u.id} className="side-user">
                  <div className="avatar" />
                  <div className="side-user-meta">
                    <div className="side-user-name">{u.name}{u.id === myId ? " (You)" : ""}</div>
                  </div>
                  <div className="side-user-icons">
                    <span className={`pill ${u.muted ? "off" : "on"}`}>{u.muted ? "🔇" : "🎙️"}</span>
                    <span className={`pill ${u.cameraOff ? "off" : "on"}`}>{u.cameraOff ? "📷⛔" : "📷"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="side-section side-chat">
            <div className="side-header">
              <div className="side-title">Chats</div>
              <div className="tabbar">
                <button className={`tab ${chatTab === "group" ? "active" : ""}`} onClick={() => setChatTab("group")} type="button">Group</button>
                <button className={`tab ${chatTab === "personal" ? "active" : ""}`} onClick={() => setChatTab("personal")} type="button">Personal</button>
              </div>
            </div>

            <div className="chat-body">
              {messages.map(m => (
                <div key={m.id} className={`msg ${m.from === me.name ? "me" : ""}`}>
                  <div className="msg-meta">
                    <span className="msg-from">{m.from}</span>
                    <span className="msg-time">{m.time}</span>
                  </div>
                  <div className="msg-bubble">{m.text}</div>
                </div>
              ))}
            </div>

            <div className="chat-input">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
                placeholder="Type something..."
              />
              <button onClick={onSend} type="button" title="Send">➤</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default MeetingPage;