import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import "./BoardCommon.css";
import "./BoardList.css"
import { BoardApi, formatKst } from "./BoardApi";
import { ReactComponent as ClipIcon } from "./clip.svg";

function Board() {
    let navigate = useNavigate();
    let [sp] = useSearchParams();
    let { subjectId } = useParams();

    let roomId = subjectId;

    // URL: /lms/:subjectId/board?category=공지
    let queryCategory = sp.get("category"); // "공지" | "일반" | "질문" | "자료" | null

    // ===== 카테고리 코드/라벨 매핑 (백엔드는 NOTICE/GENERAL/QNA/RESOURCE) =====
    let categoryToCode = (v) => {
        if (!v) return "";
        if (v === "공지") return "NOTICE";
        if (v === "일반") return "GENERAL";
        if (v === "질문") return "QNA";
        if (v === "자료") return "RESOURCE";
        return v; // 이미 코드값이면 그대로
    };

    let categoryToLabel = (v) => {
        if (!v) return "";
        if (v === "NOTICE") return "공지";
        if (v === "GENERAL") return "일반";
        if (v === "QNA") return "질문";
        if (v === "RESOURCE") return "자료";
        return v; // 이미 라벨이면 그대로
    };

    let [keywordInput, setKeywordInput] = useState("");
    let [keyword, setKeyword] = useState("");

    let [page, setPage] = useState(1);
    let pageSize = 10;
    let groupSize = 10;

    let [loading, setLoading] = useState(false);
    let [error, setError] = useState("");
    let [forbidden, setForbidden] = useState(false);

    let [pinnedPosts, setPinnedPosts] = useState([]);
    let [listPosts, setListPosts] = useState([]);
    let [totalPages, setTotalPages] = useState(1);

    // 검색 실행(버튼/엔터로만 호출)
    let runSearch = () => {
        setKeyword(keywordInput);
        setPage(1);
    }

    // 카테고리 바뀌면 1페이지로
    useEffect(() => {
        setPage(1);
    }, [queryCategory]);

    let normalizedKeyword = keyword.trim();

    // 고정글: category 무시 + 검색만 적용
    useEffect(() => {
        if (!roomId) return;

        let alive = true;

        (async () => {
            try {
                let data = await BoardApi.listPosts({
                    roomId,
                    category: "", // 카테고리 무시
                    keyword: normalizedKeyword,
                    page: 1,
                    size: 50,
                });

                if (!alive) return;

                let items = (data.items || [])
                    .filter((p) => !!p.isPinned)
                    .sort((a, b) => (b.postId || 0) - (a.postId || 0))
                    .map((p) => ({
                        ...p,
                        pinned: !!p.isPinned,
                        authorName: p.nickname,
                        createdAtText: formatKst(p.createdAt),
                    }));

                setPinnedPosts(items);
            } catch {
                if (!alive) return;
                setPinnedPosts([]);
            }
        })();

        return () => {
            alive = false;
        };
    }, [roomId, normalizedKeyword]);

    // 일반 목록: category + keyword + paging
    useEffect(() => {
        if (!roomId) {
            setError("roomId(subjectId)가 없습니다. 라우트를 확인해주세요.");
            return;
        }

        let alive = true;

        (async () => {
            try {
                setLoading(true);
                setError("");
                setForbidden(false);

                let data = await BoardApi.listPosts({
                    roomId,
                    category: categoryToCode(queryCategory),
                    keyword: normalizedKeyword,
                    page,
                    size: pageSize,
                });

                if (!alive) return;

                let items = (data.items || [])
                    .slice()
                    .sort((a, b) => {
                        // createdAt이 있으면 createdAt 기준(내림차순: 최신 먼저)
                        let ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        let tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        if (tb !== ta) return tb - ta;

                        // createdAt이 같거나 없으면 postId 기준(내림차순)
                        return (b.postId || 0) - (a.postId || 0);
                    })
                    .map((p) => ({
                        ...p,
                        pinned: !!p.isPinned,
                        authorName: p.nickname,
                        createdAtText: formatKst(p.createdAt),
                    }));

                setListPosts(items);
                setTotalPages(Math.max(1, Number(data.totalPages || 1)));
            } catch (e) {
                if (!alive) return;
                let status = e?.status ?? e?.response?.status;
                let msg = e?.message ?? e?.response?.data?.message;

                setForbidden(status === 403);
                setError(msg || "목록 조회 중 오류");
                setListPosts([]);
                setTotalPages(1);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [roomId, queryCategory, normalizedKeyword, page]);

    // navigate: 상대경로
    let goWrite = () => navigate("write");
    let goDetail = (postId) => navigate(String(postId));

    // page 범위 보정
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        if (page < 1) setPage(1);
    }, [page, totalPages]);

    // 그룹 페이징
    let group = Math.ceil(page / groupSize);
    let groupStart = (group - 1) * groupSize + 1;
    let groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

    let pageNumbers = useMemo(() => {
        let arr = [];
        for (let i = groupStart; i <= groupEnd; i++) arr.push(i);
        return arr;
    }, [groupStart, groupEnd]);

    let goFirstGroup = () => setPage(1);
    let goPrevGroup = () => {
        if (group <= 1) return;
        let prevGroupStart = (group - 2) * groupSize + 1;
        setPage(prevGroupStart);
    };
    let goNextGroup = () => {
        let maxGroup = Math.ceil(totalPages / groupSize);
        if (group >= maxGroup) return;
        let nextGroupStart = group * groupSize + 1;
        setPage(nextGroupStart);
    };
    let goLastGroup = () => {
        let maxGroup = Math.ceil(totalPages / groupSize);
        let lastGroupStart = (maxGroup - 1) * groupSize + 1;
        setPage(lastGroupStart);
    };

    let chipClass = (category) => {
        if (category === "공지") return "bd-chip notice";
        if (category === "일반") return "bd-chip general";
        if (category === "질문") return "bd-chip qna";
        if (category === "자료") return "bd-chip resource";
        return "bd-chip";
    };

    let titleSuffix = queryCategory ? ` · ${queryCategory}` : "";

    if (forbidden) {
        return (
            <div className="bd bd-board">
                <div className="bd-card">
                    <div className="bd-sub" style={{ fontWeight: 700, marginBottom: 6 }}>
                        접근할 수 없습니다
                    </div>
                    <div className="bd-sub">{error || "스터디원만 접근 가능합니다."}</div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <button
                            type="button"
                            className="bd-btn-ghost"
                            onClick={() => navigate(`/lms/${subjectId}`)}
                        >
                            스터디로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bd bd-board">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시판{titleSuffix}</h2>
                    <p className="bd-sub">고정글은 상단에 표시됩니다.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn" onClick={goWrite}>
                        글쓰기
                    </button>
                </div>
            </div>

            <div className="bd-card">
                {loading && <div className="bd-sub">불러오는 중...</div>}
                {error && <div className="bd-sub">{error}</div>}

                {!loading && !error && (
                    <div className="bd-list">
                        {/* 테이블 헤더 */}
                        <div className="bd-row bd-row-head" role="row">
                            <div className="bd-col category">카테고리</div>
                            <div className="bd-col title">제목</div>
                            <div className="bd-col author">작성자</div>
                            <div className="bd-col views">조회수</div>
                            <div className="bd-col date">작성일</div>
                        </div>

                        {/* 고정글 */}
                        {pinnedPosts.length > 0 &&
                            pinnedPosts.map((p) => (
                                <div
                                    key={`pin-${p.postId}`}
                                    className="bd-row bd-row-item pinned-top"
                                    onClick={() => goDetail(p.postId)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") goDetail(p.postId);
                                    }}
                                >
                                    <div className="bd-col category">
                                        <span className={chipClass(p.category)}>{categoryToLabel(p.category)}</span>
                                    </div>

                                    <div className="bd-col title">
                                        <span className="bd-pin">📌</span> {p.title}

                                        {(p.attachmentCount ?? 0) > 0 && (
                                            <span className="bd-attach-icon" aria-label="첨부파일 있음" title="첨부파일 있음">
                                                <ClipIcon />
                                            </span>
                                        )}

                                        {(p.commentCount ?? 0) > 0 && (
                                            <span className="bd-comment-count">[{p.commentCount}]</span>
                                        )}
                                    </div>

                                    <div className="bd-col author">{p.authorName}</div>
                                    <div className="bd-col views">{p.viewCount ?? 0}</div>
                                    <div className="bd-col date">{p.createdAtText}</div>
                                </div>
                            ))}

                        {/* 일반글 */}
                        {listPosts.length === 0 ? (
                            <div className="bd-sub">게시글이 없습니다.</div>
                        ) : (
                            listPosts.map((p) => (
                                <div
                                    key={p.postId}
                                    className="bd-row bd-row-item"
                                    onClick={() => goDetail(p.postId)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") goDetail(p.postId);
                                    }}
                                >
                                    <div className="bd-col category">
                                        <span className={chipClass(p.category)}>{categoryToLabel(p.category)}</span>
                                    </div>

                                    <div className="bd-col title">
                                        {p.title}
                                        {(p.attachmentCount ?? 0) > 0 && (
                                            <span className="bd-attach-icon" aria-label="첨부파일 있음" title="첨부파일 없음">
                                                <ClipIcon />
                                            </span>
                                        )}
                                        {(p.commentCount ?? 0) > 0 && (
                                            <span className="bd-comment-count">[{p.commentCount}]</span>
                                        )}
                                    </div>

                                    <div className="bd-col author">{p.authorName}</div>
                                    <div className="bd-col views">{p.viewCount ?? 0}</div>
                                    <div className="bd-col date">{p.createdAtText}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="bd-card bd-bottom-search">
                <div className="bd-toolbar">
                    <input
                        className="bd-search"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        placeholder="검색 (제목/내용)"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                runSearch();
                            }
                        }}
                    />

                    {/* 검색 버튼 */}
                    <button className="bd-btn" type="button" onClick={runSearch}>
                        검색
                    </button>

                    <button 
                        className="bd-btn-ghost" 
                        type="button"
                        onClick={() => {
                            setKeywordInput("");
                            setKeyword("");
                            setPage(1);
                        }} 
                        disabled={!keywordInput.trim() && !keyword.trim()}
                    >
                        초기화
                    </button>
                </div>
            </div>

            <div className="bd-pagination">
                <button className="bd-page-btn" onClick={goFirstGroup} disabled={group === 1}>
                    {"<<"}
                </button>

                <button className="bd-page-btn" onClick={goPrevGroup} disabled={group === 1}>
                    {"<"}
                </button>

                {pageNumbers.map((p) => (
                    <button key={p} className={`bd-page-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>
                        {p}
                    </button>
                ))}

                <button className="bd-page-btn" onClick={goNextGroup} disabled={group === Math.ceil(totalPages / groupSize)}>
                    {">"}
                </button>

                <button className="bd-page-btn" onClick={goLastGroup} disabled={group === Math.ceil(totalPages / groupSize)}>
                    {">>"}
                </button>
            </div>
        </div>
    );
}

export default Board;
