import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './AnswerNote.css';
import api from "../../api/api";

// mode: "all" | "summary" | "problem"
const AnswerNote = ({ mode = "all" }) => {
    const { subjectId } = useParams(); // URL에서 과목 ID 가져오기
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                // axios 인스턴스(api)를 사용해 동일한 baseURL/토큰 적용
                const res = await api.get("/answernote", {
                    params: { subjectId },
                });
                setNotes(res.data || []);
            } catch (err) {
                console.error("노트 불러오기 실패:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotes();
    }, [subjectId]);

    const pageTitle = useMemo(() => {
        if (mode === "summary") return "요약노트";
        if (mode === "problem") return "문제노트";
        return "전체노트";
    }, [mode]);

    const filteredNotes = useMemo(() => {
        const getType = (n) => (n?.type || n?.noteType || n?.note_type || "").toString().toUpperCase();
        if (mode === "summary") return notes.filter((n) => getType(n) === "SUMMARY");
        if (mode === "problem") return notes.filter((n) => getType(n) === "PROBLEM");
        return notes; // 전체노트
    }, [notes, mode]);

    if (loading) return <div style={{padding: '20px'}}>로딩 중...</div>;

return (
        <div className="answer-note-container">
            <div className="note-header">
                📒 나의 노트 — {pageTitle}
            </div>

            {filteredNotes.length === 0 ? (
                <div className="empty-state">
                    <p>저장된 노트가 없습니다.</p>
                    <p>AI에게 묻고 <b>[노트 생성]</b> 버튼으로 저장해보세요!</p>
                </div>
            ) : (
                <div className="note-list">
                    {filteredNotes.map((note) => (
                        <div key={note.id} className="note-card">
                            {/* 상단 메타: 왼쪽 닉네임, 오른쪽 날짜 */}
                            <div className="note-meta">
                                <div className="note-meta-left">
                                    <span className="note-author">
                                        {note.authorName || note.author || "작성자"}
                                    </span>
                                </div>
                                <div className="note-meta-right">
                                    <span className="note-date">
                                        {new Date(note.createdAt || Date.now()).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 내용(답변)만 표시 */}
                            <div className="answer-section">
                                <span className="answer-label">💡 AI 요약/해설</span>
                                <p className="answer-text">{note.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnswerNote;