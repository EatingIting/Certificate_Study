import React, { useEffect, useState } from "react";
import "./Board.css";

function BoardEdit(props) {
    let post = props.post;
    let onBack = props.onBack;
    let onSubmit = props.onSubmit;

    let [category, setCategory] = useState("일반");
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");

    useEffect(() => {
        if (!post) return;
        setCategory(post.category || "일반");
        setTitle(post.title || "");
        setContent(post.content || "");
    }, [post]);

    let isValid = title.trim().length > 0 && content.trim().length > 0;

    let submit = (e) => {
        e.preventDefault();
        if (!isValid) return;

        onSubmit({
            category: category,
            title: title.trim(),
            content: content.trim(),
        });
    };

    if (!post) {
        return (
            <div className="bd">
                <div className="bd-head">
                    <div>
                        <h2 className="bd-title">글 수정</h2>
                        <p className="bd-sub">수정할 글을 찾을 수 없습니다.</p>
                    </div>

                    <div className="bd-actions">
                        <button className="bd-btn-ghost" onClick={onBack}>
                            뒤로
                        </button>
                    </div>
                </div>

                <div className="bd-card">
                    <div className="bd-sub">삭제되었거나 존재하지 않는 글입니다.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">글 수정</h2>
                    <p className="bd-sub">카테고리/제목/내용을 수정할 수 있어요.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn-ghost" onClick={onBack}>
                        취소
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <form className="bd-form" onSubmit={submit}>
                    <div className="bd-row">
                        <label className="bd-label" htmlFor="be-category">
                            카테고리
                        </label>
                        <select
                            id="be-category"
                            className="bd-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option value="공지">공지</option>
                            <option value="일반">일반</option>
                            <option value="질문">질문</option>
                            <option value="자료">자료</option>
                        </select>
                    </div>

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="be-title">
                            제목
                        </label>
                        <input
                            id="be-title"
                            className="bd-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목"
                            maxLength={60}
                        />
                        <div className="bd-hint">{title.length}/60</div>
                    </div>

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="be-content">
                            내용
                        </label>
                        <textarea
                            id="be-content"
                            className="bd-textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용"
                            rows={10}
                            maxLength={2000}
                        />
                        <div className="bd-hint">{content.length}/2000</div>
                    </div>

                    <div className="bd-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="bd-btn-ghost" onClick={onBack}>
                            취소
                        </button>
                        <button type="submit" className="bd-btn" disabled={!isValid}>
                            저장
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BoardEdit;
