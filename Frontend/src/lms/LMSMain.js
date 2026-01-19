import React from "react";
import LMSHeader from "./LMSHeader";
import ClassCard from "./ClassCard";
import "./LMSMain.css";

const LMSMain=()=>{
    const classList = [
        {
            id: 1,
            title: "정보처리기사",
            sub: "시험대비",
            date: "2024년 11월 15일 시작",
            image:
                "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
        },
        {
            id: 2,
            title: "토익",
            sub: "AI영어 D-12",
            date: "2024년 12월 15일 시작",
            image:
                "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
        },
    ];

    return(
        <>
            <LMSHeader/>
            <main className="lms-main">
                <h2 className="section-title">내 클래스룸</h2>

                <div className="class-grid">
                    {classList.map((item) => (
                        <ClassCard key={item.id} data={item} />
                    ))}
                </div>
            </main>
        </>
    )
}

export default LMSMain;