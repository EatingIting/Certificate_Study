import "./RoomPage.css";
import RoomPageModal from "./RoomPageModal";
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const ITEMS_PER_PAGE = 8;

const RoomPage = () => {
    const [rooms, setRooms] = useState([]);
    const [categories, setCategories] = useState([]);

    const [keyword, setKeyword] = useState("");
    const [cat, setCat] = useState("전체");
    const [mid, setMid] = useState(null);
    const [sub, setSub] = useState(null);


    const [page, setPage] = useState(1);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [openModal, setOpenModal] = useState(false);

    useEffect(() => {
        fetchRooms();
        fetchCategories();
    }, []);

    const fetchRooms = async () => {
        const res = await api.get("/rooms");
        setRooms([...res.data].sort((a, b) => b.id - a.id));
    };

    const fetchCategories = async () => {
        const res = await api.get("/category");
        setCategories(res.data);
    };

    /* ===== 대분류 ===== */
    const CATEGORY = useMemo(() => {
        return [
            { key: "전체", label: "전체" },
            ...categories
                .filter(c => c.level === 1)
                .map(c => ({
                    key: c.name,
                    label: c.name
                })),
        ];
    }, [categories]);

    /* ===== 중분류 (없으면 소분류 대체) ===== */
    const SUB = useMemo(() => {
        if (cat === "전체") return null;

        const main = categories.find(
            c => c.level === 1 && c.name === cat
        );
        if (!main) return null;

        const mids = categories.filter(
            c => c.level === 2 && c.parentId === main.id
        );

        const hasSub = mids.some(mid =>
            categories.some(
                c => c.level === 3 && c.parentId === mid.id
            )
        );

        // ✅ 대–중 구조
        if (!hasSub) {
            return [
                {
                    type: "MID_ONLY",
                    items: mids.map(mid => mid.name)
                }
            ];
        }

        // ✅ 대–중–소 구조
        return mids.map(mid => ({
            type: "WITH_SUB",
            title: mid.name,
            items: categories
                .filter(c => c.level === 3 && c.parentId === mid.id)
                .map(s => s.name)
        }));
    }, [categories, cat]);




    const showSubPanel = cat !== "전체" && SUB;

    /* ===== 필터 ===== */
    const filtered = useMemo(() => {
        let list = [...rooms];

        // 검색
        if (keyword.trim()) {
            const k = keyword.toLowerCase();
            list = list.filter(
                r =>
                    r.title?.toLowerCase().includes(k) ||
                    r.nickname?.toLowerCase().includes(k) ||
                    r.midCategoryName?.toLowerCase().includes(k) ||
                    r.subCategoryName?.toLowerCase().includes(k)
            );
        }

        // 대분류
        if (cat !== "전체") {
            const main = categories.find(
                c => c.level === 1 && c.name === cat
            );
            if (main) {
                const mids = categories
                    .filter(c => c.level === 2 && c.parentId === main.id)
                    .map(c => c.name);

                list = list.filter(
                    r => mids.includes(r.midCategoryName)
                );
            }
        }

        // 중분류
        if (mid !== null) {
            list = list.filter(
                r => r.midCategoryName === mid
            );
        }

        // 소분류
        if (sub !== null) {
            list = list.filter(
                r => r.subCategoryName === sub
            );
        }

        return list;
    }, [rooms, keyword, cat, mid, sub, categories]);



    /* ===== 페이징 ===== */
    const pageSize = 8;
    const totalPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageItems = filtered.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    /* ===== 상세 ===== */
    const openDetail = async (room) => {
        const res = await api.get(`/rooms/${room.roomId}`);
        setSelectedRoom(res.data);
        setOpenModal(true);
    };

    const closeModal = () => {
        setOpenModal(false);
        setSelectedRoom(null);
    };

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
                        >
                            ✕
                        </button>
                    )}

                    <button type="button" className="search-btn">
                        검색
                    </button>
                </div>
            </div>

            {/* 대분류 */}
            <div className="recruit-cats">
                {CATEGORY.map((c) => (
                    <button
                        key={c.key}
                        className={`cat-chip ${cat === c.key ? "active" : ""}`}
                        onClick={() => {
                            setCat(c.key);
                            setSub(null);
                            setPage(1);
                        }}

                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* 중분류 / 소분류 */}
            {showSubPanel && (
                <div className="subpanel">
                    {SUB.map((g, idx) => (
                        <div
                            className={`subgroup ${g.type === "MID_ONLY" ? "mid-only" : ""}`}
                            key={idx}
                        >
                            {/* ✅ 대-중-소 구조 */}
                            {g.type === "WITH_SUB" && (
                                <>
                                    <div className="subgroup-title">{g.title}</div>
                                    <div className="sub-items">
                                        {g.items.map(item => (
                                            <button
                                                key={item}
                                                className={`sub-btn ${sub === item ? "active" : ""}`}
                                                onClick={() => {
                                                    setSub(item);   // ← name
                                                    setPage(1);
                                                }}
                                            >
                                                {item}
                                            </button>
                                        ))}

                                    </div>
                                </>
                            )}

                            {/* ✅ 대-중 구조 */}
                            {g.type === "MID_ONLY" && (
                                <div className="sub-items">
                                    {g.items.map(item => (
                                        <button
                                            key={item}   // ✅ 문자열
                                            className={`sub-btn ${sub === item ? "active" : ""}`}
                                            onClick={() => {
                                                setSub(item);  // ✅ name
                                                setPage(1);
                                            }}
                                        >
                                            {item}  {/* ✅ 문자열 출력 */}
                                        </button>
                                    ))}
                                </div>
                            )}

                        </div>
                    ))}

                    <div className="sub-clear">
                        <button
                            type="button"
                            className="sub-clear-btn"
                            onClick={() => setSub(null)}
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

                {pageItems.map((room, idx) => (
                    <div
                        className="trow"
                        key={room.roomId}
                        onClick={() => openDetail(room)}
                    >

                    <div>{(page - 1) * pageSize + idx + 1}</div>
                        <div>{room.midCategoryName ?? room.subCategoryName}</div>
                        <div className="title-col">
                            <strong className="row-title">{room.title}</strong>
                            {(room.subCategoryName || room.midCategoryName) && (
                                <span className="tag">
                {room.subCategoryName ?? room.midCategoryName}
              </span>
                            )}
                        </div>
                        <div>{room.nickname}</div>
                        <div>{room.createdAt?.slice(0, 10)}</div>
                    </div>
                ))}
            </div>

            {/* 페이징 */}
            <div className="pager">
                <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>

                {Array.from({ length: totalPage }).slice(0, 5).map((_, idx) => {
                    const p = idx + 1;
                    return (
                        <button
                            key={p}
                            className={page === p ? "active" : ""}
                            onClick={() => setPage(p)}
                        >
                            {p}
                        </button>
                    );
                })}

                <button onClick={() => setPage(p => Math.min(totalPage, p + 1))} disabled={page === totalPage}>›</button>
                <button onClick={() => setPage(totalPage)} disabled={page === totalPage}>»</button>
            </div>

            {openModal && selectedRoom && (
                <RoomPageModal
                    open={openModal}
                    study={selectedRoom}
                    onClose={closeModal}
                    onApply={({ roomId, applyMessage }) => {
                        api.post("/applications", {
                            roomId,
                            applyMessage,
                        });
                    }}
                />
            )}

        </div>
    );

};

export default RoomPage;
