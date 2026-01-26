import { useNavigate } from "react-router-dom";
import "./LMSMain.css";

const ClassCard = ({ data }) => {
    const navigate = useNavigate();

    return (
        <div className="class-card">

            <img
                src={
                    data.roomImg
                        ? data.roomImg
                        : "/default.png"
                }
                alt={data.title}
                onError={(e) => {
                    e.target.src = "/default.png";
                }}
            />

            <div className="card-body">
                <div className="card-title">🎓 {data.title}</div>

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
