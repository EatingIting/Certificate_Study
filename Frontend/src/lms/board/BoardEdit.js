import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./BoardCommon.css";
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

    // 첨부(기존 + 새로 추가)
    let fileInputRef = useRef(null);

    let [serverAttachments, setServerAttachments] = useState([]); // 서버에 이미 있는 첨부들
    let [newFiles, setNewFiles] = useState([]); // 새로 추가할 파일들

    let maxFiles = 5;
    let maxEachBytes = 10 * 1024 * 1024;

    let formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        let kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        let mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    let onPickFiles = (e) => {
        let picked = Array.from(e.target.files || []);
        if (picked.length === 0) return;

        // 서버첨부 + 새파일 총합이 maxFiles 넘지 않게
        let canAdd = Math.max(0, maxFiles - (serverAttachments.length + newFiles.length));
        let sliced = picked.slice(0, canAdd);

        // 용량 제한
        sliced = sliced.filter((f) => f.size <= maxEachBytes);

        setNewFiles((prev) => [...prev, ...sliced]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    let removeServerAttachmentAt = (idx) => {
        setServerAttachments((prev) => prev.filter((_, i) => i !== idx));
    };

    let removeNewFileAt = (idx) => {
        setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    };

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
                let atts = await BoardApi.listAttachments(postId);
                if (!alive) return;
                setServerAttachments(Array.isArray(atts) ? atts : []);
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

            // 권한 없으면 수정 페이지에서 바로 나가게
            if (e?.status === 403) {
                alert(e?.message || "수정 권한이 없습니다.");
                navigate(`/lms/${subjectId}/board/${postId}`, { replace: true });
                return;
            }

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

            // 1) 글 수정
            await BoardApi.updatePost(postId, {
                category: categoryToCode(category),
                title: title.trim(),
                content: content.trim(),
                isPinned: category === "공지" ? !!isPinned : false,
            });

            // 2) 새 파일 업로드(있으면)
            let uploadedMetas = [];
            if (newFiles.length > 0) {
                uploadedMetas = await BoardApi.uploadFiles({
                    roomId: subjectId, // 너 프로젝트에서 subjectId == roomId
                    postId,
                    files: newFiles,
                });
            }

            // 3) 최종 첨부 리스트 만들기 (기존 남길 것 + 새 업로드)
            let finalReq = [
                ...serverAttachments.map((a) => ({
                    originalName: a.originalName,
                    fileKey: a.fileKey || null,
                    url: a.url,
                    sizeBytes: a.sizeBytes ?? 0,
                    mimeType: a.mimeType || null,
                })),
                ...(Array.isArray(uploadedMetas) ? uploadedMetas : []),
            ];

            // 4) attachments 전체 교체(PUT)
            await BoardApi.replaceAttachments(postId, finalReq);

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

                    {/* 첨부파일 */}
                    <div className="bd-row">
                        <label className="bd-label" htmlFor="be-files">
                            첨부파일
                        </label>

                        <div className="bd-filebar">
                            <input
                                ref={fileInputRef}
                                id="be-files"
                                className="bd-file"
                                type="file"
                                multiple
                                onChange={onPickFiles}
                                disabled={submitting}
                            />
                        </div>

                        {/* 기존(서버) 첨부 */}
                        {serverAttachments.length > 0 ? (
                            <ul className="bd-filelist">
                                {serverAttachments.map((a, idx) => (
                                    <li key={`srv-${a.attachmentId}-${idx}`} className="bd-fileitem">
                                        <a className="bd-filename" href={a.url} target="_blank" rel="noreferrer">
                                            {a.originalName}
                                        </a>
                                        <span className="bd-filesize">{formatBytes(a.sizeBytes || 0)}</span>
                                        <button
                                            type="button"
                                            className="bd-filedel"
                                            onClick={() => removeServerAttachmentAt(idx)}
                                            disabled={submitting}
                                            title="삭제(저장 시 반영)"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="bd-hint">기존 첨부파일이 없습니다.</div>
                        )}

                        {/* 새로 추가한 파일 */}
                        {newFiles.length > 0 && (
                            <>
                                <div className="bd-hint" style={{ marginTop: 8 }}>
                                    새로 추가한 파일
                                </div>
                                <ul className="bd-filelist">
                                    {newFiles.map((f, idx) => (
                                        <li key={`new-${f.name}-${f.size}-${idx}`} className="bd-fileitem">
                                            <span className="bd-filename">{f.name}</span>
                                            <span className="bd-filesize">{formatBytes(f.size)}</span>
                                            <button
                                                type="button"
                                                className="bd-filedel"
                                                onClick={() => removeNewFileAt(idx)}
                                                disabled={submitting}
                                                title="삭제"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        <div className="bd-hint">
                            최대 {maxFiles}개 / 개당 {formatBytes(maxEachBytes)} 이하
                        </div>
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