import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Board.css";
import { BoardApi } from "./BoardApi";

function BoardEdit() {
    let navigate = useNavigate();
    let { subjectId, postId } = useParams();

    let [loading, setLoading] = useState(false);
    let [submitting, setSubmitting] = useState(false);
    let [error, setError] = useState("");

    let [category, setCategory] = useState("일반");
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");
    let [isPinned, setIsPinned] = useState(false);

    let categoryToCode = (v) => {
        if (!v) return "GENERAL";
        if (v === "공지") return "NOTICE";
        if (v === "일반") return "GENERAL";
        if (v === "질문") return "QNA";
        if (v === "자료") return "RESOURCE";
        return v; // 이미 NOTICE/GENERAL/... 코드면 그대로
    };

    let categoryToLabel = (v) => {
        if (!v) return "일반";
        if (v === "NOTICE") return "공지";
        if (v === "GENERAL") return "일반";
        if (v === "QNA") return "질문";
        if (v === "RESOURCE") return "자료";
        return v; // 이미 라벨이면 그대로
    };

    useEffect(() => {
        if (!postId) return;

        let alive = true;

        (async () => {
            try {
                setLoading(true);
                setError("");

                // 수정 화면은 조회수 증가시키면 애매해서 false
                let data = await BoardApi.getDetail(postId, false);
                if (!alive) return;

                let post = data?.post;
                if (!post) {
                    setError("삭제되었거나 존재하지 않는 글입니다.");
                    return;
                }

                setCategory(categoryToLabel(post.category) || "일반");
                setTitle(post.title || "");
                setContent(post.content || "");
                setIsPinned(!!post.isPinned);
            } catch (e) {
                if (!alive) return;
                setError(e?.message || "불러오기 실패");
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
        if (category !== "공지") setIsPinned(false);
    }, [category]);

    let isValid = title.trim().length > 0 && content.trim().length > 0;

    let onBack = () => {
        navigate(`/lms/${subjectId}/board/${postId}`);
    };

    let submit = async (e) => {
        e.preventDefault();
        if (!isValid) return;

        try {
        setSubmitting(true);
            setError("");

            await BoardApi.updatePost(postId, {
                category: categoryToCode(category),
                title: title.trim(),
                content: content.trim(),
                isPinned: category === "공지" ? !!isPinned : false,
            });

            onBack();
        } catch (e2) {
            setError(e2?.message || "저장 실패");
        } finally {
            setSubmitting(false);
        }
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

    if (error && !title && !content) {
        return (
            <div className="bd">
                <div className="bd-head">
                    <div>
                        <h2 className="bd-title">글 수정</h2>
                        <p className="bd-sub">수정할 글을 찾을 수 없습니다.</p>
                    </div>

                    <div className="bd-actions">
                        <button className="bd-btn-ghost" onClick={() => navigate("..")}>
                            뒤로
                        </button>
                    </div>
                </div>

                <div className="bd-card">
                    <div className="bd-sub">{error}</div>
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
                    <button className="bd-btn-ghost" onClick={onBack} disabled={submitting}>
                        취소
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <form className="bd-form" onSubmit={submit}>
                    {error && <div className="bd-sub">{error}</div>}

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="be-category">
                            카테고리
                        </label>
                        <select
                            id="be-category"
                            className="bd-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={submitting}
                        >
                            <option value="공지">공지</option>
                            <option value="일반">일반</option>
                            <option value="질문">질문</option>
                            <option value="자료">자료</option>
                        </select>

                        {category === "공지" && (
                            <div className="bd-row">
                                <label className="bd-label" htmlFor="be-pinned">상단 고정</label>

                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <input
                                        id="be-pinned"
                                        type="checkbox"
                                        checked={isPinned}
                                        onChange={(e) => setIsPinned(e.target.checked)}
                                        disabled={submitting}
                                    />
                                    <span className="bd-hint" style={{ margin: 0 }}>
                                        체크하면 공지 글이 목록 상단에 고정돼요.
                                    </span>
                                </div>
                            </div>
                        )}
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
                            maxLength={200}
                            disabled={submitting}
                        />
                        <div className="bd-hint">{title.length}/200</div>
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
                            maxLength={5000}
                            disabled={submitting}
                        />
                        <div className="bd-hint">{content.length}/5000</div>
                    </div>

                    <div className="bd-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="bd-btn-ghost" onClick={onBack} disabled={submitting}>
                            취소
                        </button>
                        <button type="submit" className="bd-btn" disabled={!isValid || submitting}>
                            {submitting ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BoardEdit;