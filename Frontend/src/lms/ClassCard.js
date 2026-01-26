import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./LMSMain.css";

const ClassCard = ({ data }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    return (
        <div className="class-card">
            <img
                src={data.roomImg || "/default.png"}
                alt={data.title}
                onError={(e) => (e.target.src = "/default.png")}
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
                    onClick={() => navigate(`/lms/${data.roomId}`)}
                >
                    클래스룸 들어가기
                </button>
            </div>
        </div>
    );
};

export default ClassCard;
