import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Board.css";

function Board() {
  let navigate = useNavigate();
  let [sp] = useSearchParams();

  // ✅ URL: /lms/1/board?category=공지
  let queryCategory = sp.get("category"); // "공지" | "일반" | "질문" | "자료" | null

  // ===== 더미 데이터(백엔드 붙이면 여기만 교체) =====
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
      {
        postId: 2,
        category: "일반",
        title: "스터디 시간 변경 가능한가요?",
        content: "다음 주부터 30분 늦추는 건 어떤가요?\n(더미 데이터)",
        authorName: "홍길동",
        createdAt: "2026-01-17 11:20",
        pinned: false,
      },
      {
        postId: 1,
        category: "자료",
        title: "기출 모음 PDF",
        content: "파일은 나중에 업로드!\n(더미 데이터)",
        authorName: "홍길동",
        createdAt: "2026-01-16 09:10",
        pinned: false,
      },
    ];
  }, []);

  let [posts] = useState(initialPosts);

  // ===== 검색 =====
  let [keyword, setKeyword] = useState("");

  // ===== 페이지네이션(그룹형) =====
  let [page, setPage] = useState(1);
  let pageSize = 10; // 한 페이지 글 개수
  let groupSize = 10; // 한 그룹에 보여줄 페이지 번호 개수 (1~10, 11~20 ...)

  // 검색/카테고리 변경되면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [keyword, queryCategory]);

  // ===== navigate: ✅ 상대경로(roomId 안 씀) =====
  let goWrite = () => {
    navigate("write");
  };

  let goDetail = (postId) => {
    navigate(String(postId));
  };

  // ===== 필터/정렬 =====
  let normalizedKeyword = keyword.trim().toLowerCase();

  let matchesKeyword = (p) => {
    if (!normalizedKeyword) return true;
    let hay = `${p.title} ${p.content}`.toLowerCase();
    return hay.includes(normalizedKeyword);
  };

  // 고정글: 검색만 적용 (카테고리는 무시하고 상단 노출)
  let pinnedTopPosts = useMemo(() => {
    return posts
      .filter((p) => !!p.pinned)
      .filter(matchesKeyword)
      .sort((a, b) => b.postId - a.postId);
  }, [posts, normalizedKeyword]);

  // 일반 목록: 카테고리 + 검색 적용
  let listPosts = useMemo(() => {
    return posts
      .filter((p) => !p.pinned)
      .filter(matchesKeyword)
      .filter((p) => {
        if (!queryCategory) return true;
        return p.category === queryCategory;
      })
      .sort((a, b) => b.postId - a.postId);
  }, [posts, queryCategory, normalizedKeyword]);

  // ===== 페이지네이션 파생값 =====
  let totalCount = listPosts.length;
  let totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // page 범위 보정
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  // 현재 page가 속한 그룹 번호(1부터)
  let group = Math.ceil(page / groupSize);

  // 그룹 시작/끝 페이지 번호
  let groupStart = (group - 1) * groupSize + 1;
  let groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

  let pageNumbers = useMemo(() => {
    let arr = [];
    for (let i = groupStart; i <= groupEnd; i++) arr.push(i);
    return arr;
  }, [groupStart, groupEnd]);

  // 그룹 이동
  let goFirstGroup = () => {
    setPage(1);
  };

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

  let goPage = (p) => {
    setPage(p);
  };

  // 현재 페이지 목록
  let startIdx = (page - 1) * pageSize;
  let pagedPosts = useMemo(() => {
    return listPosts.slice(startIdx, startIdx + pageSize);
  }, [listPosts, startIdx, pageSize]);

  // 카테고리 칩 클래스
  let chipClass = (category) => {
    if (category === "공지") return "bd-chip notice";
    if (category === "일반") return "bd-chip general";
    if (category === "질문") return "bd-chip qna";
    if (category === "자료") return "bd-chip resource";
    return "bd-chip";
  };

  let titleSuffix = queryCategory ? ` · ${queryCategory}` : "";

  return (
    <div className="bd">
      {/* 상단 헤더 */}
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

      {/* 게시글 목록 */}
      <div className="bd-card">
        <div className="bd-list">
          {/* pinned top */}
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

          {/* page list */}
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

      {/* ✅ 검색창: 목록 아래 / 페이지네이션 위 */}
      <div className="bd-card bd-bottom-search">
        <div className="bd-toolbar">
          <input
            className="bd-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색 (제목/내용)"
          />
          <button className="bd-btn-ghost" onClick={() => setKeyword("")} disabled={!keyword.trim()}>
            초기화
          </button>
        </div>
      </div>

      {/* ✅ 페이지네이션: 아래 (<< < 1..10 > >>) */}
      <div className="bd-pagination">
        <button className="bd-page-btn" onClick={goFirstGroup} disabled={group === 1}>
          {"<<"}
        </button>

        <button className="bd-page-btn" onClick={goPrevGroup} disabled={group === 1}>
          {"<"}
        </button>

        {pageNumbers.map((p) => (
          <button
            key={p}
            className={`bd-page-btn ${p === page ? "active" : ""}`}
            onClick={() => goPage(p)}
          >
            {p}
          </button>
        ))}

        <button
          className="bd-page-btn"
          onClick={goNextGroup}
          disabled={group === Math.ceil(totalPages / groupSize)}
        >
          {">"}
        </button>

        <button
          className="bd-page-btn"
          onClick={goLastGroup}
          disabled={group === Math.ceil(totalPages / groupSize)}
        >
          {">>"}
        </button>
      </div>
    </div>
  );
}

export default Board;
