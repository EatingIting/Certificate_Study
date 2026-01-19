import { useState } from "react";
import "./Creat.css";

export default function CreateRoom() {
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
                    type="text"
                    name="title"
                    placeholder="방 제목"
                    value={form.title}
                    onChange={handleChange}
                    className="input"
                />

                <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="input"
                >
                    <option value="">카테고리 선택</option>
                    <option value="certificate">자격증</option>
                    <option value="exam">시험 대비</option>
                    <option value="language">어학</option>
                    <option value="etc">기타</option>
                </select>

                <textarea
                    name="description"
                    placeholder="방 상세설명"
                    value={form.description}
                    onChange={handleChange}
                    className="textarea"
                />

                <div className="gender-section">
                    <p>성별 여부</p>
                    <label>
                        <input
                            type="radio"
                            name="gender"
                            value="ALL"
                            checked={form.gender === "ALL"}
                            onChange={handleChange}
                        />
                        무관
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
                </div>

                <input
                    type="number"
                    name="maxPeople"
                    min={2}
                    max={20}
                    value={form.maxPeople}
                    onChange={handleChange}
                    className="input"
                    placeholder="인원 제한"
                />

                <button className="submit-btn" onClick={handleSubmit}>
                    등록하기 (방장에겐 수정하기)
                </button>
            </div>
        </div>
    );
}
