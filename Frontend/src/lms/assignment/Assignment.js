import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import api from "../../api/api";
import "./Assignment.css";

const Assignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [matrix, setMatrix] = useState({ assignments: [], members: [] });

  const { subjectId } = useParams();
  const roomId = subjectId;

  // ===== 제출 모달 =====
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitMemo, setSubmitMemo] = useState("");

const openSubmitModal = (assignment) => {
  setSelected(assignment);

  // ✅ 기존 값이 있으면 보여주기 (없으면 빈칸)
  setSubmitTitle(assignment?.submitTitle || "");
  setSubmitMemo(assignment?.memo || "");

  // 파일은 보안상 input에 미리 채울 수 없어서 null 유지가 정상
  setSubmitFile(null);

  setIsModalOpen(true);
};


  const closeSubmitModal = () => {
    setIsModalOpen(false);
    setSelected(null);
  };

  // ===== 과제 생성 모달 =====
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDue, setCreateDue] = useState("");
  const dateRef = useRef(null);

  const openCreateModal = () => {
    setCreateTitle("");
    setCreateDesc("");
    setCreateDue("");
    setIsCreateOpen(true);
  };
  const closeCreateModal = () => setIsCreateOpen(false);

  // ✅ 과제 목록 불러오기
  const fetchAssignments = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/assignments`);

      const mapped = (res.data || []).map((x) => ({
        id: x.assignmentId,
        title: x.title,
        dueDate: x.dueAt ? x.dueAt.slice(0, 10) : "미정",
        author: x.authorEmail,
        status: x.status,
      }));

      setAssignments(mapped);
    } catch (e) {
      console.error("ASSIGNMENTS ERROR:", e);
      alert("과제 목록 불러오기 실패");
    }
  };

  // ✅ 팀원 제출현황(매트릭스) 불러오기
  const fetchMatrix = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/assignments/submission-matrix`);
      setMatrix(res.data || { assignments: [], members: [] });
    } catch (e) {
      console.error("MATRIX ERROR:", {
        status: e.response?.status,
        data: e.response?.data,
        url: e.config?.baseURL + e.config?.url,
      });
      // 페이지에서 항상 보일거라 alert는 취향. 일단 주석 추천
      // alert("제출 현황 불러오기 실패");
      setMatrix({ assignments: [], members: [] });
    }
  };

  // ✅ 페이지 들어오면 둘 다 불러오기
  useEffect(() => {
    if (!roomId) return;
    fetchAssignments();
    fetchMatrix();
  }, [roomId]);

  // ✅ 과제 제출
  const onSubmit = async (e) => {
    e.preventDefault();

    if (!selected?.id) {
      alert("선택된 과제가 없습니다.");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("submitTitle", submitTitle);
      if (submitMemo) fd.append("memo", submitMemo);
      if (submitFile) fd.append("file", submitFile);

      await api.post(`/assignments/${selected.id}/submissions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeSubmitModal();
      await fetchAssignments();
      await fetchMatrix(); // ✅ 제출 후 매트릭스도 갱신
      alert("제출이 완료되었습니다!");
    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      alert(`과제 제출 실패: ${err.response?.status || ""}`);
    }
  };

  // ✅ 과제 생성
  const onCreate = async (e) => {
    e.preventDefault();

    try {
      const dueAt = `${createDue}T23:59:00`;
      const payload = { title: createTitle, description: createDesc, dueAt };

      await api.post(`/rooms/${roomId}/assignments`, payload);

      closeCreateModal();
      await fetchAssignments();
      await fetchMatrix(); // ✅ 생성 후 매트릭스도 갱신
      alert("과제가 생성되었습니다!");
    } catch (err) {
      console.error("CREATE ERROR:", err);
      alert("과제 생성 실패");
    }
  };

  const [sp] = useSearchParams();
  useEffect(() => {
    if (sp.get("modal") === "create") openCreateModal();
    // eslint-disable-next-line
  }, [sp]);

  const totalAssignments = matrix.assignments?.length || 0;

  return (
    <div className="as-page">
      <div className="as-topbar">
        <button className="as-create-btn" type="button" onClick={openCreateModal}>
          + 과제 생성
        </button>
      </div>


    <section className="as-card as-matrix-card">
    <div className="as-card-header">
        <div className="as-header-left">
        <div>
            <h2 className="as-title">팀원별 과제 제출 현황</h2>
            <p className="as-subtitle">과제별 제출 여부를 한눈에 확인할 수 있습니다.</p>
        </div>
        </div>
    </div>

    <div className="as-card-body">
        <div className="as-table-wrap">
        <table className="as-table as-matrix-table">
            <thead>
            <tr>
                <th className="as-mx-name">이름</th>

                {(matrix.assignments || []).map((a) => (
                <th key={a.assignmentId} className="as-mx-col" title={a.title}>
                    {a.title}
                </th>
                ))}

            </tr>
            </thead>

            <tbody>
            {(matrix.members || []).map((m) => (
                <tr key={m.userId}>
                <td className="as-mx-name">{m.name}</td>

                {(m.submissions || []).map((s) => {
                const ok = s.submitted ?? s.isSubmitted; // ✅ 백엔드가 submitted로 내려줌(지금 케이스)

                return (
                    <td key={s.assignmentId} className="as-mx-cell">
                    <span
                        className={`as-mx-mark ${ok ? "is-ok" : "is-no"}`}
                        title={
                        ok
                            ? `제출됨${s.submittedAt ? ` (${s.submittedAt})` : ""}`
                            : "미제출"
                        }
                    >
                        {ok ? "○" : "×"}
                        {/* 제출이면 0으로 표시하고 싶으면: {ok ? "0" : "×"} */}
                    </span>
                    </td>
                );
                })}

                </tr>
            ))}

            {(matrix.members || []).length === 0 && (
                <tr>
                <td
                    className="as-empty"
                    colSpan={1 + (matrix.assignments?.length || 0)}
                >
                    제출 현황 데이터가 없습니다.
                </td>
                </tr>
            )}
            </tbody>
        </table>
        </div>
    </div>
    </section>

      {/* 기존 과제 목록 카드 */}
      <section className="as-card">
        <div className="as-card-header">
          <div className="as-header-left">
            <div className="as-icon" aria-hidden="true">
              <img src="/assignment.png" alt="과제아이콘" />
            </div>
            <div>
              <h2 className="as-title">과제 목록</h2>
              <p className="as-subtitle">과제 제출 목록입니다. 기한을 확인하고 제출해주세요.</p>
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
                  <th>제출</th>
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
                        <span className="as-status as-status--done">제출됨</span>
                      ) : (
                        <span className="as-status as-status--todo">미제출</span>
                      )}
                    </td>
                    <td>
                     {a.status === "제출 완료" ? (
                      <button
                        type="button"
                        className="as-status as-action-btn"
                        onClick={() => openSubmitModal(a)}
                        title="제출 내용을 수정합니다"
                      >
                        수정하기
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="as-status as-action-btn"
                        onClick={() => openSubmitModal(a)}
                        title="과제를 제출합니다"
                      >
                        제출하기
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
          <div
            className="as-modal as-create-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
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
                <div
                  className="as-date-wrap"
                  onClick={() => {
                    dateRef.current?.focus();
                    dateRef.current?.showPicker?.();
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

      {/* ===== 과제 제출 모달 ===== */}
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
                <input className="as-file" type="file" onChange={(e) => setSubmitFile(e.target.files?.[0] || null)} />
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
