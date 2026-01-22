import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./Board.css";

function Board() {
    let navigate = useNavigate();
    let { roomId } = useParams();
    let [sp] = useSearchParams();

    // ===== 더미 데이터 =====
    let initialPosts = useMemo(() => {
        return [
            {
                postId: 100,
                category: "공지",
                title: "필독: 게시판 이용 규칙",
                content: "욕설/비방/광고 금지. 서로 존중하기.\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-19 10:00",
                pinned: true,
            },
            {
                postId: 101,
                category: "공지",
                title: "이번 주 시험/접수 일정",
                content: "접수: 1/20\n시험: 2/02\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-19 10:05",
                pinned: true,
            },
            {
                postId: 5,
                category: "자료",
                title: "오늘 발표 자료 공유합니다",
                content: "링크는 나중에 추가할게요.\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-18 16:10",
                pinned: false,
            },
            {
                postId: 4,
                category: "질문",
                title: "SQLD 개정 범위 어디까지인가요?",
                content: "정리해서 공유해주실 분?\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-18 18:40",
                pinned: false,
            },
            {
                postId: 3,
                category: "일반",
                title: "오늘 발표 순서 확인",
                content: "A → B → C 순서로 진행!\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-18 21:20",
                pinned: false,
            },
        ];
    }, []);

    let [posts] = useState(initialPosts);

    // ===== URL query category =====
    let queryCategory = sp.get("category"); // 공지/일반/질문/자료 or null

    // ===== search =====
    let [keyword, setKeyword] = useState("");

    // ===== pagination =====
    let [page, setPage] = useState(1);
    let pageSize = 10;

    let pageGroupSize = 10;
    let [pageGroup, setPageGroup] = useState(1);

    // 검색/카테고리 변경되면 1페이지 + 1그룹
    useEffect(() => {
        setPage(1);
        setPageGroup(1);
    }, [keyword, queryCategory]);

    // ===== navigate =====
    let goWrite = () => {
        navigate(`/lms/${roomId}/board/write`);
    };

    let goDetail = (postId) => {
        navigate(`/lms/${roomId}/board/${postId}`);
    };

    // ===== utils =====
    let normalizedKeyword = keyword.trim().toLowerCase();

    let matchesKeyword = (p) => {
        if (!normalizedKeyword) return true;
        let hay = `${p.title} ${p.content}`.toLowerCase();
        return hay.includes(normalizedKeyword);
    };

    // pinned: 탭 무시, 검색만 적용
    let pinnedTopPosts = useMemo(() => {
        return posts
            .filter((p) => !!p.pinned)
            .filter(matchesKeyword)
            .sort((a, b) => b.postId - a.postId);
    }, [posts, normalizedKeyword]);

    // list: queryCategory + 검색 적용
    let listPosts = useMemo(() => {
        return posts
            .filter(matchesKeyword)
            .filter((p) => {
                if (!queryCategory) return true; // 전체
                return p.category === queryCategory;
            })
            .sort((a, b) => b.postId - a.postId);
    }, [posts, queryCategory, normalizedKeyword]);

    // ===== pagination derived =====
    let totalCount = listPosts.length;
    let totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
        if (page < 1) setPage(1);
    }, [page, totalPages]);

    useEffect(() => {
        let maxGroup = Math.max(1, Math.ceil(totalPages / pageGroupSize));
        if (pageGroup > maxGroup) setPageGroup(maxGroup);
        if (pageGroup < 1) setPageGroup(1);
    }, [pageGroup, totalPages, pageGroupSize]);

    let safePage = Math.min(Math.max(page, 1), totalPages);
    let startIdx = (safePage - 1) * pageSize;

    let pagedPosts = useMemo(() => {
        return listPosts.slice(startIdx, startIdx + pageSize);
    }, [listPosts, startIdx, pageSize]);

    // chip 클래스
    let chipClass = (category) => {
        if (category === "공지") return "bd-chip notice";
        if (category === "일반") return "bd-chip general";
        if (category === "질문") return "bd-chip qna";
        if (category === "자료") return "bd-chip resource";
        return "bd-chip";
    };

    // ===== page group (1~10, 11~20...) =====
    let maxGroup = Math.max(1, Math.ceil(totalPages / pageGroupSize));
    let groupStart = (pageGroup - 1) * pageGroupSize + 1;
    let groupEnd = Math.min(groupStart + pageGroupSize - 1, totalPages);

    let pageNumbers = useMemo(() => {
        let arr = [];
        for (let i = groupStart; i <= groupEnd; i++) arr.push(i);
        return arr;
    }, [groupStart, groupEnd]);

    let goPrevGroup = () => {
        if (pageGroup <= 1) return;
        let nextGroup = pageGroup - 1;
        let nextPage = (nextGroup - 1) * pageGroupSize + 1;
        setPageGroup(nextGroup);
        setPage(nextPage);
    };

    let goNextGroup = () => {
        if (pageGroup >= maxGroup) return;
        let nextGroup = pageGroup + 1;
        let nextPage = (nextGroup - 1) * pageGroupSize + 1;
        setPageGroup(nextGroup);
        setPage(nextPage);
    };

    let goPage = (p) => {
        setPage(p);
    };

    useEffect(() => {
        let expectedGroup = Math.ceil(safePage / pageGroupSize);
        if (expectedGroup !== pageGroup) setPageGroup(expectedGroup);
    }, [safePage, pageGroup, pageGroupSize]);

    let titleSuffix = queryCategory ? ` · ${queryCategory}` : "";

    console.log("roomId=", roomId, "path=", window.location.pathname);

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시판{titleSuffix}</h2>
                    <p className="bd-sub">고정된 글은 상단에 한 번 더 표시됩니다.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn" onClick={goWrite}>
                        글쓰기
                    </button>
                </div>
            </div>

            {/* 목록 */}
            <div className="bd-card">
                <div className="bd-list">
                    {/* pinned */}
                    {pinnedTopPosts.length > 0 &&
                        pinnedTopPosts.map((p) => (
                            <div
                                key={`pin-${p.postId}`}
                                className="bd-item pinned-top"
                                onClick={() => goDetail(p.postId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") goDetail(p.postId);
                                }}
                            >
                                <span className={chipClass(p.category)}>{p.category}</span>
                                <div className="bd-item-title">📌 {p.title}</div>
                                <div className="bd-item-meta">
                                    {p.authorName} · {p.createdAt}
                                </div>
                            </div>
                        ))}

                    {/* paged list */}
                    {pagedPosts.length === 0 ? (
                        <div className="bd-sub">게시글이 없습니다.</div>
                    ) : (
                        pagedPosts.map((p) => (
                            <div
                                key={p.postId}
                                className="bd-item"
                                onClick={() => goDetail(p.postId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") goDetail(p.postId);
                                }}
                            >
                                <span className={chipClass(p.category)}>{p.category}</span>
                                <div className="bd-item-title">{p.title}</div>
                                <div className="bd-item-meta">
                                    {p.authorName} · {p.createdAt}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 하단: 검색 위 / 페이지네이션 아래 */}
            <div className="bd-footer-col">
                <div className="bd-card bd-bottom-search">
                    <div className="bd-toolbar">
                        <input
                            className="bd-search"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="검색 (제목/내용)"
                        />

                        <button className="bd-btn-ghost" onClick={() => setKeyword("")}>
                            초기화
                        </button>
                    </div>
                </div>

                <div className="bd-pagination">
                    <button
                        className="bd-page-btn"
                        disabled={pageGroup <= 1}
                        onClick={goPrevGroup}
                        title="이전 10페이지"
                    >
                        &lt;&lt;
                    </button>

                    {pageNumbers.map((p) => (
                        <button
                            key={p}
                            className={`bd-page-btn ${p === safePage ? "active" : ""}`}
                            onClick={() => goPage(p)}
                        >
                            {p}
                        </button>
                    ))}

                    <button
                        className="bd-page-btn"
                        disabled={pageGroup >= maxGroup}
                        onClick={goNextGroup}
                        title="다음 10페이지"
                    >
                        &gt;&gt;
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Board;
