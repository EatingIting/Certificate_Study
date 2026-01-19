import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import "./BoardWrite.css";

function BoardWrite() {
    let navigate = useNavigate();
    let { studyId } = useParams();

    let [category, setCategory] = useState("일반");
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");

    let listUrl = `/lms/${studyId}/board`;

    let isValid = title.trim().length > 0 && content.trim().length > 0;

    let onSubmit = (e) => {
        e.preventDefault();

        if (!isValid) return;

        // ✅ 지금은 백엔드 미연결: 더미 성공 처리
        // TODO: 나중에 axios.post로 교체
        alert("등록(더미) 완료! (현재는 백엔드 미연결)");

        navigate(listUrl);
    };

    let onCancel = () => {
        navigate(listUrl);
    };

    let preventEnterSubmit = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            // textarea 제외하고 Enter로 폼 submit 되는 걸 방지
            if (e.target.tagName !== "TEXTAREA") {
                e.preventDefault();
            }
        }
    };

    return (
        <div className="board-write" onKeyDown={preventEnterSubmit}>
            <div className="bw-head">
                <div>
                    <h2 className="bw-title">글쓰기</h2>
                    <p className="bw-sub">카테고리/제목/내용을 입력해 주세요.</p>
                </div>

                <Link className="bw-back" to={listUrl}>
                    목록으로
                </Link>
            </div>

            <form className="bw-card" onSubmit={onSubmit}>
                <div className="bw-row">
                    <label className="bw-label" htmlFor="category">
                        카테고리
                    </label>

                    <select
                        id="category"
                        className="bw-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="공지">공지</option>
                        <option value="일반">일반</option>
                        <option value="질문">질문</option>
                        <option value="자료">자료</option>
                        <option value="과제">과제</option>
                    </select>
                </div>

                <div className="bw-row">
                    <label className="bw-label" htmlFor="title">
                        제목
                    </label>

                    <input
                        id="title"
                        className="bw-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목을 입력하세요"
                        maxLength={60}
                    />
                    <div className="bw-hint">{title.length}/60</div>
                </div>

                <div className="bw-row">
                    <label className="bw-label" htmlFor="content">
                        내용
                    </label>

                    <textarea
                        id="content"
                        className="bw-textarea"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="내용을 입력하세요"
                        rows={10}
                        maxLength={2000}
                    />
                    <div className="bw-hint">{content.length}/2000</div>
                </div>

                <div className="bw-actions">
                    <button type="button" className="bw-btn-ghost" onClick={onCancel}>
                        취소
                    </button>

                    <button type="submit" className="bw-btn" disabled={!isValid}>
                        등록
                    </button>
                </div>
            </form>
        </div>
    );
}

export default BoardWrite;
