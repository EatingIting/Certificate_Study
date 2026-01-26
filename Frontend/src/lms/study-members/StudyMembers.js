import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./StudyMembers.css";

function StudyMembers() {
    let navigate = useNavigate();
    let { subjectId } = useParams();

    // ✅ (임시) 현재 로그인 유저 역할 (백엔드 붙이면 교체)
    let myRole = "OWNER"; // "OWNER" | "MEMBER"
    let isOwner = myRole === "OWNER";

    // ✅ (임시) 이미 승인 완료된 스터디룸 멤버 목록
    let [members, setMembers] = useState([
        { id: 1, name: "홍길동", email: "hong@test.com", role: "OWNER" },
        { id: 2, name: "김철수", email: "chul@test.com", role: "MEMBER" },
        { id: 3, name: "이영희", email: "young@test.com", role: "MEMBER" },
        { id: 4, name: "박민수", email: "minsu@test.com", role: "MEMBER" },
    ]);

    let [query, setQuery] = useState("");
    let [toast, setToast] = useState("");

    let filtered = useMemo(() => {
        let q = query.trim().toLowerCase();
        if (!q) return members;

        return members.filter((m) => {
            let name = (m.name || "").toLowerCase();
            let email = (m.email || "").toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [members, query]);

    let showToast = (msg) => {
        setToast(msg);
        window.setTimeout(() => setToast(""), 1500);
    };

    let confirmText = (msg) => window.confirm(msg);

    let promoteToOwner = (memberId) => {
        if (!isOwner) return;

        let target = members.find((m) => m.id === memberId);
        if (!target) return;
        if (target.role === "OWNER") return;

        let ok = confirmText(
            `정말 "${target.name}"님에게 방장 권한을 위임할까요?\n(현재 방장은 스터디원이 됩니다.)`
        );
        if (!ok) return;

        setMembers((prev) => {
            return prev.map((m) => {
                if (m.role === "OWNER") return { ...m, role: "MEMBER" };
                if (m.id === memberId) return { ...m, role: "OWNER" };
                return m;
            });
        });

        showToast("방장 권한을 위임했어요.");
    };

    let kickMember = (memberId) => {
        if (!isOwner) return;

        let target = members.find((m) => m.id === memberId);
        if (!target) return;

        if (target.role === "OWNER") {
            showToast("방장은 내보낼 수 없어요.");
            return;
        }

        let ok = confirmText(`정말 "${target.name}"님을 스터디룸에서 내보낼까요?`);
        if (!ok) return;

        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        showToast("스터디원을 내보냈어요.");
    };

    return (
        <div className="page smPage">
            <div className="smHead">
                <div className="smTitleRow">
                    <h1 className="pageTitle">스터디원 관리</h1>

                    <button
                        type="button"
                        className="smBackBtn"
                        onClick={() => navigate(`/lms/${subjectId}/dashboard`)}
                    >
                        대시보드로 →
                    </button>
                </div>

                <p className="pageSub">
                    방장은 스터디룸 멤버를 관리할 수 있습니다. (방장 위임 / 내보내기)
                </p>
            </div>

            {!isOwner && <div className="smGuard">방장만 접근할 수 있는 페이지입니다.</div>}

            {isOwner && (
                <div className="card smCard">
                    <div className="smCardHead">
                        <div className="smCardTitle">
                            멤버 목록 <span className="smCount">({members.length})</span>
                        </div>

                        <div className="smTools">
                            <input
                                className="smSearch"
                                placeholder="이름/이메일 검색"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="smTable">
                        <div className="smRow smRowHead smRowCols3">
                            <div>이름</div>
                            <div>이메일</div>
                            <div>권한</div>
                            <div className="smActionsCol">관리</div>
                        </div>

                        {filtered.length === 0 && <div className="smEmpty">검색 결과가 없습니다.</div>}

                        {filtered.map((m) => {
                            let isOwnerRow = m.role === "OWNER";

                            return (
                                <div key={m.id} className="smRow smRowCols3">
                                    <div className="smName">
                                        {m.name}
                                        {isOwnerRow && <span className="smBadgeOwner">방장</span>}
                                    </div>

                                    <div className="smEmail">{m.email}</div>

                                    <div>
                    <span className={`smRoleBadge ${isOwnerRow ? "owner" : "member"}`}>
                      {isOwnerRow ? "OWNER" : "MEMBER"}
                    </span>
                                    </div>

                                    <div className="smActionsCol">
                                        <button
                                            type="button"
                                            className="smGhostBtn"
                                            disabled={isOwnerRow}
                                            onClick={() => promoteToOwner(m.id)}
                                            title={isOwnerRow ? "이미 방장입니다" : "방장 위임"}
                                        >
                                            방장 위임
                                        </button>

                                        <button
                                            type="button"
                                            className="smDangerBtn"
                                            disabled={isOwnerRow}
                                            onClick={() => kickMember(m.id)}
                                            title={isOwnerRow ? "방장은 내보낼 수 없습니다" : "내보내기"}
                                        >
                                            내보내기
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="smFootNote">
                        ⚠️ 방장 위임/내보내기는 백엔드에서도 반드시 권한 체크(403)로 막아야 합니다.
                    </div>
                </div>
            )}

            {toast && <div className="smToast">{toast}</div>}
        </div>
    );
}

export default StudyMembers;
