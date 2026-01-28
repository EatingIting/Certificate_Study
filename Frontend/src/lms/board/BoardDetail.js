import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Board.css";
import { BoardApi, formatKst } from "./BoardApi";

function BoardDetail() {
    let navigate = useNavigate();
    let { subjectId, postId } = useParams();

    let [loading, setLoading] = useState(false);
    let [error, setError] = useState("");
    let [detail, setDetail] = useState(null); // { post, comments, attachments }

    let categoryToCode = (v) => {
        if (!v) return "";
        if (v === "공지") return "NOTICE";
        if (v === "일반") return "GENERAL";
        if (v === "질문") return "QNA";
        if (v === "자료") return "RESOURCE";
        return v;
    };

    let categoryToLabel = (v) => {
        if (!v) return "";
        if (v === "NOTICE") return "공지";
        if (v === "GENERAL") return "일반";
        if (v === "QNA") return "질문";
        if (v === "RESOURCE") return "자료";
        return v;
    };

    useEffect(() => {
        if (!postId) return;

        let alive = true;

        (async () => {
            try {
                setLoading(true);
                setError("");

                let data = await BoardApi.getDetail(postId, true); // ✅ 들어오면 조회수 증가
                if (!alive) return;

                setDetail(data);
            } catch (e) {
                if (!alive) return;
                setError(e?.message || "상세 조회 실패");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [postId]);

    let onBack = () => navigate(`/lms/${subjectId}/board`); // board로
    let onEdit = () => navigate(`/lms/${subjectId}/board/${postId}/edit`);
    let onDelete = async () => {
        let ok = window.confirm("정말 삭제할까요?");
        if (!ok) return;
        await BoardApi.deletePost(postId);
        onBack();
    };

    if (loading) {
        return (
        <div className="bd">
            <div className="bd-card">
                <div className="bd-sub">불러오는 중...</div>
            </div>
        </div>
        );
    }

    if (error) {
        return (
            <div className="bd">
                <div className="bd-head">
                    <div>
                        <h2 className="bd-title">게시글 상세</h2>
                        <p className="bd-sub">오류가 발생했습니다.</p>
                    </div>
                    <div className="bd-actions">
                        <button className="bd-btn-ghost" onClick={onBack}>
                        목록
                        </button>
                    </div>
                </div>
                    <div className="bd-card">
                    <div className="bd-sub">{error}</div>
                </div>
            </div>
        );
    }

    let post = detail?.post;

    if (!post) {
        return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시글 상세</h2>
                    <p className="bd-sub">글을 찾을 수 없습니다.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn-ghost" onClick={onBack}>
                        목록
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-sub">삭제되었거나 존재하지 않는 글입니다.</div>
            </div>
        </div>
        );
    }

    let isNotice = categoryToCode(post.category) === "NOTICE" || post.pinned;;

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시글 상세</h2>
                    <p className="bd-sub">글 내용을 확인할 수 있어요.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn-ghost" onClick={onBack}>
                        목록
                    </button>
                    <button className="bd-btn-ghost" onClick={onEdit}>
                        수정
                    </button>
                    <button className="bd-btn-ghost" onClick={onDelete}>
                        삭제
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-chip notice">{isNotice ? "공지" : categoryToLabel(post.category)}</div>

                <h3 className="bd-detail-title" style={{ marginTop: 10 }}>
                    {post.title}
                </h3>

                <div className="bd-detail-meta">
                    <span>작성자: {post.userId}</span>
                    <span>작성일: {formatKst(post.createdAt)}</span>
                    <span>조회수: {post.viewCount ?? 0}</span>
                </div>

                <div className="bd-detail-body">{post.content}</div>

                {/* 첨부(현재 백엔드는 "메타(url)" 기반) */}
                {detail?.attachments?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                        <div className="bd-label" style={{ marginBottom: 8 }}>
                            첨부
                        </div>

                        <ul className="bd-filelist">
                            {detail.attachments.map((a) => (
                                <li key={a.attachmentId} className="bd-fileitem">
                                    <a className="bd-filename" href={a.url} target="_blank" rel="noreferrer">
                                        {a.originalName || a.url}
                                    </a>
                                    <span className="bd-filesize">{a.sizeBytes ? `${a.sizeBytes} B` : ""}</span>
                                    <span />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 댓글은 UI가 아직 없어서 "개수"만 표시 (원하면 바로 붙여줄게) */}
                {Array.isArray(detail?.comments) && (
                    <div className="bd-hint" style={{ marginTop: 10 }}>
                        댓글 {detail.comments.length}개
                    </div>
                )}
            </div>
        </div>
    );
}

export default BoardDetail;