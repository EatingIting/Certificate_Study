import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Board.css";

function Board() {
    let [tab, setTab] = useState("all"); // all | notice | general | question | 자료 | 과제
    let [q, setQ] = useState("");

    let categories = [
        { key: "all", label: "전체" },
        { key: "notice", label: "공지" },
        { key: "general", label: "일반" },
        { key: "question", label: "질문" },
        { key: "자료", label: "자료" },
        { key: "과제", label: "과제" },
    ];

    // TODO: API 붙이면 이 posts만 교체하면 됨
    let posts = useMemo(
        () => [
            // 고정글(pinned) - 공지와 별개
            { id: 100, pinned: true, type: "일반", title: "📌 필독: 게시판 이용 규칙", date: "2026-01-19" },
            { id: 101, pinned: true, type: "자료", title: "📌 자료 업로드 규칙(폴더/이름)", date: "2026-01-19" },

            // 공지글(type="공지") - pinned와 별개
            { id: 1, pinned: false, type: "공지", title: "이번 주 일정 공지(월요일 시작)", date: "2026-01-19" },
            { id: 2, pinned: false, type: "공지", title: "출석 처리 방식 안내", date: "2026-01-18" },

            // 일반글
            { id: 3, pinned: false, type: "일반", title: "오늘 발표 순서 확인 부탁", date: "2026-01-19" },
            { id: 4, pinned: false, type: "질문", title: "SQLD 조인 정리 질문", date: "2026-01-19" },
            { id: 5, pinned: false, type: "자료", title: "6회차 자료 업로드했습니다", date: "2026-01-18" },
            { id: 6, pinned: false, type: "과제", title: "과제 제출 링크 공유", date: "2026-01-18" },
        ],
        []
    );

    let catBtnClass = (key) => `board-tab ${tab === key ? "active" : ""}`;

    // 고정 > 공지 > 일반(탭 필터 적용)
    let { pinnedPosts, noticePosts, normalPosts } = useMemo(() => {
        let keyword = q.trim();

        let searched = posts.filter((p) => {
            if (!keyword) return true;
            return p.title.includes(keyword);
        });

        let pinned = searched.filter((p) => p.pinned);
        let notice = searched.filter((p) => !p.pinned && p.type === "공지");
        let rest = searched.filter((p) => !p.pinned && p.type !== "공지");

        let filteredRest = rest.filter((p) => {
            if (tab === "all") return true;
            if (tab === "notice") return false;
            if (tab === "general") return p.type === "일반";
            if (tab === "question") return p.type === "질문";
            if (tab === "자료") return p.type === "자료";
            if (tab === "과제") return p.type === "과제";
            return true;
        });

        return {
            pinnedPosts: pinned,
            noticePosts: notice,
            normalPosts: filteredRest,
        };
    }, [posts, q, tab]);

    let tagVariant = (label) => {
        if (label === "고정") return "tag-pin";
        if (label === "공지") return "tag-notice";
        if (label === "질문") return "tag-q";
        if (label === "과제") return "tag-task";
        if (label === "자료") return "tag-doc";
        return "tag-normal";
    };

    return (
        <div className="board">
            {/* 상단 타이틀 영역 */}
            <div className="board-head">
                <div>
                    <h2 className="board-title">게시판</h2>
                    <p className="board-sub">고정글/공지글은 항상 위에 표시됩니다.</p>
                </div>

                <Link className="board-write-btn" to="new">
                    글쓰기
                </Link>
            </div>

            {/* 필터/검색 카드 */}
            <div className="board-toolbar card-like">
                <div className="board-tabs">
                    {categories.map((c) => (
                        <button
                            key={c.key}
                            className={catBtnClass(c.key)}
                            type="button"
                            onClick={() => setTab(c.key)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                <div className="board-search">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="제목 검색"
                        className="board-search-input"
                    />
                </div>
            </div>

            {/* 목록 카드 */}
            <div className="board-list card-like">
                <div className="board-list-head">
                    <span>분류</span>
                    <span>제목</span>
                    <span>날짜</span>
                </div>

                <div className="board-rows">
                    {pinnedPosts.map((p) => (
                        <Link key={p.id} to={`${p.id}`} className="board-row">
                            <span className={`board-tag ${tagVariant("고정")}`}>고정</span>
                            <span className="board-row-title">{p.title}</span>
                            <span className="board-row-date">{p.date}</span>
                        </Link>
                    ))}

                    {noticePosts.map((p) => (
                        <Link key={p.id} to={`${p.id}`} className="board-row">
                            <span className={`board-tag ${tagVariant("공지")}`}>공지</span>
                            <span className="board-row-title">{p.title}</span>
                            <span className="board-row-date">{p.date}</span>
                        </Link>
                    ))}

                    {normalPosts.map((p) => (
                        <Link key={p.id} to={`${p.id}`} className="board-row">
                            <span className={`board-tag ${tagVariant(p.type)}`}>{p.type}</span>
                            <span className="board-row-title">{p.title}</span>
                            <span className="board-row-date">{p.date}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Board;
