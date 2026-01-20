import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AssignmentDetail.css";

const AssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // ✅ 모달 상태
    const [preview, setPreview] = useState(null); // { url, type }

    // ✅ 데모 데이터
    const submissions = useMemo(
        () => [
            {
                name: "손00",
                submittedAt: "2025-11-22 21:10",
                status: "제출됨",
                fileUrl: "/sample/sample.pdf", // pdf
            },
            {
                name: "최00",
                submittedAt: "-",
                status: "미제출",
                fileUrl: null,
            },
            {
                name: "박00",
                submittedAt: "2025-11-22 20:02",
                status: "제출됨",
                fileUrl: "/sample/sample.png", // image
            },
            {
                name: "이00",
                submittedAt: "-",
                status: "미제출",
                fileUrl: null,
            },
        ],
        []
    );

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
                        <div className="ad-icon" aria-hidden="true">📄</div>
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
                                            <span className="ad-avatar" />
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
