import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './AnswerNote.css';
import api from "../../api/api";
import { useLMS } from "../LMSContext";

// mode: "all" | "summary" | "problem"
const AnswerNote = ({ mode = "all" }) => {
    const { subjectId } = useParams();
    const { email } = useLMS();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingNote, setEditingNote] = useState(null);
    const [editForm, setEditForm] = useState({ question: "", answer: "", memo: "", type: "PROBLEM" });
    const [editSaving, setEditSaving] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(null);

    const fetchNotes = useCallback(async () => {
        if (!subjectId) return;
        try {
            const res = await api.get("/answernote", { params: { subjectId } });
            setNotes(res.data || []);
        } catch (err) {
            console.error("노트 불러오기 실패:", err);
        } finally {
            setLoading(false);
        }
    }, [subjectId]);

    useEffect(() => {
        setLoading(true);
        fetchNotes();
    }, [fetchNotes]);

    const pageTitle = useMemo(() => {
        if (mode === "summary") return "요약노트";
        if (mode === "problem") return "문제노트";
        return "전체노트";
    }, [mode]);

    const filteredNotes = useMemo(() => {
        const getType = (n) => (n?.type || n?.noteType || n?.note_type || "").toString().toUpperCase();
        if (mode === "summary") return notes.filter((n) => getType(n) === "SUMMARY");
        if (mode === "problem") return notes.filter((n) => getType(n) === "PROBLEM");
        return notes;
    }, [notes, mode]);

    const isMyNote = (note) => {
        const myEmail = email || sessionStorage.getItem("userEmail") || "";
        const noteEmail = note?.userEmail || "";
        return myEmail && noteEmail && myEmail.trim().toLowerCase() === noteEmail.trim().toLowerCase();
    };

    const openEdit = (note) => {
        setEditingNote(note);
        setEditForm({
            question: note.question || "",
            answer: note.answer || "",
            memo: note.memo ?? "",
            type: (note.type || note.noteType || "PROBLEM").toUpperCase(),
        });
    };

    const closeEdit = () => {
        setEditingNote(null);
        setEditForm({ question: "", answer: "", memo: "", type: "PROBLEM" });
    };

    const handleEditSave = async () => {
        if (!editingNote?.id) return;
        setEditSaving(true);
        try {
            await api.put(`/answernote/${editingNote.id}`, {
                question: editForm.question,
                answer: editForm.answer,
                memo: editForm.memo,
                type: editForm.type,
            });
            closeEdit();
            await fetchNotes();
        } catch (e) {
            const msg = e.response?.data?.message || e.response?.data || e.message || "수정 실패";
            alert(typeof msg === "string" ? msg : "노트 수정에 실패했습니다.");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (note) => {
        if (!window.confirm("이 노트를 삭제할까요?")) return;
        setDeleteLoading(note.id);
        try {
            await api.delete(`/answernote/${note.id}`);
            await fetchNotes();
        } catch (e) {
            const msg = e.response?.data?.message || e.response?.data || e.message || "삭제 실패";
            alert(typeof msg === "string" ? msg : "노트 삭제에 실패했습니다.");
        } finally {
            setDeleteLoading(null);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>로딩 중...</div>;

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
                            <div className="note-meta">
                                <div className="note-meta-left">
                                    <span className="note-author">
                                        {note.authorName || note.author || "작성자"}
                                    </span>
                                </div>
                                <div className="note-meta-right">
                                    {isMyNote(note) && (
                                        <span className="note-actions">
                                            <button type="button" className="note-btn note-btn-edit" onClick={() => openEdit(note)}>수정</button>
                                            <button type="button" className="note-btn note-btn-delete" onClick={() => handleDelete(note)} disabled={deleteLoading === note.id}>
                                                {deleteLoading === note.id ? "삭제 중…" : "삭제"}
                                            </button>
                                        </span>
                                    )}
                                    <span className="note-date">
                                        {new Date(note.createdAt || Date.now()).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {note.question && (
                                <div className="note-card-title">
                                    {note.question}
                                </div>
                            )}

                            <div className="answer-section">
                                <span className="answer-label">💡 AI 요약/해설</span>
                                <p className="answer-text">{note.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 수정 모달 */}
            {editingNote && (
                <div className="note-modal-overlay" onClick={closeEdit}>
                    <div className="note-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="note-modal-title">노트 수정</h3>
                        <div className="note-modal-body">
                            <label>질문</label>
                            <textarea className="note-modal-input" rows={3} value={editForm.question} onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))} />
                            <label>답변 / 해설</label>
                            <textarea className="note-modal-input" rows={8} value={editForm.answer} onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))} />
                            <label>메모</label>
                            <input type="text" className="note-modal-input" value={editForm.memo} onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))} placeholder="선택" />
                            <label>종류</label>
                            <select className="note-modal-input" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                                <option value="SUMMARY">요약노트</option>
                                <option value="PROBLEM">문제노트</option>
                            </select>
                        </div>
                        <div className="note-modal-footer">
                            <button type="button" className="note-btn note-btn-cancel" onClick={closeEdit}>취소</button>
                            <button type="button" className="note-btn note-btn-save" onClick={handleEditSave} disabled={editSaving}>{editSaving ? "저장 중…" : "저장"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnswerNote;