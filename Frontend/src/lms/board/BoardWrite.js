import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Board.css";

function BoardWrite() {
    let navigate = useNavigate();
    let [sp] = useSearchParams();

    // 목록에서 넘어온 카테고리 쿼리(?)가 있으면 기본값으로 사용
    let queryCategory = sp.get("category"); // "공지" | "일반" | "질문" | "자료" | null

    let allowedCategories = useMemo(() => {
        return ["공지", "일반", "질문", "자료"];
    }, []);

    let initialCategory = useMemo(() => {
        if (queryCategory && allowedCategories.includes(queryCategory)) return queryCategory;
        return "일반";
    }, [queryCategory, allowedCategories]);

    let [category, setCategory] = useState(initialCategory);
    let [title, setTitle] = useState("");
    let [content, setContent] = useState("");

    // 첨부파일
    let fileInputRef = useRef(null);
    let [files, setFiles] = useState([]); // File[]

    // queryCategory가 바뀌면(직접 URL 바꾸거나) category도 동기화
    useEffect(() => {
        setCategory(initialCategory);
    }, [initialCategory]);

    let titleMax = 200; // DB가 VARCHAR(200)였으니 프론트도 맞춤
    let contentMax = 5000;
    let maxFiles = 5;
    let maxEachBytes = 10 * 1024 * 1024; // 10MB

    let isValid = title.trim().length > 0 && content.trim().length > 0;

    let onPickFiles = (e) => {
        let picked = Array.from(e.target.files || []);
        if (picked.length === 0) return;

        // 개수 제한
        let next = [...files, ...picked];
        if (next.length > maxFiles) {
            next = next.slice(0, maxFiles);
        }

        // 용량 제한(초과 파일은 제외)
        next = next.filter((f) => f.size <= maxEachBytes);

        setFiles(next);

        // 같은 파일 다시 선택 가능하도록 input value 초기화
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    let removeFileAt = (idx) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    let clearFiles = () => {
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    let goList = () => {
        // board/write 의 상위가 board 라우트이므로 .. 로 가면 /lms/:subjectId/board
        navigate("..");
    };

    let formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        let kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        let mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    let submit = async (e) => {
        e.preventDefault();
        if (!isValid) return;

        // ✅ 백엔드 연동 전: 여기 payload 형태만 먼저 잡아둠
        // 나중에 MyBatis + 컨트롤러에서 multipart/form-data로 받으면 됨.
        let payload = {
            category: category,
            title: title.trim(),
            content: content.trim(),
            files: files, // File[]
        };

        console.log("[BoardWrite submit payload]", payload);

        // TODO(백엔드 붙일 때):
        // let form = new FormData();
        // form.append("category", category);
        // form.append("title", title.trim());
        // form.append("content", content.trim());
        // files.forEach((f) => form.append("files", f));
        // await axios.post(`/api/rooms/${roomId}/board/posts`, form, {
        //   headers: { "Content-Type": "multipart/form-data" },
        // });

        // 일단은 “등록된 것처럼” 목록으로 이동
        goList();
    };

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">글쓰기</h2>
                    <p className="bd-sub">카테고리/제목/내용/첨부파일을 입력해 게시글을 작성하세요.</p>
                </div>

                <div className="bd-actions">
                    <button type="button" className="bd-btn-ghost" onClick={goList}>
                        목록
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <form className="bd-form" onSubmit={submit}>
                    {/* 카테고리 */}
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
                        {queryCategory && (
                            <div className="bd-hint">
                                현재 목록 카테고리: <b>{queryCategory}</b> (기본값으로 반영됨)
                            </div>
                        )}
                    </div>

                    {/* 제목 */}
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
                        />
                        <div className="bd-hint">
                            {title.length}/{titleMax}
                        </div>
                    </div>

                    {/* 내용 */}
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
                        />
                        <div className="bd-hint">
                            {content.length}/{contentMax}
                        </div>
                    </div>

                    {/* 첨부파일 */}
                    <div className="bd-row">
                        <label className="bd-label" htmlFor="bw-files">
                            첨부파일 (최대 {maxFiles}개, 파일당 10MB 이하)
                        </label>

                        <div className="bd-filebar">
                            <input
                                ref={fileInputRef}
                                id="bw-files"
                                className="bd-file"
                                type="file"
                                multiple
                                onChange={onPickFiles}
                            />

                            <button
                                type="button"
                                className="bd-btn-ghost"
                                onClick={clearFiles}
                                disabled={files.length === 0}
                            >
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
                            * 10MB 초과 파일은 자동으로 제외됩니다. * 최대 개수 초과 시 앞에서부터 {maxFiles}개만
                            유지됩니다.
                        </div>
                    </div>

                    <div className="bd-actions" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="bd-btn-ghost" onClick={goList}>
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