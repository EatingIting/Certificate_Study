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

                const mapped = (res.data || []).map((x) => ({
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
        const ext = url.split(".").pop().toLowerCase();
        const type = ext === "pdf" ? "pdf" : "image";
        setPreview({ url, type });
    };

    const closePreview = () => setPreview(null);

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
                                            <button
                                                className="ad-view-btn"
                                                onClick={() => openPreview(s.fileUrl)}
                                            >
                                                보기
                                            </button>
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
