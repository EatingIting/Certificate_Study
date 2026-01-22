import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import api from "../api/api";
import "./RoomPage.css";
import onsil from "./메인로고.png";
import CreateRoom from "../roomcreate/Create";


const ITEMS_PER_PAGE = 8;

const RoomPage = () => {
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);

    /* ===== 상태 ===== */
    const [mainCategories, setMainCategories] = useState([]);
    const [categoryTree, setCategoryTree] = useState([]);
    const [expandedCategoryId, setExpandedCategoryId] = useState(null);

    const [activeMidCategories, setActiveMidCategories] = useState([]);
    const [selectedMainCategory, setSelectedMainCategory] = useState("전체");
    const [selectedCategory, setSelectedCategory] = useState("전체(가나다순)");
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [categoryKeyword, setCategoryKeyword] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedRoom, setSelectedRoom] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [applyMessage, setApplyMessage] = useState("");

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const nickname = localStorage.getItem("nickname");

    useEffect(() => {
        const closeMenu = () => setIsUserMenuOpen(false);
        window.addEventListener("click", closeMenu);
        return () => window.removeEventListener("click", closeMenu);
    }, []);

    /* ===== 공통 트리 생성 ===== */
    const buildCategoryTree = (allCategories, parentId = null) => {
        const mids = allCategories
            .filter(c => c.level === 2 && (!parentId || c.parentId === parentId))
            .sort((a, b) => a.name.localeCompare(b.name, "ko"));

        const subs = allCategories.filter(c => c.level === 3);

        return mids.map(mid => ({
            id: mid.id,
            name: mid.name,
            children: subs
                .filter(s => s.parentId === mid.id)
                .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        }));
    };

    /* ===== 대분류 로딩 ===== */
    useEffect(() => {
        api.get("/category/main")
            .then(res => {
                setMainCategories(["전체", ...res.data.map(c => c.name)]);
            });
    }, []);

    /* ===== 초기 전체 중분류 + 소분류 ===== */
    useEffect(() => {
        api.get("/category")
            .then(res => {
                setCategoryTree(buildCategoryTree(res.data));
            });
    }, []);

    /* ===== 대분류 클릭 ===== */
    const handleMainCategoryClick = async (catName) => {
        setSelectedMainCategory(catName);
        setSelectedCategory("전체(가나다순)");
        setSelectedSubCategory(null);
        setExpandedCategoryId(null);
        setCurrentPage(1);
        setCategoryKeyword("");

        const res = await api.get("/category");

        if (catName === "전체") {
            setCategoryTree(buildCategoryTree(res.data));
            setActiveMidCategories([]);
            return;
        }

        const main = res.data.find(c => c.level === 1 && c.name === catName);
        if (!main) return;

        const mids = res.data.filter(
            c => c.level === 2 && c.parentId === main.id
        );

        setActiveMidCategories(mids.map(m => m.name));

        setCategoryTree(buildCategoryTree(res.data, main.id));
    };

    /* ===== 방 필터 ===== */
    const filteredRooms = (() => {
        if (selectedSubCategory) {
            return rooms.filter(
                r => r.subCategoryName === selectedSubCategory
            );
        }

        if (selectedCategory !== "전체(가나다순)") {
            return rooms.filter(
                r => r.midCategoryName === selectedCategory
            );
        }

        if (activeMidCategories.length > 0) {
            return rooms.filter(
                r => activeMidCategories.includes(r.midCategoryName)
            );
        }

        return rooms;
    })();

    /* ===== 검색 ===== */
    const filteredCategoryTree = categoryTree.filter(cat =>
        cat.name.toLowerCase().includes(categoryKeyword.toLowerCase())
    );

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await api.get("/rooms");

            // 최신순 정렬 (id 기준, 필요시 createdAt)
            const sorted = [...res.data].sort(
                (a, b) => b.id - a.id
            );

            setRooms(sorted);
        } catch (e) {
            console.error("스터디 목록 조회 실패", e);
        }
    };

    /* ===== 페이지 ===== */
    const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);
    const pagedRooms = filteredRooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const penModal = async (room) => {
        try {
            const res = await api.get(`/rooms/${room.roomId}`);

            setSelectedRoom(res.data);
            setIsModalOpen(true);
        } catch (e) {
            console.error("상세 조회 실패", e);
        }
    };
    const handleApply = () => {
        setIsApplyModalOpen(true);
    };

    const submitApply = async () => {
        try {
            await api.post("/applications", {
                roomId: selectedRoom.roomId,
                applyMessage: applyMessage,
            });

            alert("스터디에 신청되었습니다.");
            setApplyMessage("");
            setIsApplyModalOpen(false);
            closeModal();
        } catch (e) {
            console.error("스터디 신청 실패", e);
            alert("신청 중 오류가 발생했습니다.");
        }
    };


    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRoom(null);
    };

    const handleOpenCreateModal = () => {
        const accessToken = localStorage.getItem("accessToken");

        if (!accessToken) {
            alert("로그인 후 이용 가능합니다.");
            navigate("/auth"); // 또는 "/login"
            return;
        }

        setIsCreateModalOpen(true);
    };


    return (
        <>
            {/* ===== 헤더 ===== */}
            <header className="top-header">
                <div className="page-container header-inner">
                    <div className="header-logo">
                        <img
                            src={onsil}
                            alt="온실"
                            onClick={() => navigate("/")}
                            style={{ cursor: "pointer" }}
                        />
                    </div>

                    {nickname ? (
                        <div className="user-menu-wrapper">
                            <button
                                className="auth-btns"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsUserMenuOpen(prev => !prev);
                                }}
                            >
                                {nickname} 님 ▾
                            </button>

                            {isUserMenuOpen && (
                                <div className="user-dropdown" onClick={(e) => e.stopPropagation()}>
                                    <ul>
                                        <li onClick={() => navigate("/mypage")}>마이페이지</li>
                                        <li onClick={() => navigate("/lms")}>내 클래스</li>
                                        <li onClick={() => navigate("/my-applications")}>
                                            스터디 신청 현황
                                        </li>
                                        <li
                                            className="logout"
                                            onClick={() => {
                                                localStorage.clear();
                                                window.location.reload();
                                            }}
                                        >
                                            로그아웃
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            className="auth-btns"
                            onClick={() => navigate("/auth")}
                        >
                            로그인 / 회원가입
                        </button>
                    )}
                </div>
            </header>

            {/* ===== 대분류 ===== */}
            <nav className="main-category">
                <div className="page-container main-category-inner">
                    {mainCategories.map(cat => (
                        <button
                            key={cat}
                            className={cat === selectedMainCategory ? "active" : ""}
                            onClick={() => handleMainCategoryClick(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </nav>

            <div className="page-container">
                <div className="room-layout">
                    {/* ===== 왼쪽 카테고리 ===== */}
                    <aside className="category-sidebar">
                        <h3>자격증 카테고리</h3>

                        <input
                            type="text"
                            className="category-search"
                            placeholder="카테고리 검색"
                            value={categoryKeyword}
                            onChange={(e) => setCategoryKeyword(e.target.value)}
                        />

                        <ul>
                            {filteredCategoryTree.map(cat => (
                                <li key={cat.id}>
                                    <div
                                        className={`category-item ${
                                            selectedCategory === cat.name ? "active" : ""
                                        }`}
                                        onClick={() => {
                                            setSelectedCategory(cat.name);
                                            setSelectedSubCategory(null);
                                            setExpandedCategoryId(
                                                expandedCategoryId === cat.id ? null : cat.id
                                            );
                                            setCurrentPage(1);
                                        }}
                                    >
                                        {cat.name}
                                        {cat.children.length > 0 && (
                                            <span className="arrow">
                                                {expandedCategoryId === cat.id ? "▲" : "▼"}
                                            </span>
                                        )}
                                    </div>

                                    {expandedCategoryId === cat.id && cat.children.length > 0 && (
                                        <ul className="subcategory">
                                            {cat.children.map(sub => (
                                                <li
                                                    key={sub.id}
                                                    className={
                                                        selectedCategory === sub.name ? "active" : ""
                                                    }
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSubCategory(sub.name);
                                                        setCurrentPage(1);
                                                    }}
                                                >
                                                    └ {sub.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </aside>

                    {/* ===== 방 목록 ===== */}
                    <section className="room-content">
                        <div className="room-header">
                            <h2>
                                {selectedCategory === "전체(가나다순)"
                                    ? "전체 모집 스터디"
                                    : selectedSubCategory
                                        ? `${selectedCategory} - ${selectedSubCategory}`
                                        : selectedCategory}
                            </h2>
                            <button
                                className="create-btn"
                                onClick={handleOpenCreateModal}
                            >
                                스터디 만들기
                            </button>
                        </div>

                        <table className="room-table">
                            <thead>
                            <tr>
                                <th>번호</th>
                                <th>카테고리</th>
                                <th>제목</th>
                                <th>작성자</th>
                                <th>작성일</th>
                            </tr>
                            </thead>
                            <tbody>
                            {pagedRooms.map((room, index) => (
                                <tr key={room.id}>
                                    {/* 번호: 최신순 */}
                                    <td>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>

                                    {/* 카테고리 */}
                                    <td>
                                        {room.subCategoryName ?? room.midCategoryName}
                                    </td>

                                    {/* 제목 */}
                                    <td
                                        className="title"
                                        onClick={() => openModal(room)}
                                    >
                                        {room.title}
                                    </td>

                                    {/* 작성자 */}
                                    <td>{room.nickname}</td>

                                    {/* 작성일 */}
                                    <td>{room.createdAt?.slice(0, 10)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <div className="pagination">
                            <button
                                className="page-nav"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(1)}
                            >
                                «
                            </button>

                            <button
                                className="page-nav"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((prev) => prev - 1)}
                            >
                                ‹
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                                (page) => (
                                    <button
                                        key={page}
                                        className={page === currentPage ? "active" : ""}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                )
                            )}
                            <button
                                className="page-nav"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((prev) => prev + 1)}
                            >
                                ›
                            </button>

                            <button
                                className="page-nav"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(totalPages)}
                            >
                                »
                            </button>
                        </div>
                    </section>
                    {/* 모달 */}
                    {isModalOpen && selectedRoom && (
                        <div className="modal-overlay" onClick={closeModal}>
                            <div
                                className="modal-content"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {!isApplyModalOpen ? (
                                    <>
                                        {/* ===== 상세 화면 ===== */}
                                        <h3>{selectedRoom.title}</h3>

                                        <p>
                                            <strong>카테고리:</strong>{" "}
                                            {selectedRoom.subCategoryName ?? selectedRoom.midCategoryName}
                                        </p>

                                        <p>
                                            <strong>작성자:</strong> {selectedRoom.nickname}
                                        </p>

                                        <p>
                                            <strong>최대 인원:</strong> {selectedRoom.maxPeople}명
                                        </p>

                                        <p>
                                            <strong>성별 제한:</strong>{" "}
                                            {selectedRoom.gender === "ALL"
                                                ? "전체"
                                                : selectedRoom.gender === "FEMALE"
                                                    ? "여성"
                                                    : "남성"}
                                        </p>

                                        <pre className="modal-text">
  {selectedRoom.description}
</pre>

                                        <div className="modal-buttons">
                                            <button
                                                className="apply-btn"
                                                onClick={() => setIsApplyModalOpen(true)}
                                            >
                                                신청하기
                                            </button>
                                            <button className="close-btn" onClick={closeModal}>
                                                닫기
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* ===== 신청 화면 (덮어쓰기) ===== */}
                                        <h3>스터디 신청</h3>
                                        <h3>신청하는 스터디: {selectedRoom.title}</h3>

                                        <textarea className="applytext"
                                                  placeholder="간단한 자기소개 및 신청 메시지를 입력해주세요."
                                                  value={applyMessage}
                                                  onChange={(e) => setApplyMessage(e.target.value)}
                                        />

                                        <div className="modal-buttons">
                                            <button
                                                className="apply-btn"
                                                onClick={submitApply}
                                                disabled={!applyMessage.trim()}
                                            >
                                                신청하기
                                            </button>
                                            <button
                                                className="close-btn"
                                                onClick={() => setIsApplyModalOpen(false)}
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {isCreateModalOpen && (
                        <CreateRoom
                            onClose={() => {
                                setIsCreateModalOpen(false);
                                fetchRooms();
                            }}
                        />
                    )}

                </div>
            </div>
        </>
    );
};

export default RoomPage;