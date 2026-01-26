import React, { useEffect, useState } from "react";
import ClassCard from "./ClassCard";
import api from "../api/api";
import "./LMSMain.css";
import {useNavigate} from "react-router-dom";

const LMSMain = () => {
    const [classList, setClassList] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
            alert("로그인이 필요한 페이지입니다.");
            navigate("/auth");
        }
    }, [navigate]);

    // ✅ 내 클래스룸 목록 불러오기
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


    return (
        <main className="lms-main">
            <h2 className="section-title">내 클래스룸</h2>

            <div className="class-grid">
                {classList.length > 0 ? (
                    classList.map((item) => (
                        <ClassCard key={item.roomId} data={item} />
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
