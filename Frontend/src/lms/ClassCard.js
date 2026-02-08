import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import "./LMSMain.css";
import { toBackendUrl, getBackendOrigin } from "../utils/backendUrl";
import sampleImg from "../mainpage/sample.jpg";

const ClassCard = ({ data, loginUserEmail }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const dropdownRef = useRef(null);

    const isHost = data.isHost === 1;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    const handleEdit = async () => {
        try {
            setOpen(false); // 메뉴 닫기

            const res = await fetch(
                toBackendUrl(`/api/rooms/${data.roomId}`)
            );

            const studyData = await res.json();

            navigate("/room/create", {
                state: { study: studyData },
            });
        } catch (error) {
            console.error(error);
            alert("수정 페이지 이동 실패");
        }
    };

    const handleExit = async () => {
        const confirmText = prompt(
            "클래스를 나가려면 '클래스 삭제'를 입력하세요."
        );

        if (confirmText !== "클래스 삭제") {
            alert("입력이 일치하지 않습니다. 취소되었습니다.");
            return;
        }

        try {
            setOpen(false); // 메뉴 닫기

            await fetch(toBackendUrl(`/api/rooms/${data.roomId}`), {
                method: "DELETE",
            });

            alert("클래스가 삭제되었습니다.");

            sessionStorage.removeItem("lms.activeRoomId");
            sessionStorage.removeItem("lms.activeSubjectId");

            window.location.reload();
        } catch (error) {
            console.error(error);
            alert("클래스 삭제 실패");
        }
    };

    return (
        <div className="class-card">
            <img
                src={data.roomImg ? (data.roomImg.startsWith("http") ? data.roomImg : `${getBackendOrigin()}${data.roomImg}`) : sampleImg}
                alt={data.title}
                onError={(e) => (e.target.src = sampleImg)}
            />

            <div className="card-body">
                <div className="card-title-row">
                    <div className="lms-card-title">🎓 {data.title}</div>

                    {isHost && (
                        <div
                            className="dropdown-wrapper"
                            ref={dropdownRef}
                        >
                            <button
                                className="more-btn"
                                onClick={() => setOpen(!open)}
                            >
                                ⋮
                            </button>

                            {open && (
                                <div className="dropdown-menu">
                                    <div
                                        className="edit"
                                        onClick={handleEdit}
                                    >
                                        수정하기
                                    </div>

                                    <div
                                        className="exit"
                                        onClick={handleExit}
                                    >
                                        클래스 삭제
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="card-date">{data.date}</div>

                <button
                    className="enter-btn"
                    onClick={() => {
                        if (data?.roomId) {
                            sessionStorage.setItem(
                                "lms.activeRoomId",
                                data.roomId
                            );
                            sessionStorage.setItem(
                                "lms.activeSubjectId",
                                String(data.subjectId ?? "")
                            );
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
