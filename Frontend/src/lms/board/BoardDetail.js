import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./BoardCommon.css";
import "./BoardDetail.css"
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
    let [replyTo, setReplyTo] = useState(null);
    let [replyText, setReplyText] = useState("");
    let [commentsOpen, setCommentsOpen] = useState(true);
    let [postMenuOpen, setPostMenuOpen] = useState(false);

    let postMenuRef = useRef(null);

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
        let rid = Date.now() + "-" + Math.random().toString(16).slice(2);

        (async () => {
            try {
                setLoading(true);
                setError("");
                setForbidden(false);
                setDetail(null);
                setPostMenuOpen(false);

                console.log("[DETAIL REQ]", rid, "postId=", postId);

                let data = await BoardApi.getDetail(postId, true);

                console.log("[DETAIL RES]", rid, "canEdit/canDelete =", data?.canEdit, data?.canDelete);
                console.log("[DETAIL RES]", rid, "raw =", data);

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

    useEffect(() => {
        if (!postMenuOpen) return;

        let onDown = (e) => {
            if (!postMenuRef.current) return;
            if (!postMenuRef.current.contains(e.target)) {
                setPostMenuOpen(false);
            }
        };

        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [postMenuOpen]);

    let parentComments = comments.filter((c) => !c.parentId);
    let repliesByParent = comments.reduce((acc, c) => {
        if (c.parentId) {
            if (!acc[c.parentId]) acc[c.parentId] = [];
            acc[c.parentId].push(c);
        }
        return acc;
    }, {});

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
        if (!window.confirm("정말 삭제할까요?")) return;

        try {
            await BoardApi.deletePost(postId);
            navigate(`/lms/${subjectId}/board`, { replace: true });
        } catch (e) {
            // 403: 권한 없음
            if (e?.status === 403) {
                alert(e?.message || "삭제 권한이 없습니다.");
                return;
            }
            // 기타
            alert(e?.message || "삭제 실패");
        }
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

    let onCreateReply = async (parentCommentId) => {
        let text = replyText.trim();
        if (!text) return;

        try {
            setCommentSubmitting(true);
            await BoardApi.createComment(postId, {
                content: text,
                parentId: parentCommentId
            });
            setReplyText("");
            setReplyTo(null);
            await reloadComments();
        } catch (e) {
            alert(e?.message || "답글 작성 실패");
        } finally {
            setCommentSubmitting(false);
        }
    }

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
    let canEdit = !!detail?.canEdit;
    let canDelete = !!detail?.canDelete;

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
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-post-head">
                    <div>
                        <div className="bd-chip notice">
                            {isNotice ? "공지" : categoryToLabel(post.category)}
                        </div>

                        <h3 className="bd-detail-title" style={{ marginTop: 10 }}>
                            {post.title}
                        </h3>
                    </div>

                    {(canEdit || canDelete) && (
                        <div className="bd-post-menu" ref={postMenuRef}>
                            <button
                                type="button"
                                className="bd-kebab-btn"
                                onClick={() => setPostMenuOpen((v) => !v)}
                                aria-label="게시글 메뉴"
                            >
                                ︙
                            </button>

                            {postMenuOpen && (
                                <div className="bd-post-dropdown">
                                    {canEdit && (
                                        <button
                                            type="button"
                                            className="bd-post-dropdown-item"
                                            onClick={() => {
                                                setPostMenuOpen(false);
                                                onEdit();
                                            }}
                                        >
                                            수정
                                        </button>
                                    )}

                                    {canDelete && (
                                        <button
                                            type="button"
                                            className="bd-post-dropdown-item danger"
                                            onClick={async () => {
                                                setPostMenuOpen(false);
                                                await onDelete();
                                            }}
                                        >
                                            삭제
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bd-detail-meta">
                    <span>작성자: {post.nickname}</span>
                    <span>작성일: {formatKst(post.createdAt)}</span>
                    <span>조회수: {post.viewCount ?? 0}</span>
                </div>

                <div className="bd-divider" />

                <div className="bd-detail-body">
                    {post.content}
                </div>

                <div className="bd-divider" />

                <div className="bd-comment-section">
                    {/* 댓글 헤더 */}
                    <div className="bd-comment-header">
                        <button
                            type="button"
                            className="bd-comment-toggle"
                            onClick={() => {
                                setCommentsOpen((v) => {
                                    let next = !v;
                                    if (!next) {
                                    setReplyTo(null);
                                    setReplyText("");
                                    }
                                    return next;
                                });
                            }}
                            aria-expanded={commentsOpen}
                        >
                            <span className="bd-comment-toggle-title">
                                댓글 <b>{comments.length}</b>개
                            </span>
                            <span className={`bd-comment-toggle-icon ${commentsOpen ? "open" : ""}`}>▾</span>
                        </button>
                    </div>

                    {/* 아래 내용(목록 + 입력창) */}
                    {commentsOpen && (
                        <div className="bd-comment-body">
                            {/* 댓글 목록 */}
                            <div>
                                {comments.length === 0 ? (
                                    <div className="bd-hint">댓글이 없습니다.</div>
                                ) : (
                                    <div style={{ display: "grid", gap: 10 }}>
                                        {parentComments.map((c) => {
                                            let isDeleted = !!c.deletedAt;

                                            return (
                                                <div key={c.commentId} style={{ display: "grid", gap: 8 }}>
                                                    {/* 부모 댓글 */}
                                                    <div className="bd-card bd-comment-card" style={{ padding: 12 }}>
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

                                                        {!isDeleted && (
                                                            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                                                <button
                                                                    type="button"
                                                                    className="bd-btn-ghost"
                                                                    onClick={() => {
                                                                        if (replyTo === c.commentId) {
                                                                            setReplyTo(null);
                                                                            setReplyText("");
                                                                        } else {
                                                                            setReplyTo(c.commentId);
                                                                            setReplyText("");
                                                                        }
                                                                    }}
                                                                >
                                                                    답글
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="bd-btn-ghost"
                                                                    onClick={() => onDeleteComment(c.commentId)}
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        )}

                                                        {!isDeleted && replyTo === c.commentId && (
                                                            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                                                                <textarea
                                                                    className="bd-input bd-reply-textarea"
                                                                    rows={2}
                                                                    placeholder="답글을 입력하세요."
                                                                    value={replyText}
                                                                    onChange={(e) => setReplyText(e.target.value)}
                                                                    disabled={commentSubmitting}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <button
                                                                    className="bd-btn"
                                                                    type="button"
                                                                    disabled={commentSubmitting || !replyText.trim()}
                                                                    onClick={() => onCreateReply(c.commentId)}
                                                                >
                                                                    등록
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 대댓글 */}
                                                    {(repliesByParent[c.commentId] || []).map((r) => (
                                                        <div
                                                            key={r.commentId}
                                                            className="bd-card bd-comment-card"
                                                            style={{ padding: 12, marginLeft: 24 }}
                                                        >
                                                            <div className="bd-comment-meta">
                                                                <span className="bd-comment-author">
                                                                    작성자: {r.nickname}
                                                                </span>
                                                                <span className="bd-comment-date">
                                                                    {formatKst(r.createdAt)}
                                                                </span>
                                                            </div>

                                                            <div style={{ whiteSpace: "pre-wrap" }}>
                                                                {r.content}
                                                            </div>

                                                            {!r.deletedAt && (
                                                                <button
                                                                    type="button"
                                                                    className="bd-btn-ghost"
                                                                    onClick={() => onDeleteComment(r.commentId)}
                                                                >
                                                                    삭제
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BoardDetail;
