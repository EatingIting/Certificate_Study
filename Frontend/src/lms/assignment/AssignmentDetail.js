import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AssignmentDetail.css";
import api from "../../api/api";


const AssignmentDetail = () => {
    const { id } = useParams();
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

    // ----- AI에게 보기 (제출물 자동 읽기) -----
    const [aiModal, setAiModal] = useState(null); // { submissionId, name } | null
    const [aiMessage, setAiMessage] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiReply, setAiReply] = useState(null);

    const openAiModal = (s) => {
        if (!s?.fileUrl || s.submissionId == null) return;
        setAiModal({ submissionId: String(s.submissionId), name: s.name });
        setAiMessage("");
        setAiReply(null);
    };
    const closeAiModal = () => setAiModal(null);

    const sendToAi = async () => {
        if (!aiModal) return;
        setAiLoading(true);
        setAiReply(null);
        try {
            const res = await api.post("/ai/chat/with-submission", {
                message: aiMessage.trim() || "이 제출물을 보고 요약하거나 피드백해줘.",
                submissionId: aiModal.submissionId,
            });
            setAiReply(res.data != null ? String(res.data) : "");
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
                                                    AI에게 보기
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

            {/* ===== AI에게 보기 모달 ===== */}
            {aiModal && (
                <div className="ad-preview-overlay" onClick={closeAiModal}>
                    <div className="ad-ai-modal ad-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="ad-preview-close" onClick={closeAiModal}>✕</button>
                        <h3 className="ad-ai-title">AI에게 보기 — {aiModal.name}</h3>
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
