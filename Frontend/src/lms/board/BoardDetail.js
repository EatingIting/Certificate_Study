import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./BoardDetail.css";

function BoardDetail() {
    let { studyId, postId } = useParams(); // ✅ /lms/:studyId/:postId

    // ===== 게시글(더미) =====
    let posts = useMemo(
        () => [
            {
                id: 100,
                pinned: true,
                type: "일반",
                title: "📌 필독: 게시판 이용 규칙",
                date: "2026-01-19",
                author: "운영자",
                content: "게시판 이용 규칙 내용입니다.\n\n- 욕설 금지\n- 광고 금지\n- 질문은 질문 탭",
            },
            {
                id: 1,
                pinned: false,
                type: "공지",
                title: "이번 주 일정 공지(월요일 시작)",
                date: "2026-01-19",
                author: "운영자",
                content: "이번 주 일정 공지입니다.\n\n- 월: OT\n- 수: 문제풀이\n- 금: 모의고사",
            },
            {
                id: 3,
                pinned: false,
                type: "일반",
                title: "오늘 발표 순서 확인 부탁",
                date: "2026-01-19",
                author: "홍길동",
                content: "오늘 발표 순서가 어떻게 되나요?",
            },
        ],
        []
    );

    let idNum = Number(postId);
    let post = posts.find((p) => p.id === idNum);

    let tagLabel = "일반";
    if (post) {
        if (post.pinned) tagLabel = "고정";
        else if (post.type === "공지") tagLabel = "공지";
        else tagLabel = post.type;
    }

    let tagVariant = (label) => {
        if (label === "고정") return "tag-pin";
        if (label === "공지") return "tag-notice";
        if (label === "질문") return "tag-q";
        if (label === "과제") return "tag-task";
        if (label === "자료") return "tag-doc";
        return "tag-normal";
    };

    // ===== 댓글/대댓글 =====
    let MAX_LEN = 300;
    let clamp = (value = "") => value.slice(0, MAX_LEN);

    // TODO: 로그인 붙이면 실제 닉네임으로 교체
    let currentUserName = "홍길동";
    let isMine = (author) => author === currentUserName;

    let initialComments = useMemo(
        () => [
            {
                id: 1,
                author: "김철수",
                date: "2026-01-19 09:20",
                content: "확인했습니다!",
                replies: [{ id: 11, author: "홍길동", date: "2026-01-19 09:24", content: "감사합니다!" }],
            },
            {
                id: 2,
                author: "박영희",
                date: "2026-01-19 09:28",
                content: "발표 순서 공유해주시면 좋을 것 같아요.",
                replies: [],
            },
        ],
        []
    );

    let [comments, setComments] = useState(initialComments);

    let [commentText, setCommentText] = useState("");
    let [replyOpenId, setReplyOpenId] = useState(null);
    let [replyText, setReplyText] = useState("");

    let [editingCommentId, setEditingCommentId] = useState(null);
    let [editingCommentText, setEditingCommentText] = useState("");

    let [editingReply, setEditingReply] = useState(null); // { parentId, replyId } | null
    let [editingReplyText, setEditingReplyText] = useState("");

    let commentLen = commentText.length;
    let replyLen = replyText.length;

    let isCommentValid = commentText.trim().length > 0;
    let isReplyValid = replyText.trim().length > 0;

    let totalCommentCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    let addComment = () => {
        let text = commentText.trim();
        if (!text) return;

        let newItem = {
            id: Date.now(),
            author: currentUserName,
            date: "방금",
            content: text,
            replies: [],
        };

        setComments((prev) => [newItem, ...prev]);
        setCommentText("");
    };

    let openReply = (parentId) => {
        setReplyOpenId(parentId);
        setReplyText("");
    };

    let addReply = (parentId) => {
        let text = replyText.trim();
        if (!text) return;

        let newReply = { id: Date.now(), author: currentUserName, date: "방금", content: text };

        setComments((prev) =>
            prev.map((c) => (c.id !== parentId ? c : { ...c, replies: [...c.replies, newReply] }))
        );

        setReplyText("");
        setReplyOpenId(null);
    };

    let startEditComment = (comment) => {
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.content);
    };

    let saveEditComment = (commentId) => {
        let text = editingCommentText.trim();
        if (!text) return;

        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: text } : c)));
        setEditingCommentId(null);
        setEditingCommentText("");
    };

    let cancelEditComment = () => {
        setEditingCommentId(null);
        setEditingCommentText("");
    };

    let deleteComment = (commentId) => {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    let startEditReply = (parentId, reply) => {
        setEditingReply({ parentId, replyId: reply.id });
        setEditingReplyText(reply.content);
    };

    let saveEditReply = () => {
        if (!editingReply) return;

        let text = editingReplyText.trim();
        if (!text) return;

        let parentId = editingReply.parentId;
        let replyId = editingReply.replyId;

        setComments((prev) =>
            prev.map((c) => {
                if (c.id !== parentId) return c;
                return { ...c, replies: c.replies.map((r) => (r.id === replyId ? { ...r, content: text } : r)) };
            })
        );

        setEditingReply(null);
        setEditingReplyText("");
    };

    let cancelEditReply = () => {
        setEditingReply(null);
        setEditingReplyText("");
    };

    let deleteReply = (parentId, replyId) => {
        setComments((prev) =>
            prev.map((c) => (c.id !== parentId ? c : { ...c, replies: c.replies.filter((r) => r.id !== replyId) }))
        );
    };

    let onCommentKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addComment();
        }
    };

    let onReplyKeyDown = (parentId) => (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            addReply(parentId);
        }
    };

    // ✅ 목록으로 링크: 프로젝트에서 “목록 URL”이 뭐냐에 따라 둘 중 하나로 선택
    // 1) 목록이 /lms/:studyId/board 라면:
    let listUrl = `/lms/${studyId}/board`;
    // 2) 목록이 /lms/:studyId 라면 위 라인을 아래로 바꾸면 됨:
    // let listUrl = `/lms/${studyId}`;

    if (!post) {
        return (
            <div className="board-detail">
                <div className="bd-head">
                    <div>
                        <h2 className="bd-title">게시글</h2>
                        <p className="bd-sub">존재하지 않는 게시글입니다.</p>
                    </div>

                    <Link className="bd-back" to={listUrl}>
                        목록으로
                    </Link>
                </div>

                <div className="bd-card">
                    <div className="bd-empty">게시글을 찾을 수 없어요.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="board-detail">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시글</h2>
                    <p className="bd-sub">게시글 내용을 확인하세요.</p>
                </div>

                <Link className="bd-back" to={listUrl}>
                    목록으로
                </Link>
            </div>

            {/* 본문 */}
            <div className="bd-card">
                <div className="bd-post-top">
                    <span className={`bd-tag ${tagVariant(tagLabel)}`}>{tagLabel}</span>
                    <div className="bd-post-title">{post.title}</div>
                </div>

                <div className="bd-post-meta">
                    {post.author} · {post.date}
                </div>

                <div className="bd-post-content">{post.content}</div>
            </div>

            {/* 댓글 */}
            <div className="bd-card">
                <div className="bd-comment-head">
                    <span className="bd-comment-title">댓글</span>
                    <span className="bd-comment-count">{totalCommentCount}개</span>
                </div>

                {/* 댓글 작성 */}
                <div className="bd-composer">
          <textarea
              value={commentText}
              onChange={(e) => setCommentText(clamp(e.target.value))}
              onKeyDown={onCommentKeyDown}
              placeholder="댓글을 입력하세요 (Enter 등록 / Shift+Enter 줄바꿈)"
              rows={3}
              className="bd-textarea"
          />

                    <div className="bd-composer-footer">
                        <div className="bd-counter">
                            {commentLen}/{MAX_LEN}
                        </div>

                        <button className="bd-btn" type="button" onClick={addComment} disabled={!isCommentValid}>
                            등록
                        </button>
                    </div>
                </div>

                {/* 댓글 목록 */}
                <div className="bd-list">
                    {comments.map((c) => (
                        <div key={c.id} className="bd-item">
                            <div className="bd-meta">
                                <span className="bd-author">{c.author}</span>
                                <span className="bd-dot">·</span>
                                <span className="bd-date">{c.date}</span>

                                <div className="bd-actions">
                                    <button className="bd-action" type="button" onClick={() => openReply(c.id)}>
                                        답글
                                    </button>

                                    {isMine(c.author) && (
                                        <>
                                            <button className="bd-action" type="button" onClick={() => startEditComment(c)}>
                                                수정
                                            </button>
                                            <button className="bd-action" type="button" onClick={() => deleteComment(c.id)}>
                                                삭제
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {editingCommentId === c.id ? (
                                <div className="bd-edit">
                  <textarea
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(clamp(e.target.value))}
                      rows={3}
                      className="bd-textarea"
                      placeholder="수정 내용을 입력하세요"
                  />

                                    <div className="bd-edit-footer">
                                        <div className="bd-counter">
                                            {editingCommentText.length}/{MAX_LEN}
                                        </div>

                                        <div className="bd-edit-actions">
                                            <button className="bd-btn-ghost" type="button" onClick={cancelEditComment}>
                                                취소
                                            </button>
                                            <button
                                                className="bd-btn"
                                                type="button"
                                                onClick={() => saveEditComment(c.id)}
                                                disabled={editingCommentText.trim().length === 0}
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bd-body">{c.content}</div>
                            )}

                            {/* 대댓글 */}
                            {c.replies?.length > 0 && (
                                <div className="bd-replies">
                                    {c.replies.map((r) => {
                                        let isEditingThis =
                                            editingReply && editingReply.parentId === c.id && editingReply.replyId === r.id;

                                        return (
                                            <div key={r.id} className="bd-reply">
                                                <div className="bd-meta">
                                                    <span className="bd-author">{r.author}</span>
                                                    <span className="bd-dot">·</span>
                                                    <span className="bd-date">{r.date}</span>

                                                    <div className="bd-actions">
                                                        {isMine(r.author) && (
                                                            <>
                                                                <button className="bd-action" type="button" onClick={() => startEditReply(c.id, r)}>
                                                                    수정
                                                                </button>
                                                                <button className="bd-action" type="button" onClick={() => deleteReply(c.id, r.id)}>
                                                                    삭제
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {isEditingThis ? (
                                                    <div className="bd-edit">
                            <textarea
                                value={editingReplyText}
                                onChange={(e) => setEditingReplyText(clamp(e.target.value))}
                                rows={3}
                                className="bd-textarea"
                                placeholder="수정 내용을 입력하세요"
                            />

                                                        <div className="bd-edit-footer">
                                                            <div className="bd-counter">
                                                                {editingReplyText.length}/{MAX_LEN}
                                                            </div>

                                                            <div className="bd-edit-actions">
                                                                <button className="bd-btn-ghost" type="button" onClick={cancelEditReply}>
                                                                    취소
                                                                </button>
                                                                <button
                                                                    className="bd-btn"
                                                                    type="button"
                                                                    onClick={saveEditReply}
                                                                    disabled={editingReplyText.trim().length === 0}
                                                                >
                                                                    저장
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bd-body">{r.content}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 답글 작성 */}
                            {replyOpenId === c.id && (
                                <div className="bd-composer bd-composer-reply">
                  <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(clamp(e.target.value))}
                      onKeyDown={onReplyKeyDown(c.id)}
                      placeholder="답글을 입력하세요 (Enter 등록 / Shift+Enter 줄바꿈)"
                      rows={2}
                      className="bd-textarea"
                  />

                                    <div className="bd-composer-footer">
                                        <button className="bd-btn-ghost" type="button" onClick={() => setReplyOpenId(null)}>
                                            닫기
                                        </button>

                                        <div className="bd-right">
                                            <div className="bd-counter">
                                                {replyLen}/{MAX_LEN}
                                            </div>
                                            <button className="bd-btn" type="button" onClick={() => addReply(c.id)} disabled={!isReplyValid}>
                                                등록
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default BoardDetail;