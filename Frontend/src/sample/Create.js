import React, { useEffect, useState } from "react";
import api from "../api/api";
import "./Create.css";
import {useLocation, useNavigate} from "react-router-dom";



const CreateRoom = () => {
    const navigate = useNavigate();
    const {pathname} = useLocation();
    console.log("현재 pathname:", pathname);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            alert("로그인이 필요한 페이지입니다.");
            navigate("/auth");
        }
    }, [navigate]);

    const [form, setForm] = useState({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        examDate: "",
        deadline: "",
        gender: "ALL",
        maxPeople: 4,
    });

    const [allCategories, setAllCategories] = useState([]);
    const [mainCategories, setMainCategories] = useState([]);
    const [midCategories, setMidCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    const [selectedMain, setSelectedMain] = useState(null);
    const [selectedMid, setSelectedMid] = useState(null);
    const [selectedSub, setSelectedSub] = useState(null);

    useEffect(() => {
        api.get("/category").then(res => setAllCategories(res.data));
        api.get("/category/main").then(res => setMainCategories(res.data));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: name === "maxPeople" ? Number(value) : value
        }));
    };

    const handleMainChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMain(id);
        setSelectedMid(null);
        setSelectedSub(null);
        setMidCategories([]);
        setSubCategories([]);

        if (!id) return;
        setMidCategories(allCategories.filter(c => c.level === 2 && c.parentId === id));
    };

    const handleMidChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMid(id);
        setSelectedSub(null);
        setSubCategories([]);

        if (!id) return;
        setSubCategories(allCategories.filter(c => c.level === 3 && c.parentId === id));
    };

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
            await api.post("/rooms", { ...form, categoryId });
            alert("스터디 그룹이 생성되었습니다!");
        } catch {
            alert("스터디 생성에 실패했습니다.");
        }
    };

    return (
        <div className="create-wrap">
            <h2 className="create-title">스터디 그룹 만들기</h2>

            {/* 🔽 하나의 섹션으로 통합 */}
            <div className="create-section">

                <p className="section-label">스터디 정보</p>
                <input
                    className="form-input"
                    name="studyLeaderNickname"
                    placeholder="스터디장 닉네임"
                    value={form.nickname}
                    onChange={handleChange}
                />

                <input
                    className="form-input"
                    name="title"
                    placeholder="스터디 그룹 이름"
                    value={form.title}
                    onChange={handleChange}
                />

                <textarea
                    className="form-textarea"
                    name="description"
                    placeholder="스터디 그룹 설명"
                    value={form.description}
                    onChange={handleChange}
                />
                <div className="create-inline">
                    <div>
                        <p className="section-label">스터디 시작일</p>
                        <input
                            className="study-start"
                            type="date"
                            name="startDate"
                            value={form.startDate}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <p className="section-label">스터디 종료일</p>
                        <input
                            className="study-end"
                            type="date"
                            name="endDate"
                            value={form.endDate}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <p className="section-label">시험일자</p>
                        <input
                            className="exam-date"
                            type="date"
                            name="exam-date"
                            value={form.examDate}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <p className="section-label">모집 마감일</p>
                        <input
                            className="deadline"
                            type="date"
                            name="deadline"
                            value={form.deadline}
                            onChange={handleChange}
                        />
                    </div>
                </div>


                <p className="section-label">카테고리</p>
                <select value={selectedMain ?? ""} onChange={handleMainChange}>
                    <option value="">대분류 선택</option>
                    {mainCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    value={selectedMid ?? ""}
                    onChange={handleMidChange}
                    disabled={!selectedMain}
                >
                    <option value="">중분류 선택</option>
                    {midCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    value={selectedSub ?? ""}
                    onChange={e => setSelectedSub(Number(e.target.value) || null)}
                    disabled={!selectedMid || subCategories.length === 0}
                >
                    <option value="">소분류 선택 (선택)</option>
                    {subCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <div className="create-inline">
                    <div>
                        <p className="section-label">최대 인원</p>
                        <select
                            name="maxPeople"
                            value={form.maxPeople}
                            onChange={handleChange}
                        >
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}명</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="section-label">성별 제한</p>

                        <div className="create-gender-group">
                            <span className="gender-label">성별</span>
                            {["ALL", "FEMALE", "MALE"].map(g => (
                                <label className="gender-radio" key={g}>
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
                    </div>

                </div>

            </div>

            <button className="create-submit" onClick={handleSubmit}>
                생성하기
            </button>
        </div>
    );
};

export default CreateRoom;
