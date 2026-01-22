import "./SampleRecruit.css";
import { useMemo, useState } from "react";
import SampleRecruitModal from "./SampleRecruitModal";

const CATEGORY = [
  { key: "all", label: "전체" },
  { key: "master", label: "기능장" },
  { key: "engineer", label: "기사" },
  { key: "industrial", label: "산업기사" },
  { key: "craftsman", label: "기능사" },
  { key: "lang", label: "외국어" },
  { key: "public", label: "공무원·공공시험" },
  { key: "private", label: "민간자격·실무능력" },
];

const CATEGORY_LABEL = {
  all: "전체",
  master: "기능장",
  engineer: "기사",
  industrial: "산업기사",
  craftsman: "기능사",
  lang: "외국어",
  public: "공무원·공공시험",
  private: "민간자격·실무능력",
};

// ✅ 카테고리별 "자격증" 목록(중분류/세부)
const SUB = {
  master: [
    {
      group: "기능장",
      items: ["전기기능장", "기계가공기능장", "건축목공기능장", "용접기능장", "금형기능장"],
    },
  ],
  engineer: [
    {
      group: "기사",
      items: ["정보처리기사", "전기기사", "산업안전기사", "건축기사", "기계설계기사"],
    },
  ],
  industrial: [
    {
      group: "산업기사",
      items: ["정보처리산업기사", "전기산업기사", "산업안전산업기사", "기계정비산업기사", "건축산업기사"],
    },
  ],
  craftsman: [
    {
      group: "기능사",
      items: ["정보처리기능사", "전기기능사", "용접기능사", "건축도장기능사", "컴퓨터응용밀링기능사"],
    },
  ],
  lang: [
    {
      group: "영어",
      items: ["TOEFL(토플)", "TOEIC(토익)", "TEPS(텝스)", "OPIc(오픽)", "IELTS(아이엘츠)"],
    },
    { group: "일본어", items: ["JLPT"] },
    { group: "중국어", items: ["HSK", "TSC"] },
  ],
  public: [
    { group: "공무원", items: ["9급", "7급", "경찰", "소방"] },
    { group: "공공시험", items: ["한국사능력검정", "NCS", "KBS한국어"] },
  ],
  private: [
    { group: "민간자격", items: ["컴퓨터활용능력 1급", "GTQ", "한국어교원"] },
    { group: "실무능력", items: ["SQLD", "ADsP", "정보보안"] },
  ],
};

// ✅ (중요) 더미 데이터는 "대분류key + 자격증"을 갖게 만들어야 필터가 정확해짐
const ALL_CERTS = Object.entries(SUB).flatMap(([catKey, groups]) =>
  groups.flatMap((g) => g.items.map((cert) => ({ catKey, cert })))
);

// ✅ 임시 모집글 데이터 (카테고리/자격증이 다양하게 섞이도록)
const DUMMY = Array.from({ length: 24 }).map((_, i) => {
  const pick = ALL_CERTS[i % ALL_CERTS.length];
  return {
    id: i + 1,
    categoryKey: pick.catKey, // ✅ 필터용 키
    category: CATEGORY_LABEL[pick.catKey], // ✅ 화면 표시용 라벨
    cert: pick.cert, // ✅ 자격증(중분류)
    title: `${pick.cert} 스터디 모집글 ${i + 1}`,
    author: `user${(i % 8) + 1}`,
    date: "2026.01.14",
    tags: [pick.cert],
  };
});

const SampleRecruit = () => {
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [cat, setCat] = useState("all"); // 대분류 key
  const [sub, setSub] = useState(""); // 자격증(중분류)
  const [page, setPage] = useState(1);

  const showSubPanel = cat !== "all" && Boolean(SUB[cat]);

  const filtered = useMemo(() => {
    let list = [...DUMMY];

    // ✅ 검색(제목/작성자/카테고리/자격증)
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter(
        (x) =>
          x.title.toLowerCase().includes(k) ||
          x.author.toLowerCase().includes(k) ||
          x.category.toLowerCase().includes(k) ||
          x.cert.toLowerCase().includes(k) ||
          x.tags.join(" ").toLowerCase().includes(k)
      );
    }

    // ✅ 대분류 필터 (키로 정확히)
    if (cat !== "all") {
      list = list.filter((x) => x.categoryKey === cat);
    }

    // ✅ 자격증(중분류) 필터
    if (sub) {
      list = list.filter((x) => x.cert === sub);
    }

    return list;
  }, [keyword, cat, sub]);

  // 페이징
  const pageSize = 8;
  const totalPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="recruit-wrap">
      <h2 className="recruit-title">전체 모집 스터디</h2>

    {/* 검색 */}
    <div className="recruit-search">
    <div className="search-box">
        <input
        className="search-input"
        placeholder="자격증명 또는 스터디 이름으로 검색"
        value={keyword}
        onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
        }}

        onKeyDown={(e) => {
            if (e.key === "Enter") setPage(1);
            }}

        />

        {keyword && (
        <button
            type="button"
            className="search-clear"
            onClick={() => {
            setKeyword("");
            setPage(1);
            }}
            aria-label="검색어 지우기"
        >
            ✕
        </button>
        )}

        <button type="button" className="search-btn" onClick={() => setPage(1)}>
        검색
        </button>
    </div>
    </div>


      {/* 대분류 카테고리 */}
      <div className="recruit-cats">
        {CATEGORY.map((c) => (
          <button
            key={c.key}
            className={`cat-chip ${cat === c.key ? "active" : ""}`}
            onClick={() => {
              setCat(c.key);
              setSub("");
              setPage(1);
            }}
            type="button"
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ✅ 중분류(자격증) 패널 */}
      {showSubPanel && (
        <div className="subpanel">
          {SUB[cat].map((g) => (
            <div className="subgroup" key={g.group}>
              <div className="subgroup-title">{g.group}</div>
              <div className="sub-items">
                {g.items.map((item) => (
                  <button
                    key={item}
                    className={`sub-btn ${sub === item ? "active" : ""}`}
                    onClick={() => {
                      setSub(item);
                      setPage(1);
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="sub-clear">
            <button
              type="button"
              className="sub-clear-btn"
              onClick={() => setSub("")}
              disabled={!sub}
            >
              필터 해제
            </button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="recruit-table">
        <div className="thead">
          <div>번호</div>
          <div>카테고리</div>
          <div className="title-col">제목</div>
          <div>작성자</div>
          <div>작성일</div>
        </div>

        {pageItems.map((row) => (
            <div
                className="trow"
                key={row.id}
                onClick={() => {
                setSelectedStudy(row);
                setOpenModal(true);
                }}
            >
            <div>{row.id}</div>
            <div>{row.category}</div>
            <div className="title-col">
              <strong className="row-title">{row.title}</strong>
              {row.cert && <span className="tag">{row.cert}</span>}
            </div>
            <div>{row.author}</div>
            <div>{row.date}</div>
          </div>
        ))}
      </div>

      {/* 페이징 */}
      <div className="pager">
        <button onClick={() => setPage(1)} disabled={page === 1}>
          «
        </button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          ‹
        </button>

        {Array.from({ length: totalPage }).slice(0, 5).map((_, idx) => {
          const p = idx + 1;
          return (
            <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>
              {p}
            </button>
          );
        })}

        <button
          onClick={() => setPage((p) => Math.min(totalPage, p + 1))}
          disabled={page === totalPage}
        >
          ›
        </button>
        <button onClick={() => setPage(totalPage)} disabled={page === totalPage}>
          »
        </button>
      </div>

      <SampleRecruitModal
        open={openModal}
        study={selectedStudy}
        onClose={() => setOpenModal(false)}
        />

    </div>

    
  );
};

export default SampleRecruit;
