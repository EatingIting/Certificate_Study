import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AssignmentDetail.css";
import api from "../../api/api";


const AssignmentDetail = () => {
    const { subjectId, id } = useParams();
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                console.log("accessToken:", sessionStorage.getItem("accessToken"));
                const res = await api.get(`/assignments/${id}/submissions`);
                console.log("submissions raw res.data:", res.data);
                console.log("first fileUrl:", res.data?.[0]?.fileUrl);

                const mapped = (res.data || []).map((x) => ({
                    submissionId: x.submissionId,
                    name: x.memberName,
                    submittedAt: x.submittedAt
                        ? x.submittedAt.replace("T", " ").slice(0, 16)
                        : "-",
                    status: x.status,
                    fileUrl: x.fileUrl,
                }));

                setSubmissions(mapped);
            } catch (e) {
                console.error(e);
                alert("과제 상세 불러오기 실패");
            }
        };

        if (id) fetchDetail();
    }, [id]);



    // ✅ 모달 상태
    const [preview, setPreview] = useState(null); // { url, type }


    // 파일 타입 판단
    const openPreview = (url) => {
    const base = api.defaults.baseURL || "";
    const origin = base.replace(/\/api\/?$/, "");
    const fullUrl = url.startsWith("http") ? url : origin + url;

    const ext = fullUrl.split(".").pop().toLowerCase();

    // ✅ PDF는 새 탭으로 열기 (iframe 차단 회피)
    if (ext === "pdf") {
        window.open(fullUrl, "_blank", "noopener,noreferrer");
        return;
    }

    // 이미지는 기존 모달 img로
    setPreview({ url: fullUrl, type: "image" });
    };



    const closePreview = () => setPreview(null);

    // ----- AI에게 묻기 (제출물 자동 읽기) -----
    const [aiModal, setAiModal] = useState(null); // { submissionId, name } | null
    const [aiMessage, setAiMessage] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiReply, setAiReply] = useState(null);
    const [noteType, setNoteType] = useState("PROBLEM"); // SUMMARY | PROBLEM
    const [noteTypeLoading, setNoteTypeLoading] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);

    const openAiModal = (s) => {
        if (!s?.fileUrl || s.submissionId == null) return;
        setAiModal({ submissionId: String(s.submissionId), name: s.name });
        setAiMessage("");
        setAiReply(null);
        setNoteType("PROBLEM");
    };
    const closeAiModal = () => setAiModal(null);

    // AI 답변은 항상 본문을
    // ---
    // (내용)
    // ---
    // 형태로 감싸도록 후처리
    const wrapWithTripleDash = (raw) => {
        let text = raw != null ? String(raw).trim() : "";
        if (!text) return "";

        const dashMatches = text.match(/---/g) || [];
        // 이미 --- 가 2번 이상 들어 있으면 그대로 사용
        if (dashMatches.length >= 2) {
            return text;
        }
        // 아니면 앞뒤에 ---를 붙여줌
        return `---\n${text}\n---`;
    };

    const sendToAi = async () => {
        if (!aiModal) return;
        setAiLoading(true);
        setAiReply(null);
        try {
            const baseMessage =
                aiMessage.trim() || "이 제출물을 보고 요약하거나 피드백해줘.";
            const res = await api.post("/ai/chat/with-submission", {
                message: baseMessage,
                submissionId: aiModal.submissionId,
            });
            const replyTextRaw = res.data != null ? String(res.data) : "";
            const replyText = wrapWithTripleDash(replyTextRaw);
            setAiReply(replyText);

            // 자동 분류 (요약/문제)
            setNoteTypeLoading(true);
            try {
                const c = await api.post("/ai/note/classify", {
                    question: baseMessage,
                    answer: replyText,
                });
                const t = (c.data != null ? String(c.data) : "").toUpperCase().includes("SUMMARY")
                    ? "SUMMARY"
                    : "PROBLEM";
                setNoteType(t);
            } catch (e) {
                // 분류 실패 시 기본값 유지
            } finally {
                setNoteTypeLoading(false);
            }
        } catch (e) {
            const status = e.response?.status;
            const data = e.response?.data;
            setAiReply(
                status === 401
                    ? "로그인이 필요합니다."
                    : "요청 실패: " + (typeof data === "string" ? data : e.message || status || "알 수 없는 오류")
            );
        } finally {
            setAiLoading(false);
        }
    };

    // 요약노트 저장 시, AI 답변에서
    // "맨 첫 번째 ---" 와 "맨 마지막 ---" 를 기준으로
    // 그 사이에 있는 본문만 추출하기 위한 헬퍼
    const buildNoteAnswerText = () => {
        if (!aiReply) return "";
        // 기본은 전체 답변
        let text = String(aiReply);

        // 1) 맨 첫 번째 '---' 와 맨 마지막 '---' 위치 찾기
        const firstDash = text.indexOf("---");
        const lastDash = text.lastIndexOf("---");

        // 2) 둘 다 존재하고, 서로 다른 위치일 때만
        //    그 사이의 내용만 잘라서 사용
        if (firstDash !== -1 && lastDash !== -1 && firstDash < lastDash) {
            text = text.slice(firstDash + 3, lastDash).trim();
        }

        // 3) 완전히 비면 원본을 그대로 사용 (안전장치)
        if (!text.trim()) return String(aiReply);
        return text;
    };

    const saveAsNote = async () => {
        if (!subjectId) {
            alert("subjectId를 찾을 수 없습니다.");
            return;
        }
        if (!aiReply) {
            alert("먼저 AI 답변을 받아주세요.");
            return;
        }
        setNoteSaving(true);
        try {
            const answerText =
                noteType === "SUMMARY" ? buildNoteAnswerText() : String(aiReply);

            await api.post("/answernote", {
                subjectId: String(subjectId),
                question: aiMessage.trim() || "이 제출물을 보고 요약하거나 피드백해줘.",
                answer: answerText,
                memo: "AI에게 묻기에서 저장됨",
                type: noteType, // SUMMARY | PROBLEM
            });
            alert("✅ 노트에 저장되었습니다!");
            closeAiModal();
            navigate(`/lms/${subjectId}/${noteType === "SUMMARY" ? "answernote/summary" : "answernote/problem"}`);
        } catch (e) {
            const status = e.response?.status;
            const data = e.response?.data;
            alert(
                status === 401
                    ? "로그인이 필요합니다."
                    : "저장 실패: " + (typeof data === "string" ? data : e.message || status || "알 수 없는 오류")
            );
        } finally {
            setNoteSaving(false);
        }
    };

    return (
        <div className="ad-page">
            {/* 상단 바 */}
            <div className="ad-topbar">
                <button className="ad-back-btn" onClick={() => navigate(-1)}>
                    ← 목록으로
                </button>
            </div>

            {/* 카드 */}
            <section className="ad-card">
                <div className="ad-card-header">
                    <div className="ad-header-left">
                        <div className="ad-icon" aria-hidden="true">
                            <img src="/assignment.png" alt="과제아이콘"/>
                        </div>

                        <div>
                            <h2 className="ad-title">과제 상세</h2>
                            <p className="ad-subtitle">
                                과제 ID: <span className="ad-mono">{id}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="ad-card-body">
                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                            <tr>
                                <th>스터디원</th>
                                <th>제출시간</th>
                                <th>상태</th>
                                <th>제출물</th>
                            </tr>
                            </thead>
                            <tbody>
                            {submissions.map((s, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <div className="ad-member">
                                            <span className="ad-member-name">{s.name}</span>
                                        </div>
                                    </td>

                                    <td className="ad-td-muted">{s.submittedAt}</td>

                                    <td>
                                        {s.status === "제출됨" ? (
                                            <span className="ad-status ad-status--done">제출됨</span>
                                        ) : (
                                            <span className="ad-status ad-status--miss">미제출</span>
                                        )}
                                    </td>

                                    <td>
                                        {s.fileUrl ? (
                                            <span className="ad-btns">
                                                <button
                                                    className="ad-view-btn"
                                                    onClick={() => openPreview(s.fileUrl)}
                                                >
                                                    보기
                                                </button>
                                                <button
                                                    className="ad-view-btn ad-ai-btn"
                                                    onClick={() => openAiModal(s)}
                                                    title="제출물을 AI가 읽고 피드백해 줍니다"
                                                >
                                                    AI에게 묻기
                                                </button>
                                            </span>
                                        ) : (
                                            <span className="ad-td-muted">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ===== AI에게 묻기 모달 ===== */}
            {aiModal && (
                <div className="ad-preview-overlay" onClick={closeAiModal}>
                    <div className="ad-ai-modal ad-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="ad-preview-close" onClick={closeAiModal}>✕</button>
                        <h3 className="ad-ai-title">AI에게 묻기 — {aiModal.name}</h3>
                        <p className="ad-ai-desc">제출된 파일(PDF/이미지)을 AI가 읽고 답합니다. 질문을 입력하거나 비워두면 요약·피드백을 요청합니다.</p>
                        <textarea
                            className="ad-ai-input"
                            placeholder="예: 이 과제 피드백해줘 / 요약해줘"
                            value={aiMessage}
                            onChange={(e) => setAiMessage(e.target.value)}
                            rows={2}
                        />
                        <button className="ad-view-btn ad-ai-send" onClick={sendToAi} disabled={aiLoading}>
                            {aiLoading ? "처리 중…" : "보내기"}
                        </button>
                        {aiReply != null && (
                            <div className="ad-ai-reply">
                                <strong>AI 답변</strong>
                                <div className="ad-ai-reply-text">{aiReply}</div>
                            </div>
                        )}

                        {/* ===== 노트 생성 (자동 분류 + 토글 수정) ===== */}
                        {aiReply != null && (
                            <div className="ad-note-save">
                                <div className="ad-note-row">
                                    <span className="ad-note-label">
                                        노트 종류 {noteTypeLoading ? "(분류 중…)" : ""}
                                    </span>
                                    <div className="ad-note-toggle">
                                        <button
                                            type="button"
                                            className={`ad-note-chip ${noteType === "SUMMARY" ? "active" : ""}`}
                                            onClick={() => setNoteType("SUMMARY")}
                                            disabled={noteSaving}
                                        >
                                            요약노트
                                        </button>
                                        <button
                                            type="button"
                                            className={`ad-note-chip ${noteType === "PROBLEM" ? "active" : ""}`}
                                            onClick={() => setNoteType("PROBLEM")}
                                            disabled={noteSaving}
                                        >
                                            문제노트
                                        </button>
                                    </div>
                                </div>
                                <button
                                    className="ad-view-btn ad-note-btn"
                                    onClick={saveAsNote}
                                    disabled={noteSaving}
                                    title="노트로 저장하고 해당 화면으로 이동합니다"
                                >
                                    {noteSaving ? "저장 중…" : "노트 생성"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== 미리보기 모달 ===== */}
            {preview && (
                <div className="ad-preview-overlay" onClick={closePreview}>
                    <div
                        className="ad-preview-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="ad-preview-close" onClick={closePreview}>
                            ✕
                        </button>

                        {preview.type === "pdf" ? (
                            <iframe
                                src={preview.url}
                                title="PDF Preview"
                                className="ad-preview-frame"
                            />
                        ) : (
                            <img
                                src={preview.url}
                                alt="제출물 미리보기"
                                className="ad-preview-image"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentDetail;
