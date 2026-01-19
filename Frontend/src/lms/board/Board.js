import React, { useEffect, useMemo, useState } from "react";
import "./Board.css";

import BoardDetail from "./BoardDetail";
import BoardWrite from "./BoardWrite";
import BoardEdit from "./BoardEdit";

/**
 * 라우터 없이 Board 내부에서 화면 전환
 * view: list | detail | write | edit
 *
 * + 브라우저 뒤로가기(popstate) 처리:
 *   - detail/write/edit 상태에서 뒤로가기 => list로 이동
 *   - list 상태에서 뒤로가기 => 진짜 이전 페이지로 이동
 */
function Board() {
    let initialPosts = useMemo(() => {
        // 더미 데이터 (가명 사용)
        return [
            {
                postId: 100,
                category: "공지",
                title: "📌 필독: 게시판 이용 규칙",
                content: "욕설 금지, 광고 금지, 서로 존중하기.\n\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-19 10:00",
                pinned: true,
            },
            {
                postId: 101,
                category: "공지",
                title: "이번 주 시험/접수 일정 공지",
                content: "접수: 1/20\n시험: 2/02\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-19 10:05",
                pinned: true,
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
            {
                postId: 4,
                category: "질문",
                title: "SQLD 개정 범위 어디까지인가요?",
                content: "정리해서 공유해주실 분?\n(더미 데이터)",
                authorName: "홍길동",
                createdAt: "2026-01-18 18:40",
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

    // ===== 브라우저 뒤로가기(popstate) 처리 =====
    useEffect(() => {
        // Board가 마운트될 때 history 한 칸 쌓아둠 (뒤로가기를 잡기 위함)
        window.history.pushState({ board: true }, "");

        let handlePopState = () => {
            // detail/write/edit 화면이면: "이전 페이지로"가 아니라 "목록으로" 처리
            if (view !== "list") {
                setSelectedPostId(null);
                setView("list");

                // 연속 뒤로가기도 방지하려고 다시 push
                window.history.pushState({ board: true }, "");
                return;
            }

            // list 화면이면: 여기서는 개입하지 않음 (진짜 이전 페이지로 이동)
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [view]);

    // ===== navigation helpers =====
    let goList = () => {
        setSelectedPostId(null);
        setView("list");
    };

    let goDetail = (postId) => {
        // detail 들어갈 때도 history 한 칸 쌓아두면 UX가 더 자연스러움
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
        // draft: {category,title,content}
        let nextId = Math.max(0, ...posts.map((p) => p.postId)) + 1;

        let newPost = {
            postId: nextId,
            category: draft.category,
            title: draft.title,
            content: draft.content,
            authorName: "홍길동",
            createdAt: "2026-01-19 10:30",
            pinned: draft.category === "공지",
        };

        setPosts([newPost, ...posts]);
        return nextId;
    };

    let updatePost = (postId, patch) => {
        let next = posts.map((p) => {
            if (p.postId !== postId) return p;

            let nextCategory = patch.category;
            let nextPinned = nextCategory === "공지";

            return {
                ...p,
                category: patch.category,
                title: patch.title,
                content: patch.content,
                pinned: nextPinned,
            };
        });

        setPosts(next);
    };

    let deletePost = (postId) => {
        let next = posts.filter((p) => p.postId !== postId);
        setPosts(next);

        // 삭제 후 안전 처리
        if (selectedPostId === postId) {
            goList();
        }
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

    let filtered = posts
        .filter((p) => {
            if (categoryFilter === "전체") return true;
            return p.category === categoryFilter;
        })
        .filter((p) => {
            if (!normalizedKeyword) return true;
            let hay = `${p.title} ${p.content}`.toLowerCase();
            return hay.includes(normalizedKeyword);
        });

    // 공지(고정/공지카테고리) 먼저
    let sorted = [...filtered].sort((a, b) => {
        let ap = a.pinned ? 1 : 0;
        let bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap; // pinned 먼저
        return b.postId - a.postId; // 최신 느낌
    });

    return (
        <div className="bd">
            <div className="bd-head">
                <div>
                    <h2 className="bd-title">게시판</h2>
                    <p className="bd-sub">공지/일반/질문/자료를 확인하고 글을 작성할 수 있어요.</p>
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
                    {sorted.length === 0 ? (
                        <div className="bd-sub">게시글이 없습니다.</div>
                    ) : (
                        sorted.map((p) => {
                            let isNotice = p.category === "공지" || p.pinned;

                            return (
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
                  <span className={`bd-chip ${isNotice ? "notice" : ""}`}>
                    {isNotice ? "공지" : p.category}
                  </span>

                                    <div className="bd-item-title">{p.title}</div>

                                    <div className="bd-item-meta">
                                        {p.authorName} · {p.createdAt}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

export default Board;
