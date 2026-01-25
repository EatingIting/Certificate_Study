import React, { useEffect, useState } from "react";
import api from "../../api/api";
import "./Create.css";
import { useLocation, useNavigate } from "react-router-dom";

const CreateRoom = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const editStudy = location.state?.study;
    const isEditMode = !!editStudy;

    useEffect(() => {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
            alert("로그인이 필요한 페이지입니다.");
            navigate("/auth");
        }
    }, [navigate]);

    const [form, setForm] = useState({
        hostUserNickname: "",
        title: "",
        content: "",
        startDate: "",
        endDate: "",
        examDate: "",
        deadline: "",
        gender: "ALL",
        maxParticipants: 4,
    });


    const [studyImage, setStudyImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");

    const [allCategories, setAllCategories] = useState([]);
    const [mainCategories, setMainCategories] = useState([]);
    const [midCategories, setMidCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    const [selectedMain, setSelectedMain] = useState(null);
    const [selectedMid, setSelectedMid] = useState(null);
    const [selectedSub, setSelectedSub] = useState(null);


    const [editCategoryId, setEditCategoryId] = useState(null);

    useEffect(() => {
        api.get("/category").then((res) => setAllCategories(res.data));
        api.get("/category/main").then((res) => setMainCategories(res.data));
    }, []);

    /* 입력값 변경 */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: name === "maxParticipants" ? Number(value) : value,
        }));
    };


    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStudyImage(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    /* 카테고리 변경 */
    const handleMainChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMain(id);
        setSelectedMid(null);
        setSelectedSub(null);
        setMidCategories([]);
        setSubCategories([]);

        if (!id) return;

        setMidCategories(
            allCategories.filter((c) => c.level === 2 && c.parentId === id)
        );
    };

    const handleMidChange = (e) => {
        const id = Number(e.target.value) || null;
        setSelectedMid(id);
        setSelectedSub(null);
        setSubCategories([]);

        if (!id) return;

        setSubCategories(
            allCategories.filter((c) => c.level === 3 && c.parentId === id)
        );
    };

    const toDateInputValue = (value) => {
        if (!value) return "";
        return value.substring(0, 10);
    };

    useEffect(() => {
        if (!isEditMode || allCategories.length === 0) return;

        setForm({
            hostUserNickname:
                editStudy.hostUserNickname ?? editStudy.nickname ?? "",
            title: editStudy.title,
            content: editStudy.content,
            startDate: toDateInputValue(editStudy.startDate),
            endDate: toDateInputValue(editStudy.endDate),
            examDate: toDateInputValue(editStudy.examDate),
            deadline: toDateInputValue(editStudy.deadline),
            gender: editStudy.gender,
            maxParticipants: editStudy.maxParticipants,
        });

        let categoryId = editStudy.categoryId;

        if (editStudy.roomImg) {
            setPreviewUrl(`http://localhost:8080${editStudy.roomImg}`);
        }

        if (!categoryId) {
            const matched = allCategories.find(
                (c) =>
                    c.name === editStudy.subCategoryName ||
                    c.name === editStudy.midCategoryName
            );
            if (matched) categoryId = matched.id;
        }

        setEditCategoryId(categoryId);
    }, [isEditMode, allCategories, editStudy]);

    /* ===========================
       ✅ categoryId 기반 main/mid/sub 선택
    =========================== */
    useEffect(() => {
        if (!editCategoryId) return;

        const current = allCategories.find((c) => c.id === editCategoryId);
        if (!current) return;

        if (current.level === 3) {
            const mid = allCategories.find((c) => c.id === current.parentId);
            const main = allCategories.find((c) => c.id === mid.parentId);

            setSelectedMain(main.id);
            setSelectedMid(mid.id);
            setSelectedSub(current.id);
        }

        if (current.level === 2) {
            const main = allCategories.find((c) => c.id === current.parentId);

            setSelectedMain(main.id);
            setSelectedMid(current.id);
            setSelectedSub(null);
        }
    }, [editCategoryId]);

    /* ===========================
       ✅ main 선택되면 mid 목록 자동 로딩
    =========================== */
    useEffect(() => {
        if (!selectedMain) return;

        setMidCategories(
            allCategories.filter((c) => c.level === 2 && c.parentId === selectedMain)
        );
    }, [selectedMain]);

    /* ===========================
       ✅ mid 선택되면 sub 목록 자동 로딩
    =========================== */
    useEffect(() => {
        if (!selectedMid) return;

        setSubCategories(
            allCategories.filter((c) => c.level === 3 && c.parentId === selectedMid)
        );
    }, [selectedMid]);

    /* 제출 */
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

        /* ✅ FormData 생성 */
        const formData = new FormData();

        Object.entries(form).forEach(([key, value]) => {
            formData.append(key, value);
        });

        formData.append("categoryId", categoryId);

        /* ✅ 이미지 포함 */
        if (studyImage) {
            formData.append("image", studyImage);
        }

        try {
            if (isEditMode) {
                await api.put(`/rooms/${editStudy.roomId}`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                alert("스터디가 수정되었습니다!");
            } else {
                await api.post("/rooms", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                alert("스터디 그룹이 생성되었습니다!");
            }

            navigate("/room");
        } catch {
            alert("스터디 저장에 실패했습니다.");
        }
    };

    return (
        <div className="create-wrap">
            <h2 className="create-title">
                {isEditMode ? "스터디 수정하기" : "스터디 그룹 만들기"}
            </h2>

            <div className="create-section">
                <p className="section-label">스터디 정보</p>

                <input
                    className="form-input"
                    name="hostUserNickname"
                    placeholder="스터디장 닉네임"
                    value={form.hostUserNickname}
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
                    name="content"
                    placeholder="스터디 그룹 설명"
                    value={form.content}
                    onChange={handleChange}
                />

                {/* ✅ 스터디 사진 첨부 */}
                <div className="study-image-upload">
                    <p className="section-label">스터디 사진 첨부</p>

                    <input
                        className="form-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                    />

                    {/* 미리보기 */}
                    {previewUrl && (
                        <div className="image-preview">
                            <img src={previewUrl} alt="스터디 사진 미리보기" />
                        </div>
                    )}
                </div>

                {/* 날짜 */}
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
                            name="examDate"
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

                {/* 카테고리 */}
                <p className="section-label">카테고리</p>

                <select value={selectedMain ?? ""} onChange={handleMainChange}>
                    <option value="">대분류 선택</option>
                    {mainCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedMid ?? ""}
                    onChange={handleMidChange}
                    disabled={!selectedMain}
                >
                    <option value="">중분류 선택</option>
                    {midCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <select
                    value={selectedSub ?? ""}
                    onChange={(e) => setSelectedSub(Number(e.target.value) || null)}
                    disabled={!selectedMid || subCategories.length === 0}
                >
                    <option value="">소분류 선택 (선택)</option>
                    {subCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                {/* 인원 + 성별 */}
                <div className="create-inline">
                    <div>
                        <p className="section-label">최대 인원</p>
                        <select
                            name="maxParticipants"
                            value={form.maxParticipants}
                            onChange={handleChange}
                        >
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                    {n}명
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="section-label">성별 제한</p>

                        <div className="create-gender-group">
                            <span className="gender-label">성별</span>
                            {["ALL", "FEMALE", "MALE"].map((g) => (
                                <label className="gender-radio" key={g}>
                                    <input
                                        type="radio"
                                        name="gender"
                                        value={g}
                                        checked={form.gender === g}
                                        onChange={handleChange}
                                    />
                                    {g === "ALL"
                                        ? "전체"
                                        : g === "FEMALE"
                                            ? "여자"
                                            : "남자"}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <button className="create-submit" onClick={handleSubmit}>
                {isEditMode ? "수정하기" : "생성하기"}
            </button>
        </div>
    );
};

export default CreateRoom;
