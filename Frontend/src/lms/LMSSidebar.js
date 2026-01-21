import "./LMSSidebar.css";
import { useNavigate, useParams } from "react-router-dom";

const LMSSidebar = ({ activeMenu, setActiveMenu }) => {
    const navigate = useNavigate();
    const { subjectId } = useParams();

    const go = (menu) => {
        setActiveMenu(menu);   // active 표시용
        navigate(`/lms/${subjectId}/${menu}`);  // ✅ URL 이동 (절대경로)
    };

    return (
        <aside className="subject-sidebar">
            <ul className="menu-list">
                <li
                    className={`menu-item ${activeMenu === "dashboard" ? "active" : ""}`}
                    onClick={() => go("dashboard")}
                >
                    대시보드
                </li>

                <li
                    className={`menu-item ${activeMenu === "attendance" ? "active" : ""}`}
                    onClick={() => go("attendance")}
                >
                    출석
                </li>

                <li
                    className={`menu-item ${activeMenu === "assignment" ? "active" : ""}`}
                    onClick={() => go("assignment")}
                >
                    과제
                </li>

                <li
                    className={`menu-item ${activeMenu === "board" ? "active" : ""}`}
                    onClick={() => go("board")}
                >
                    게시판
                </li>

                <li
                    className={`menu-item ${activeMenu === "calender" ? "active" : ""}`}
                    onClick={() => go("calender")}
                >
                    일정
                </li>
            </ul>

            <button
                className="meeting-btn"
                type="button"
                onClick={() => navigate("/meeting")}
            >
                화상 채팅방 입장하기
            </button>
        </aside>
    );
};

export default LMSSidebar;
