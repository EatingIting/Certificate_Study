import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Board.css";

import BoardDetail from "./BoardDetail";
import BoardWrite from "./BoardWrite";
import BoardEdit from "./BoardEdit";

/**
 * Board (라우터 없이 내부 view 전환)
 * view: list | detail | write | edit
 *
 * ✅ 네이버 카페 스타일:
 * - pinned 글은 상단에 "한 번 더" 노출
 * - 아래 원래 목록에도 그대로 존재(중복 표시)
 * - 탭(일반/질문 등)과 무관하게 pinned 상단은 항상 보이게(검색은 적용)
 */
function Board() {
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

    let [posts, setPosts] = useState(initialPosts);

    let [view, setView] = useState("list"); // list | detail | write | edit
    let [selectedPostId, setSelectedPostId] = useState(null);

    // list filter
    let [categoryFilter, setCategoryFilter] = useState("전체");
    let [keyword, setKeyword] = useState("");

    let selectedPost = posts.find((p) => p.postId === selectedPostId) || null;

    // ===== 브라우저 뒤로가기(popstate) 안정 처리 =====
    let viewRef = useRef("list");

    useEffect(() => {
        viewRef.current = view;
    }, [view]);

    useEffect(() => {
        // Board 마운트 시 history 1칸 쌓기
        window.history.pushState({ board: true }, "");

        let handlePopState = () => {
            // detail/write/edit 상태에서 뒤로가기 => list로만 복귀
            if (viewRef.current !== "list") {
                setSelectedPostId(null);
                setView("list");

                // 연속 뒤로가기로 Board 페이지를 훅 빠져나가는 것 방지
                window.history.pushState({ board: true }, "");
                return;
            }

            // list 상태면 개입하지 않음 (진짜 이전 페이지로 이동)
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // ===== navigation helpers =====
    let goList = () => {
        setSelectedPostId(null);
        setView("list");
    };

    let goDetail = (postId) => {
        window.history.pushState({ board: true }, "");
        setSelectedPostId(postId);
        setView("detail");
    };

    let goWrite = () => {
        window.history.pushState({ board: true }, "");
        setView("write");
    };

    let goEdit = (postId) => {
        window.history.pushState({ board: true }, "");
        setSelectedPostId(postId);
        setView("edit");
    };

    // ===== mutations =====
    let createPost = (draft) => {
        let nextId = Math.max(0, ...posts.map((p) => p.postId)) + 1;

        let newPost = {
            postId: nextId,
            category: draft.category,
            title: draft.title,
            content: draft.content,
            authorName: "홍길동",
            createdAt: "2026-01-19 10:30",
            pinned: false,
        };

        setPosts([newPost, ...posts]);
        return nextId;
    };

    let updatePost = (postId, patch) => {
        let next = posts.map((p) => {
            if (p.postId !== postId) return p;

            return {
                ...p,
                category: patch.category,
                title: patch.title,
                content: patch.content,
            };
        });

        setPosts(next);
    };

    let deletePost = (postId) => {
        let next = posts.filter((p) => p.postId !== postId);
        setPosts(next);

        if (selectedPostId === postId) goList();
    };

    // ===== view switching =====
    if (view === "detail") {
        return (
            <div className="bd">
                <BoardDetail
                    post={selectedPost}
                    onBack={goList}
                    onEdit={() => selectedPost && goEdit(selectedPost.postId)}
                    onDelete={() => selectedPost && deletePost(selectedPost.postId)}
                />
            </div>
        );
    }

    if (view === "write") {
        return (
            <div className="bd">
                <BoardWrite
                    onBack={goList}
                    onSubmit={(draft) => {
                        let newId = createPost(draft);
                        goDetail(newId);
                    }}
                />
            </div>
        );
    }

    if (view === "edit") {
        return (
            <div className="bd">
                <BoardEdit
                    post={selectedPost}
                    onBack={() => setView("detail")}
                    onSubmit={(patch) => {
                        if (!selectedPost) return;
                        updatePost(selectedPost.postId, patch);
                        setView("detail");
                    }}
                />
            </div>
        );
    }

    // ===== list view =====
    let normalizedKeyword = keyword.trim().toLowerCase();

    let matchesKeyword = (p) => {
        if (!normalizedKeyword) return true;
        let hay = `${p.title} ${p.content}`.toLowerCase();
        return hay.includes(normalizedKeyword);
    };

    // ✅ 상단 pinned: 탭 무시 + 검색 적용
    let pinnedTopPosts = posts
        .filter((p) => !!p.pinned)
        .filter(matchesKeyword)
        .sort((a, b) => b.postId - a.postId);

    // ✅ 원래 목록: 탭 + 검색 적용 (pinned 포함 => 중복 표시)
    let listPosts = posts
        .filter(matchesKeyword)
        .filter((p) => {
            if (categoryFilter === "전체") return true;
            return p.category === categoryFilter;
        })
        .sort((a, b) => b.postId - a.postId);

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시판</h2>
                    <p className="bd-sub">고정된 글은 상단에 한 번 더 표시됩니다.</p>
                </div>

                <div className="bd-actions">
                    <button className="bd-btn" onClick={goWrite}>
                        글쓰기
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-toolbar">
                    <select
                        className="bd-select"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="전체">전체</option>
                        <option value="공지">공지</option>
                        <option value="일반">일반</option>
                        <option value="질문">질문</option>
                        <option value="자료">자료</option>
                    </select>

                    <input
                        className="bd-search"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="검색 (제목/내용)"
                    />

                    <button
                        className="bd-btn-ghost"
                        onClick={() => {
                            setCategoryFilter("전체");
                            setKeyword("");
                        }}
                    >
                        초기화
                    </button>
                </div>
            </div>

            <div className="bd-card">
                <div className="bd-list">
                    {/* ✅ 상단 pinned(묶음 제목 없음) */}
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
                                <span className="bd-chip">{p.category}</span>

                                <div className="bd-item-title">📌 {p.title}</div>

                                <div className="bd-item-meta">
                                    {p.authorName} · {p.createdAt}
                                </div>
                            </div>
                        ))}

                    {/* ✅ 원래 목록(탭/검색 적용, pinned도 포함 => 중복 표시) */}
                    {listPosts.length === 0 ? (
                        <div className="bd-sub">게시글이 없습니다.</div>
                    ) : (
                        listPosts.map((p) => (
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
                                <span className="bd-chip">{p.category}</span>

                                <div className="bd-item-title">{p.title}</div>

                                <div className="bd-item-meta">
                                    {p.authorName} · {p.createdAt}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default Board;
