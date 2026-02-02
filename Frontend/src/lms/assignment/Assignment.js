import {useEffect, useState} from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import { useRef } from "react";
import api from "../../api/api";

import "./Assignment.css";

const Assignment = () => {
    const [assignments, setAssignments] = useState([]);
    const { subjectId } = useParams();
    const roomId = subjectId;
    const userId = sessionStorage.getItem("userId");




    // ===== 제출 모달 =====
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [submitTitle, setSubmitTitle] = useState("");
    const [submitFile, setSubmitFile] = useState(null);
    const [submitMemo, setSubmitMemo] = useState("");

    const openSubmitModal = (assignment) => {
        setSelected(assignment);
        setSubmitTitle("");
        setSubmitFile(null);
        setSubmitMemo("");
        setIsModalOpen(true);
    };

    const closeSubmitModal = () => {
        setIsModalOpen(false);
        setSelected(null);
    };

    const onSubmit = async (e) => {
    e.preventDefault();

    if (!selected?.id) {
        alert("선택된 과제가 없습니다.");
        return;
    }

    try {
        const fd = new FormData();
        fd.append("userId", userId);
        fd.append("submitTitle", submitTitle);
        if (submitMemo) fd.append("memo", submitMemo);
        if (submitFile) fd.append("file", submitFile);

        await api.post(`/assignments/${selected.id}/submissions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        });

        closeSubmitModal();
        await fetchAssignments(); // 제출 후 상태(status) 갱신
        alert("제출이 완료되었습니다!");
    } catch (err) {
    console.error("CREATE ERROR:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        url: err.config?.baseURL + err.config?.url,
    });
    alert(`과제 생성 실패: ${err.response?.status || ""}`);
    }
    };


    // ===== 과제 생성 모달 =====
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createTitle, setCreateTitle] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [createDue, setCreateDue] = useState(""); // YYYY-MM-DD
    const dateRef = useRef(null);

    const openCreateModal = () => {
        setCreateTitle("");
        setCreateDesc("");
        setCreateDue("");
        setIsCreateOpen(true);
    };

    const closeCreateModal = () => {
        setIsCreateOpen(false);
    };

    const onCreate = async (e) => {
    e.preventDefault();

    try {
        // 백엔드 LocalDateTime이므로 "YYYY-MM-DDTHH:mm:ss" 형태로 맞춤
        const dueAt = `${createDue}T23:59:00`;

        // ✅ 백엔드 DTO가 createdByUserId 받는 버전 기준
        const payload = {
        title: createTitle,
        description: createDesc,
        dueAt,
        createdByUserId: userId,
        };

        const res = await api.post(`/rooms/${roomId}/assignments`, payload);

        // 생성 성공하면 목록 다시 불러오기
        closeCreateModal();
        await fetchAssignments();
        alert("과제가 생성되었습니다!");
    } catch (err) {
        console.error(err);
        alert("과제 생성 실패");
    }
    };

    const fetchAssignments = async () => {
        try {
            const res = await api.get(`/rooms/${roomId}/assignments`, {
            params: { userId },
            });

            const mapped = (res.data || []).map((x) => ({
            id: x.assignmentId,
            title: x.title,
            dueDate: x.dueAt ? x.dueAt.slice(0, 10) : "미정",
            // 작성자: 방별 닉네임(authorName) 우선, 없으면 email
            author: x.authorName || x.authorEmail,
            status: x.status,
            }));

            setAssignments(mapped);
        } catch (e) {
            console.error(e);
            alert("과제 목록 불러오기 실패");
        }
        };

        useEffect(() => {
        if (!roomId || !userId) return;
        fetchAssignments();
        }, [roomId, userId]);


    const [sp] = useSearchParams();

    useEffect(() => {
        if (sp.get("modal") === "create") {
            openCreateModal();
        }
        // eslint-disable-next-line
    }, [sp]);


    return (
        <div className="as-page">
            <div className="as-topbar">
                <button className="as-create-btn" type="button" onClick={openCreateModal}>
                    + 과제 생성
                </button>
            </div>

            <section className="as-card">
                <div className="as-card-header">
                    <div className="as-header-left">
                        <div className="as-icon" aria-hidden="true">
                            <img src="/assignment.png" alt="과제아이콘"/>
                        </div>

                        <div>
                            <h2 className="as-title">과제 목록</h2>
                            <p className="as-subtitle">
                                과제 제출 목록입니다. 기한을 확인하고 제출해주세요.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="as-card-body">
                    <div className="as-table-wrap">
                        <table className="as-table">
                            <thead>
                            <tr>
                                <th>과제명</th>
                                <th>제출 기한</th>
                                <th>작성자</th>
                                <th>상태</th>
                            </tr>
                            </thead>

                            <tbody>
                            {assignments.map((a) => (
                                <tr key={`${a.id}-${a.dueDate}`}>
                                    <td className="as-td-title">
                                        <Link className="as-link" to={`${a.id}`}>
                                            {a.title}
                                        </Link>
                                    </td>
                                    <td className="as-date">{a.dueDate}</td>
                                    <td>
                                        <div className="as-author">
                                            <span>{a.author}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {a.status === "제출 완료" ? (
                                            <span className="as-status as-status--done">{a.status}</span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="as-status as-status--todo"
                                                onClick={() => openSubmitModal(a)}
                                            >
                                                제출 하기
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ===== 과제 생성 모달 ===== */}
            {isCreateOpen && (
                <div className="as-modal-overlay" onClick={closeCreateModal} role="presentation">
                    <div className="as-modal as-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="as-modal-header as-create-header">
                            <div>
                                <h3 className="as-modal-title">과제 생성하기</h3>
                            </div>

                            <button className="as-modal-close" type="button" onClick={closeCreateModal}>
                                ✕
                            </button>
                        </div>

                        <form className="as-modal-body as-create-body" onSubmit={onCreate}>
                            <label className="as-field">
                                <span className="as-label">과제명</span>
                                <input
                                    className="as-input"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    placeholder="예) 2025 기출 #31~60 풀기"
                                    required
                                />
                            </label>

                            <label className="as-field">
                                <span className="as-label">설명</span>
                                <textarea
                                    className="as-textarea"
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    placeholder="과제에 대한 설명을 적어주세요"
                                    rows={4}
                                />
                            </label>

                            <label className="as-field">
                                <span className="as-label">마감 기한</span>

                                {/* input + 캘린더 아이콘 */}
                                <div
                                    className="as-date-wrap"
                                    onClick={() => {
                                        // 1) 포커스
                                        dateRef.current?.focus();

                                        // 2) 크롬/엣지 등 지원 브라우저에서 달력 강제 열기
                                        // (지원 안 되면 그냥 무시됨)
                                        if (dateRef.current?.showPicker) {
                                            dateRef.current.showPicker();
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            dateRef.current?.focus();
                                            dateRef.current?.showPicker?.();
                                        }
                                    }}
                                >
                                    <input
                                        ref={dateRef}
                                        className="as-input as-date-input"
                                        type="date"
                                        value={createDue}
                                        onChange={(e) => setCreateDue(e.target.value)}
                                        required
                                    />

                                    {/*<span className="as-date-icon" aria-hidden="true"></span>*/}
                                </div>
                            </label>

                            <div className="as-modal-actions as-create-actions">
                                <button type="button" className="as-cancel-btn" onClick={closeCreateModal}>
                                    취소
                                </button>
                                <button type="submit" className="as-primary-btn">
                                    생성
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== 과제 제출 모달(기존) ===== */}
            {isModalOpen && (
                <div className="as-modal-overlay" onClick={closeSubmitModal} role="presentation">
                    <div className="as-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="as-modal-header">
                            <div>
                                <h3 className="as-modal-title">과제 제출</h3>
                                <p className="as-modal-sub">
                                    과제 내용: {selected?.title} <br />
                                    마감: {selected?.dueDate}
                                </p>
                            </div>

                            <button className="as-modal-close" type="button" onClick={closeSubmitModal}>
                                ✕
                            </button>
                        </div>

                        <form className="as-modal-body" onSubmit={onSubmit}>
                            <label className="as-field">
                                <span className="as-label">제출 제목</span>
                                <input
                                    className="as-input"
                                    value={submitTitle}
                                    onChange={(e) => setSubmitTitle(e.target.value)}
                                    placeholder="예) 31~60 풀이 제출합니다"
                                    required
                                />
                            </label>

                            <label className="as-field">
                                <span className="as-label">파일 첨부</span>
                                <input
                                    className="as-file"
                                    type="file"
                                    onChange={(e) => setSubmitFile(e.target.files?.[0] || null)}
                                />
                            </label>

                            <label className="as-field">
                                <span className="as-label">메모</span>
                                <textarea
                                    className="as-textarea"
                                    value={submitMemo}
                                    onChange={(e) => setSubmitMemo(e.target.value)}
                                    placeholder="추가 설명이 있으면 적어주세요"
                                    rows={4}
                                />
                            </label>

                            <div className="as-modal-actions">
                                <button type="button" className="as-cancel-btn" onClick={closeSubmitModal}>
                                    취소
                                </button>
                                <button type="submit" className="as-primary-btn">
                                    제출
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Assignment;
