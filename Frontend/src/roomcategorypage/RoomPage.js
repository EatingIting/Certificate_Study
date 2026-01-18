import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "./RoomPage.css";

const mainCategories = [
    "전체",
    "기능장",
    "기사",
    "산업기사",
    "기능사",
    "외국어",
    "공무원",
    "민간자격"
];

const categories = [
    "전체(가나다순)",
    "기능장",
    "기사",
    "산업기사",
    "기능사",
    "컴퓨터활용능력",
    "워드프로세서",
    "한국사능력검정시험",
    "PSAT",
    "경찰공무원",
    "계리직공무원",
    "관세사",
    "소방공무원",
    "법무부",
    "운전면허",
    "비서",
    "유통관리사",
    "공인중개사",
    "주택관리사보",
    "사회복지사",
    "세무 및 회계",
    "한국정보통신자격협회",
    "PC정비사",
    "네트워크관리사",
    "리눅스마스터",
    "인터넷보안전문가",
    "인터넷정보관리사",
    "ERP 정보관리사",
    "대학수학능력시험",
    "바리스타",
    "전자상거래",
    "디지털영상편집",
    "DIAT",
    "IoT관련",
    "RFID",
    "기타",
];

const rooms = Array.from({ length: 27 }, (_, i) => ({
    roomId: i + 1,
    category: categories[(i % (categories.length - 1)) + 1],
    title: `자격증스터디그룹ABCDEFGHIJKLMNOP모집글 ${i + 1}`,
    author: `user${i + 1}`,
    date: "2026.01.14",
    content: `매주 2회 스터디 진행합니다.
꾸준히 참여 가능하신 분 환영합니다.`,
}));

const ITEMS_PER_PAGE = 7;

const RoomPage = () => {
    const navigate = useNavigate();
    const [selectedMainCategory, setSelectedMainCategory] = useState("전체");
    const [selectedCategory, setSelectedCategory] =
        useState("전체(가나다순)");
    const [categoryKeyword, setCategoryKeyword] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedRoom, setSelectedRoom] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [applyMessage, setApplyMessage] = useState("");

    /* 카테고리 필터 */
    const filteredRooms =
        selectedCategory === "전체(가나다순)"
            ? rooms
            : rooms.filter((room) => room.category === selectedCategory);

    /* 왼쪽 카테고리 검색 */
    const filteredCategories = categories.filter((cat) => {
        if (!categoryKeyword) return true; // 검색 안 할 때만 전체 표시
        if (cat === "전체(가나다순)") return false;
        return cat
            .toLowerCase()
            .includes(categoryKeyword.toLowerCase());
    });

    const handleCategoryClick = (category) => {
        setSelectedCategory(category);
        setCurrentPage(1);
    };

    /* 페이지네이션 */
    const totalPages = Math.ceil(
        filteredRooms.length / ITEMS_PER_PAGE
    );

    const pagedRooms = filteredRooms.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const openModal = (room) => {
        setSelectedRoom(room);
        setIsModalOpen(true);
    };

    const handleApply = () => {
        setIsApplyModalOpen(true);
    };

    const submitApply = () => {
        alert("스터디에 신청되었습니다.");
        setApplyMessage("");
        setIsApplyModalOpen(false);
        closeModal(); // 상세 모달까지 같이 닫기
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRoom(null);
    };

    return (
        <>
            {/* ===== 상단 헤더 ===== */}
            <header className="top-header">
                <div className="page-container header-inner">
                    <div className="logo">로고</div>
                    <button className="auth-btns"  onClick={() => navigate("/auth")}>로그인 / 회원가입</button>
                </div>
            </header>

            <nav className="main-category">
                <div className="page-container main-category-inner">
                    {mainCategories.map((cat) => (
                        <button
                            key={cat}
                            className={cat === selectedMainCategory ? "active" : ""}
                            onClick={() => {
                                setSelectedMainCategory(cat);
                                setSelectedCategory("전체(가나다순)");
                                setCurrentPage(1);
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </nav>

            <div className="page-container">
                <div className="room-layout">
                    {/* 왼쪽 카테고리 */}
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
                            {filteredCategories.length === 0 ? (
                                <li className="no-category">검색 결과 없음</li>
                            ) : (
                                filteredCategories.map((cat) => (
                                    <li
                                        key={cat}
                                        className={cat === selectedCategory ? "active" : ""}
                                        onClick={() => {
                                            setSelectedCategory(cat);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        {cat}
                                    </li>
                                ))
                            )}
                        </ul>
                    </aside>

                    {/* 오른쪽 방 목록 */}
                    <section className="room-content">
                        <div className="room-header">
                            <h2>
                                {selectedCategory === "전체(가나다순)"
                                    ? "전체 모집 방"
                                    : selectedCategory}
                            </h2>
                            <button className="create-btn">스터디 만들기</button>
                        </div>

                        <table className="room-table">
                            <colgroup>
                                <col style={{ width: "60px" }} />   {/* 번호 */}
                                <col style={{ width: "180px" }} />  {/* 카테고리 */}
                                <col style={{ width: "300px" }} />  {/* 제목 */}
                                <col style={{ width: "180px" }} />  {/* 작성자 */}
                                <col style={{ width: "110px" }} />  {/* 작성일 */}
                            </colgroup>
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
                            {pagedRooms.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty">
                                        모집 중인 방이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                pagedRooms.map((room) => (
                                    <tr key={room.roomId}>
                                        <td>{room.roomId}</td>
                                        <td
                                            className="category"
                                            onClick={() => handleCategoryClick(room.category)}
                                        >
                                            {room.category}
                                        </td>
                                        <td
                                            className="title"
                                            onClick={() => openModal(room)}
                                        >
                                            {room.title}
                                        </td>
                                        <td>{room.author}</td>
                                        <td>{room.date}</td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>

                        {/* 페이지네이션 */}
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
                                        <p><strong>카테고리:</strong> {selectedRoom.category}</p>
                                        <p><strong>스터디장:</strong> {selectedRoom.author}</p>
                                        <pre className="modal-text">
                                {selectedRoom.content}
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

                </div>
            </div>
        </>
    );
};

export default RoomPage;
