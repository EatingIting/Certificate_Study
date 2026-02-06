import "./RoomPage.css";
import RoomPageModal from "./RoomPageModal";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import {useNavigate} from "react-router-dom";

const ITEMS_PER_PAGE = 8;

const RoomPage = () => {
    const navigate = useNavigate();
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

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const catParam = params.get("cat");

        if (catParam) {
            setCat(catParam);
            setMid(null);
            setSub(null);
            setPage(1);

            navigate("/room", { replace: true });
        }
    }, [location.search]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const keywordParam = params.get("keyword");

        if (keywordParam) {
            setKeyword(keywordParam);
            setPage(1);
        }
    }, [location.search]);

    const fetchRooms = async () => {
        const res = await api.get("/rooms");
        setRooms([...res.data].sort((a, b) => b.id - a.id));
    };

    const fetchCategories = async () => {
        const res = await api.get("/category");
        setCategories(res.data);
    };

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

        if (!hasSub) {
            return [
                {
                    type: "MID_ONLY",
                    items: mids.map(mid => mid.name)
                }
            ];
        }

        return mids.map(mid => ({
            type: "WITH_SUB",
            title: mid.name,
            items: categories
                .filter(c => c.level === 3 && c.parentId === mid.id)
                .map(s => s.name)
        }));
    }, [categories, cat]);

    const showSubPanel = cat !== "전체" && SUB;

    const filtered = useMemo(() => {
        let list = [...rooms];

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

        if (cat !== "전체") {
            const main = categories.find(
                c => c.level === 1 && c.name === cat
            );

            if (main) {
                const mids = categories.filter(
                    c => c.level === 2 && c.parentId === main.id
                );

                const subs = categories.filter(
                    c =>
                        c.level === 3 &&
                        mids.some(mid => mid.id === c.parentId)
                );

                const midNames = mids.map(m => m.name);
                const subNames = subs.map(s => s.name);

                list = list.filter(
                    r =>
                        midNames.includes(r.midCategoryName) ||
                        subNames.includes(r.subCategoryName)
                );
            }
        }

        if (mid !== null) {
            list = list.filter(
                r => r.midCategoryName === mid
            );
        }

        if (sub !== null) {
            list = list.filter(
                r => r.subCategoryName === sub
            );
        }

        return list;
    }, [rooms, keyword, cat, mid, sub, categories]);

    const pageSize = 8;
    const totalPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageItems = filtered.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    const calcDday = (deadline) => {
        if (!deadline) return "";

        const today = new Date();
        const end = new Date(deadline);

        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

        if (diff < 0) return "마감";
        if (diff > 3) return "";
        if (diff === 0) return "D-day";

        return `D-${diff}`;
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const openId = params.get("open");

        if (openId) {
            api.get(`/rooms/${openId}`).then((res) => {
                setSelectedRoom(res.data);
                setOpenModal(true);
            });
        }
    }, [location.search]);


    const openDetail = async (room) => {
        const res = await api.get(`/rooms/${room.roomId}`);
        setSelectedRoom(res.data);
        setOpenModal(true);
    };

    const closeModal = () => {
        setOpenModal(false);
        setSelectedRoom(null);
        navigate("/room", { replace: true });
    };


    return (
        <div className="recruit-wrap">
            <h2 className="recruit-title">전체 모집 스터디</h2>

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
                                navigate("/room", {
                                    replace: true
                                });
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

            <div className="recruit-cats">
                {CATEGORY.map((c) => (
                    <button
                        key={c.key}
                        className={`cat-chip ${cat === c.key ? "active" : ""}`}
                        onClick={() => {
                            setCat(c.key);
                            setMid(null);
                            setSub(null);
                            setPage(1);
                        }}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {showSubPanel && (
                <div className="subpanel">
                    {SUB.map((g, idx) => (
                        <div
                            className={`subgroup ${g.type === "MID_ONLY" ? "mid-only" : ""}`}
                            key={idx}
                        >
                            {g.type === "WITH_SUB" && (
                                <>
                                    <div className="subgroup-title">{g.title}</div>
                                    <div className="sub-items">
                                        {g.items.map(item => (
                                            <button
                                                key={item}
                                                className={`sub-btn ${sub === item ? "active" : ""}`}
                                                onClick={() => {
                                                    setMid(g.title);
                                                    setSub(item);
                                                    setPage(1);
                                                }}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}


                            {g.type === "MID_ONLY" && (
                                <div className="sub-items">
                                    {g.items.map(item => (
                                        <button
                                            key={item}
                                            className={`sub-btn ${mid === item ? "active" : ""}`}
                                            onClick={() => {
                                                setMid(item);
                                                setSub(null);
                                                setPage(1);
                                            }}
                                        >
                                            {item}
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
                            onClick={() => {
                                setMid(null);
                                setSub(null);
                            }}
                            disabled={!mid && !sub}
                        >
                            필터 해제
                        </button>
                    </div>
                </div>
            )}

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
                            <div className="title-wrap">
                                <strong className="row-title">{room.title}</strong>

                                {(room.subCategoryName || room.midCategoryName) && (
                                    <span className="tag">
                {room.subCategoryName ?? room.midCategoryName}
            </span>
                                )}

                                {calcDday(room.deadline) && (
                                    <span className="dday">
                {calcDday(room.deadline)}
            </span>
                                )}
                            </div>
                        </div>
                        <div>{room.hostUserNickname}</div>
                        <div>{room.createdAt?.slice(0, 10)}</div>
                    </div>
                ))}
            </div>

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
