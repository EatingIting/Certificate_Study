import React, { useEffect, useState } from "react";
import ClassCard from "./ClassCard";
import api from "../api/api";
import "./LMSMain.css";
import { useNavigate } from "react-router-dom";
import { useLMS } from "./LMSContext";

const LMSMain = () => {
    const [classList, setClassList] = useState([]);
    const navigate = useNavigate();
    const { user, email, loading } = useLMS();

    // ProtectedRoute에서 이미 인증 체크를 하므로 여기서는 제거
    // useEffect는 유지하되, ProtectedRoute가 먼저 체크함

    useEffect(() => {
        api.get("/classrooms/my")
            .then((res) => {
                setClassList(res.data);
            })
            .catch((err) => {
                console.error("클래스룸 불러오기 실패", err);
            });
    }, []);

    console.log("classList:", classList, "type:", typeof classList, "isArray:", Array.isArray(classList));
    console.log("사용자 정보:", user);


    return (
        <main className="lms-main">
            <h2 className="section-title">내 클래스룸</h2>

            <div className="class-grid">
                {classList.length > 0 ? (
                    classList.map((item) => (
                        <ClassCard
                            key={item.roomId}
                            data={item}
                            loginUserEmail={email || ""}
                        />
                    ))
                ) : (
                    <p style={{ marginTop: "20px", color: "gray" }}>
                        아직 승인된 클래스룸이 없습니다.
                    </p>
                )}
            </div>
        </main>
    );
};

export default LMSMain;
