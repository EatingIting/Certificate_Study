import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './AnswerNote.css';
import { getHostnameWithPort } from "../../utils/backendUrl";

const AnswerNote = () => {
    const { subjectId } = useParams(); // URL에서 과목 ID 가져오기
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    const apiBaseUrl = `http://${getHostnameWithPort()}`; // API 주소

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const token = sessionStorage.getItem("accessToken");
                // 🟢 백엔드: GET /api/answernote?subjectId={id} 형태로 가정
                const res = await fetch(`${apiBaseUrl}/api/answernote?subjectId=${subjectId}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setNotes(data);
                } else {
                    console.error("오답노트 불러오기 실패");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotes();
    }, [subjectId, apiBaseUrl]);

    if (loading) return <div style={{padding: '20px'}}>로딩 중...</div>;

return (
        <div className="answer-note-container">
            <div className="note-header">
                📒 나의 오답노트
            </div>

            {notes.length === 0 ? (
                <div className="empty-state">
                    <p>저장된 오답노트가 없습니다.</p>
                    <p>AI 채팅방에서 질문하고 <b>[오답노트 저장]</b> 버튼을 눌러보세요!</p>
                </div>
            ) : (
                <div className="note-list">
                    {notes.map((note) => (
                        <div key={note.id} className="note-card">
                            <div className="question-section">
                                <span className="badge-question">QUESTION</span>
                                <h3 className="question-text">{note.question}</h3>
                            </div>
                            
                            <div className="answer-section">
                                <span className="answer-label">💡 AI 해설</span>
                                <p className="answer-text">{note.answer}</p>
                            </div>

                            <div className="note-date">
                                {new Date(note.createdAt || Date.now()).toLocaleDateString()} 저장됨
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnswerNote;