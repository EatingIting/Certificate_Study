import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./LMSMain.css";
import { toBackendUrl } from "../utils/backendUrl";

const ClassCard = ({ data }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    return (
        <div className="class-card">
            <img
                src={data.roomImg || "/default.jpg"}
                alt={data.title}
                onError={(e) => (e.target.src = "/default.jpg")}
            />

            <div className="card-body">
                <div className="card-title-row">
                    <div className="card-title">🎓 {data.title}</div>

                    <div className="dropdown-wrapper"
                         onMouseLeave={() => setOpen(false)}
                    >
                        <button
                            className="more-btn"
                            onClick={() => setOpen(!open)}
                        >
                            ⋮
                        </button>

                        {open && (
                            <div className="dropdown-menu">
                                <div className="exit">클래스 나가기</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card-date">{data.date}</div>

                <button
                    className="enter-btn"
                    onClick={() => {
                        // ✅ URL에 roomId(UUID) 사용 → /lms/UUID/...
                        // ✅ subjectId(숫자)도 세션에 저장 (백엔드 참조용)
                        if (data?.roomId) {
                            sessionStorage.setItem("lms.activeRoomId", data.roomId);
                            sessionStorage.setItem("lms.activeSubjectId", String(data.subjectId ?? ""));
                        }
                        navigate(`/lms/${data.roomId}`);
                    }}
                >
                    클래스룸 들어가기
                </button>
            </div>
        </div>
    );
};

export default ClassCard;
