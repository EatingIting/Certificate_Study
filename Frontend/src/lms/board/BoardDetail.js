import React from "react";
import "./Board.css";

function BoardDetail(props) {
    let post = props.post;
    let onBack = props.onBack;
    let onEdit = props.onEdit;
    let onDelete = props.onDelete;

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

    let isNotice = post.category === "공지" || post.pinned;

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
                    <button
                        className="bd-btn-ghost"
                        onClick={() => {
                            let ok = window.confirm("정말 삭제할까요?");
                            if (ok) onDelete();
                        }}
                    >
                        삭제
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-chip notice">{isNotice ? "공지" : post.category}</div>

                <h3 className="bd-detail-title" style={{ marginTop: 10 }}>
                    {post.title}
                </h3>

                <div className="bd-detail-meta">
                    <span>작성자: {post.authorName}</span>
                    <span>작성일: {post.createdAt}</span>
                    <span>글 번호: {post.postId}</span>
                </div>

                <div className="bd-detail-body">{post.content}</div>
            </div>
        </div>
    );
}

export default BoardDetail;
