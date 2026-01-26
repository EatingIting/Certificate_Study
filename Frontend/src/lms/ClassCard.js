import { useNavigate } from "react-router-dom";
import "./LMSMain.css";
import { toBackendUrl } from "../utils/backendUrl";

const ClassCard = ({ data }) => {
    const navigate = useNavigate();

    return (
        <div className="class-card">

            {/* ✅ 이미지 출력 */}
            <img
                src={
                    data.roomImg
                        ? toBackendUrl(data.roomImg)
                        : "/default.png"
                }
                alt={data.title}
            />

            <div className="card-body">
                <div className="card-title">🎓 {data.title}</div>

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
