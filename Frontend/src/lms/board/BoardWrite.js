import React, { useState } from "react";
import "./Board.css";

function BoardWrite(props) {
    let onBack = props.onBack;
    let onSubmit = props.onSubmit;

    let [category, setCategory] = useState("일반");
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");

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

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">글쓰기</h2>
                    <p className="bd-sub">카테고리/제목/내용을 입력해 게시글을 작성하세요.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn-ghost" onClick={onBack}>
                        목록
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <form className="bd-form" onSubmit={submit}>
                    <div className="bd-row">
                        <label className="bd-label" htmlFor="bw-category">
                            카테고리
                        </label>
                        <select
                            id="bw-category"
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
                        <label className="bd-label" htmlFor="bw-title">
                            제목
                        </label>
                        <input
                            id="bw-title"
                            className="bd-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목을 입력하세요"
                            maxLength={60}
                        />
                        <div className="bd-hint">{title.length}/60</div>
                    </div>

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="bw-content">
                            내용
                        </label>
                        <textarea
                            id="bw-content"
                            className="bd-textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용을 입력하세요"
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
                            등록
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BoardWrite;
