import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import "./Board.css";
import { BoardApi } from "./BoardApi";

function BoardWrite() {
    let navigate = useNavigate();
    let [sp] = useSearchParams();
    let { subjectId } = useParams();
    let roomId = subjectId;

    let queryCategory = sp.get("category"); // "공지" | "일반" | "질문" | "자료" | null

    let allowedCategories = useMemo(() => ["공지", "일반", "질문", "자료"], []);

    let initialCategory = useMemo(() => {
        if (queryCategory && allowedCategories.includes(queryCategory)) return queryCategory;
        return "일반";
    }, [queryCategory, allowedCategories]);

    let [category, setCategory] = useState(initialCategory);
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");
    let [submitting, setSubmitting] = useState(false);
    let [error, setError] = useState("");

    // 공지일 때만 고정 여부 선택
    let [isPinned, setIsPinned] = useState(false);

    // 첨부파일 UI는 유지하되, 현재는 전송하지 않음
    let fileInputRef = useRef(null);
    let [files, setFiles] = useState([]);

    useEffect(() => {
        setCategory(initialCategory === "공지");
    }, [initialCategory]);

    useEffect(() => {
        if (category !== "공지") setIsPinned(false);
    }, [category]);

    let titleMax = 200;
    let contentMax = 5000;
    let maxFiles = 5;
    let maxEachBytes = 10 * 1024 * 1024;

    let isValid = title.trim().length > 0 && content.trim().length > 0;

    let onPickFiles = (e) => {
        let picked = Array.from(e.target.files || []);
        if (picked.length === 0) return;

        let next = [...files, ...picked];
        if (next.length > maxFiles) next = next.slice(0, maxFiles);
        next = next.filter((f) => f.size <= maxEachBytes);

        setFiles(next);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    let removeFileAt = (idx) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    let clearFiles = () => {
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    let goList = () => navigate(`/lms/${subjectId}/board`);

    let formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        let kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        let mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    let categoryToCode = (label) => {
        if (label === "공지") return "NOTICE";
        if (label === "일반") return "GENERAL";
        if (label === "질문") return "QNA";
        if (label === "자료") return "RESOURCE";
        return "GENERAL";
    };

    let submit = async (e) => {
        e.preventDefault();
        if (!isValid || !roomId) return;

        try {
            setSubmitting(true);
            setError("");

            // ✅ 공지일 때만 isPinned를 사용, 그 외는 무조건 false
            let finalPinned = category === "공지" ? !!isPinned : false;

            let res = await BoardApi.createPost({
                roomId,
                category: categoryToCode(category),
                title: title.trim(),
                content: content.trim(),
                isPinned: finalPinned,
            });

            let postId = res?.postId;
            if (!postId) {
                // 서버 응답이 예상과 다를 때
                goList();
                return;
            }

            navigate(`/lms/${subjectId}/board/${postId}`);
        } catch (e2) {
            setError(e2?.message || "작성 실패");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">글쓰기</h2>
                    <p className="bd-sub">카테고리/제목/내용을 입력해 게시글을 작성하세요.</p>
                </div>

                <div className="bd-actions">
                    <button type="button" className="bd-btn-ghost" onClick={goList}>
                        목록
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <form className="bd-form" onSubmit={submit}>
                    {error && <div className="bd-sub">{error}</div>}

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="bw-category">
                            카테고리
                        </label>
                        <select
                            id="bw-category"
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

                        {queryCategory && (
                            <div className="bd-hint">
                                현재 목록 카테고리: <b>{queryCategory}</b> (기본값으로 반영됨)
                            </div>
                        )}
                    </div>

                    {/* ✅ 공지일 때만 고정 체크박스 노출 */}
                    {category === "공지" && (
                        <div className="bd-row">
                            <label className="bd-label" htmlFor="bw-pinned">
                                상단 고정
                            </label>

                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input
                                    id="bw-pinned"
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
                            maxLength={titleMax}
                            disabled={submitting}
                        />
                        <div className="bd-hint">
                            {title.length}/{titleMax}
                        </div>
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
                            maxLength={contentMax}
                            disabled={submitting}
                        />
                        <div className="bd-hint">
                            {content.length}/{contentMax}
                        </div>
                    </div>

                    <div className="bd-row">
                        <label className="bd-label" htmlFor="bw-files">
                            첨부파일 (현재는 저장만 가능 / 업로드 연동은 다음 단계)
                        </label>

                        <div className="bd-filebar">
                            <input
                                ref={fileInputRef}
                                id="bw-files"
                                className="bd-file"
                                type="file"
                                multiple
                                onChange={onPickFiles}
                                disabled={submitting}
                            />

                            <button type="button" className="bd-btn-ghost" onClick={clearFiles} disabled={files.length === 0 || submitting}>
                                첨부 초기화
                            </button>
                        </div>

                        {files.length > 0 ? (
                            <ul className="bd-filelist">
                                {files.map((f, idx) => (
                                    <li key={`${f.name}-${f.size}-${idx}`} className="bd-fileitem">
                                        <span className="bd-filename">{f.name}</span>
                                        <span className="bd-filesize">{formatBytes(f.size)}</span>
                                        <button
                                            type="button"
                                            className="bd-filedel"
                                            onClick={() => removeFileAt(idx)}
                                            aria-label="첨부파일 삭제"
                                            title="삭제"
                                            disabled={submitting}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="bd-hint">첨부파일이 없습니다.</div>
                        )}

                        <div className="bd-hint">
                            * 다음 단계에서 “파일 업로드 API(S3/서버 저장)” 또는 “URL 첨부 메타 저장”으로 맞춰서 연동할 수 있어.
                        </div>
                    </div>

                    <div className="bd-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="bd-btn-ghost" onClick={goList} disabled={submitting}>
                            취소
                        </button>
                        <button type="submit" className="bd-btn" disabled={!isValid || submitting}>
                            {submitting ? "등록 중..." : "등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default BoardWrite;