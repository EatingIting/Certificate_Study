import "./LMSSidebar.css";

const LMSSidebar = ({ activeMenu, setActiveMenu }) => {
    return (
        <aside className="subject-sidebar">
            <ul className="menu-list">
                <li
                    className={`menu-item ${activeMenu === "dashboard" ? "active" : ""}`}
                    onClick={() => setActiveMenu("dashboard")}
                >
                    대시보드
                </li>
                <li
                    className={`menu-item ${activeMenu === "attendance" ? "active" : ""}`}
                    onClick={() => setActiveMenu("attendance")}
                >
                    출석
                </li>
                <li
                    className={`menu-item ${activeMenu === "assignment" ? "active" : ""}`}
                    onClick={() => setActiveMenu("assignment")}
                >
                    과제
                </li>
                <li
                    className={`menu-item ${activeMenu === "board" ? "active" : ""}`}
                    onClick={() => setActiveMenu("board")}
                >
                    게시판
                </li>
            </ul>

            <button className="meeting-btn">
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
