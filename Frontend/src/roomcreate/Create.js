import { useState, useRef } from "react";
import "./Create.css";

export default function CreateRoom() {
    const selectRef = useRef(null);

    const [form, setForm] = useState({
        title: "",
        category: "",
        description: "",
        gender: "ALL",
        maxPeople: 4,
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = () => {
        if (!form.title.trim()) {
            alert("방 제목을 입력해주세요");
            return;
        }

        console.log("방 생성 데이터:", form);
        alert("방이 생성되었습니다!");
    };

    return (
        <div className="create-room-container">
            <div className="create-room-box">
                <h2 className="title">방 만들기</h2>

                <input
                    className="input"
                    name="title"
                    placeholder="방 제목"
                    value={form.title}
                    onChange={handleChange}
                />

                <input
                    className="input"
                    name="category"
                    placeholder="카테고리 (예: 토익, 정보처리기사)"
                    value={form.category}
                    onChange={handleChange}
                />

                <textarea
                    className="textarea"
                    name="description"
                    placeholder="방 설명"
                    value={form.description}
                    onChange={handleChange}
                />

                {/* 인원 설정 */}
                <div className="people-section" style={{ position: "relative" }}>
                    <p>최대 인원</p>

                    <select
                        ref={selectRef}
                        className="select"
                        name="maxPeople"
                        value={form.maxPeople}
                        onChange={handleChange}
                    >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                            (num) => (
                                <option key={num} value={num}>
                                    {num}명
                                </option>
                            )
                        )}
                    </select>

                    <span
                        onMouseDown={(e) => {
                            e.preventDefault();
                            selectRef.current?.click();
                        }}
                        style={{
                            position: "absolute",
                            right: "16px",
                            top: "50%",
                            transform: "translateY(6px)",
                            cursor: "pointer",
                        }}
                    >
                        ˅
                    </span>
                </div>

                {/* 성별 */}
                <div className="gender-section">
                    <p>성별 제한</p>
                    <div className="gender-options">
                        <label>
                            <input
                                type="radio"
                                name="gender"
                                value="ALL"
                                checked={form.gender === "ALL"}
                                onChange={handleChange}
                            />
                            전체
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="gender"
                                value="FEMALE"
                                checked={form.gender === "FEMALE"}
                                onChange={handleChange}
                            />
                            여자
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="gender"
                                value="MALE"
                                checked={form.gender === "MALE"}
                                onChange={handleChange}
                            />
                            남자
                        </label>
                    </div>
                </div>

                <button className="submit-btn" onClick={handleSubmit}>
                    방 생성하기
                </button>
            </div>
        </div>
    );
}
