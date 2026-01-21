import { useEffect, useState } from "react";
import api from "../api/api";
import "./Create.css";

const CreateRoom = ({ onClose }) => {
    const [form, setForm] = useState({
        title: "",
        description: "",
        gender: "ALL",
        maxPeople: 4,
    });

    /* ===== 카테고리 상태 ===== */
    const [allCategories, setAllCategories] = useState([]);
    const [mainCategories, setMainCategories] = useState([]);
    const [midCategories, setMidCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    const [selectedMain, setSelectedMain] = useState(null);
    const [selectedMid, setSelectedMid] = useState(null);
    const [selectedSub, setSelectedSub] = useState(null);

    /* ===== 공통 입력 ===== */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: name === "maxPeople" ? Number(value) : value
        }));
    };

    /* ===== 카테고리 전체 로딩 ===== */
    useEffect(() => {
        api.get("/category").then(res => {
            setAllCategories(res.data);
        });

        api.get("/category/main").then(res => {
            setMainCategories(res.data);
        });
    }, []);

    /* ===== 대분류 선택 ===== */
    const handleMainChange = (e) => {
        const mainId = Number(e.target.value) || null;

        setSelectedMain(mainId);
        setSelectedMid(null);
        setSelectedSub(null);
        setSubCategories([]);
        setMidCategories([]);

        if (!mainId) return;

        const mids = allCategories.filter(
            c => c.level === 2 && c.parentId === mainId
        );
        setMidCategories(mids);
    };

    /* ===== 중분류 선택 ===== */
    const handleMidChange = (e) => {
        const midId = Number(e.target.value) || null;

        setSelectedMid(midId);
        setSelectedSub(null);
        setSubCategories([]);

        if (!midId) return;

        const subs = allCategories.filter(
            c => c.level === 3 && c.parentId === midId
        );
        setSubCategories(subs);
    };

    /* ===== 생성 ===== */
    const handleSubmit = async () => {
        if (!form.title.trim()) {
            alert("스터디 그룹 이름을 입력해주세요");
            return;
        }

        const categoryId = selectedSub ?? selectedMid;

        if (!categoryId) {
            alert("카테고리를 선택해주세요");
            return;
        }

        try {
            await api.post("/rooms", {
                title: form.title,
                description: form.description,
                gender: form.gender,
                maxPeople: form.maxPeople,
                categoryId
            });

            alert("스터디 그룹이 생성되었습니다!");
            onClose();
        } catch (error) {
            console.error("스터디 생성 실패:", error);
            alert("스터디 생성에 실패했습니다.");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-room-box" onClick={(e) => e.stopPropagation()}>
                <h2 className="title">스터디 그룹 만들기</h2>

                <input
                    className="input"
                    name="title"
                    placeholder="스터디 그룹 이름"
                    value={form.title}
                    onChange={handleChange}
                />

                <textarea
                    className="textarea"
                    name="description"
                    placeholder="스터디 그룹 설명"
                    value={form.description}
                    onChange={handleChange}
                />

                {/* ===== 카테고리 ===== */}
                <div className="category-section">
                    <p>카테고리</p>

                    {/* 대분류 */}
                    <select value={selectedMain ?? ""} onChange={handleMainChange}>
                        <option value="">대분류 선택</option>
                        {mainCategories.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    {/* 중분류 */}
                    <select
                        value={selectedMid ?? ""}
                        onChange={handleMidChange}
                        disabled={!selectedMain}
                    >
                        <option value="">중분류 선택</option>
                        {midCategories.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    {/* 소분류 */}
                    <select
                        value={selectedSub ?? ""}
                        onChange={(e) => setSelectedSub(Number(e.target.value) || null)}
                        disabled={!selectedMid || subCategories.length === 0}
                    >
                        <option value="">소분류 선택 (없으면 생략)</option>
                        {subCategories.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ===== 최대 인원 ===== */}
                <div className="people-section">
                    <p>최대 인원</p>
                    <select name="maxPeople" value={form.maxPeople} onChange={handleChange}>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>
                                {num}명
                            </option>
                        ))}
                    </select>
                </div>

                {/* ===== 성별 ===== */}
                <div className="gender-section">
                    <p>성별 제한</p>
                    {["ALL", "FEMALE", "MALE"].map(g => (
                        <label key={g} className="gender-radio">
                            <input
                                type="radio"
                                name="gender"
                                value={g}
                                checked={form.gender === g}
                                onChange={handleChange}
                            />
                            {g === "ALL" ? "전체" : g === "FEMALE" ? "여자" : "남자"}
                        </label>
                    ))}
                </div>

                <div className="modal-buttons">
                    <button className="submit-btn" onClick={handleSubmit}>
                        생성하기
                    </button>
                    <button className="submit-close-btn" onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateRoom;
