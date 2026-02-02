import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Board.css";
import { BoardApi, formatKst } from "./BoardApi";

function BoardDetail() {
    let navigate = useNavigate();
    let { subjectId, postId } = useParams();

    let [loading, setLoading] = useState(false);
    let [error, setError] = useState("");
    let [forbidden, setForbidden] = useState(false);
    let [detail, setDetail] = useState(null);
    let [newComment, setNewComment] = useState("");
    let [comments, setComments] = useState([]);
    let [commentSubmitting, setCommentSubmitting] = useState(false);

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

    /* =========================
       게시글 상세
       ========================= */
    useEffect(() => {
        if (!postId) return;

        let alive = true;

        (async () => {
            try {
                setLoading(true);
                setError("");
                setForbidden(false);

                let data = await BoardApi.getDetail(postId, true);
                if (!alive) return;

                setDetail(data);
            } catch (e) {
                if (!alive) return;
                setForbidden(e?.status === 403);
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

    /* =========================
       댓글 목록
       ========================= */
    useEffect(() => {
        if (!postId) return;

        let alive = true;

        (async () => {
            try {
                let list = await BoardApi.getComments(postId);
                if (!alive) return;
                setComments(Array.isArray(list) ? list : []);
            } catch {
                if (!alive) return;
                setComments([]);
            }
        })();

        return () => {
            alive = false;
        };
    }, [postId]);

    let onBack = () => navigate(`/lms/${subjectId}/board`);
    let onEdit = () => navigate(`/lms/${subjectId}/board/${postId}/edit`);

    let onDelete = async () => {
        let ok = window.confirm("정말 삭제할까요?");
        if (!ok) return;
        await BoardApi.deletePost(postId);
        onBack();
    };

    let reloadComments = async () => {
        let list = await BoardApi.getComments(postId);
        setComments(Array.isArray(list) ? list : []);
    };

    let onCreateComment = async () => {
        let text = newComment.trim();
        if (!text) return;

        try {
            setCommentSubmitting(true);
            await BoardApi.createComment(postId, { content: text });
            setNewComment("");
            await reloadComments();
        } catch (e) {
            alert(e?.message || "댓글 작성 실패");
        } finally {
            setCommentSubmitting(false);
        }
    };

    let onDeleteComment = async (commentId) => {
        let ok = window.confirm("댓글을 삭제할까요?");
        if (!ok) return;

        try {
            await BoardApi.deleteComment(commentId);
            await reloadComments();
        } catch (e) {
            alert(e?.message || "댓글 삭제 실패");
        }
    };

    /* =========================
       렌더링
       ========================= */

    if (forbidden) {
        return (
            <div className="bd bd-detail">
                <div className="bd-head">
                    <div>
                        <h2 className="bd-title">게시글 상세</h2>
                        <p className="bd-sub">권한이 없어 열 수 없습니다.</p>
                    </div>
                    <div className="bd-actions">
                        <button className="bd-btn-ghost" onClick={onBack}>
                            목록
                        </button>
                    </div>
                </div>

                <div className="bd-card">
                    <div className="bd-sub" style={{ fontWeight: 700, marginBottom: 6 }}>
                        접근할 수 없습니다
                    </div>
                    <div className="bd-sub">{error || "스터디원만 접근 가능합니다."}</div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bd bd-detail">
                <div className="bd-card">
                    <div className="bd-sub">불러오는 중...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bd bd-detail">
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
            <div className="bd bd-detail">
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
                    <div className="bd-sub">
                        삭제되었거나 존재하지 않는 글입니다.
                    </div>
                </div>
            </div>
        );
    }

    let isNotice =
        categoryToCode(post.category) === "NOTICE" || post.pinned;

    return (
        <div className="bd bd-detail">
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
                <div className="bd-chip notice">
                    {isNotice ? "공지" : categoryToLabel(post.category)}
                </div>

                <h3 className="bd-detail-title" style={{ marginTop: 10 }}>
                    {post.title}
                </h3>

                <div className="bd-detail-meta">
                    <span>작성자: {post.nickname}</span>
                    <span>작성일: {formatKst(post.createdAt)}</span>
                    <span>조회수: {post.viewCount ?? 0}</span>
                </div>

                <div className="bd-detail-body">
                    {post.content}
                </div>

                {/* 댓글 작성 */}
                <div className="bd-comment-compose" style={{ display: "flex", gap: 10 }}>
                    <textarea
                        className="bd-input"
                        rows={3}
                        placeholder="댓글을 입력하세요."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={commentSubmitting}
                        style={{ flex: 1 }}
                    />
                    <button
                        className="bd-btn"
                        type="button"
                        disabled={commentSubmitting || !newComment.trim()}
                        onClick={onCreateComment}
                    >
                        등록
                    </button>
                </div>

                {/* 댓글 목록 */}
                <div style={{ marginTop: 16 }}>
                    <div className="bd-label" style={{ marginBottom: 8 }}>
                        댓글 {comments.length}개
                    </div>

                    {comments.length === 0 ? (
                        <div className="bd-hint">댓글이 없습니다.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {comments.map((c) => (
                                <div    key={c.commentId} className="bd-card bd-comment-card" style={{ padding: 12 }}>
                                    <div className="bd-comment-meta">
                                        <span className="bd-comment-author">
                                            작성자: {c.nickname}
                                        </span>

                                        <span className="bd-comment-date">
                                            {formatKst(c.createdAt)}
                                        </span>
                                    </div>

                                    <div style={{ whiteSpace: "pre-wrap" }}>
                                        {c.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BoardDetail;
