import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/api";
import "./StudyMembers.css";

function StudyMembers() {
    let navigate = useNavigate();
    let { subjectId } = useParams(); // = roomId 로 사용

    // ✅ 서버에서 받아올 상태
    let [myRole, setMyRole] = useState(""); // "OWNER" | "MEMBER"
    let [members, setMembers] = useState([]);
    let [query, setQuery] = useState("");
    let [toast, setToast] = useState("");
    let [loading, setLoading] = useState(false);
    let [guardMsg, setGuardMsg] = useState("");

    let isOwner = myRole === "OWNER";

    // ✅ 안정성: 언마운트/요청 레이스/토스트 타이머 방지
    let isMountedRef = useRef(false);
    let requestSeqRef = useRef(0);
    let toastTimerRef = useRef(null);

    let filtered = useMemo(() => {
        let q = query.trim().toLowerCase();
        if (!q) return members;

        return members.filter((m) => {
            let name = (m.name || "").toLowerCase();
            let nick = (m.nickname || "").toLowerCase();
            let email = (m.email || "").toLowerCase();
            return name.includes(q) || nick.includes(q) || email.includes(q);
        });
    }, [members, query]);

    let showToast = (msg) => {
        setToast(msg);

        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }

        toastTimerRef.current = window.setTimeout(() => {
            if (isMountedRef.current) setToast("");
        }, 1500);
    };

    let confirmText = (msg) => window.confirm(msg);

    // 실명 마스킹: "김철재" → "김*재" (첫 글자 + * + 마지막 글자)
    let maskName = (str) => {
        if (!str || typeof str !== "string") return "";
        let s = str.trim();
        if (s.length <= 1) return "*";
        if (s.length === 2) return s[0] + "*";
        return s[0] + "*" + s[s.length - 1];
    };

    // 표시용: "닉네임(김*재)" 형식 (닉네임 없으면 마스킹된 이름만)
    let displayMemberName = (m) => {
        let nick = (m.nickname || "").trim();
        let real = (m.name || "").trim();
        let masked = maskName(real || nick);
        if (real) return nick ? `${nick}(${masked})` : masked;
        return nick || masked || "-";
    };

    // ✅ 목록 조회
    let fetchMembers = async () => {
        let seq = ++requestSeqRef.current;

        setLoading(true);
        setGuardMsg("");

        try {
            // baseURL = http://localhost:8080/api
            // => 여기서는 /rooms/... 만 적어야 함
            let res = await api.get(`/rooms/${subjectId}/participants`);

            if (!isMountedRef.current) return;
            if (seq !== requestSeqRef.current) return;

            let data = res.data || {};
            setMyRole(data.myRole || "");
            setMembers(Array.isArray(data.participants) ? data.participants : []);
        } catch (err) {
            if (!isMountedRef.current) return;
            if (seq !== requestSeqRef.current) return;

            let status = err?.response?.status;

            if (status === 403) {
                setMyRole("MEMBER");
                setMembers([]);
                setGuardMsg("스터디원만 접근할 수 있는 페이지입니다.");
            } else if (status === 401) {
                setGuardMsg("로그인이 필요합니다. 다시 로그인해주세요.");
            } else if (status === 404) {
                setGuardMsg("스터디룸을 찾을 수 없습니다.");
            } else {
                setGuardMsg("멤버 목록을 불러오지 못했습니다.");
            }
        } finally {
            if (!isMountedRef.current) return;
            if (seq !== requestSeqRef.current) return;

            setLoading(false);
        }
    };

    // ✅ 방장 위임
    let promoteToOwner = async (memberId) => {
        if (!isOwner) return;

        let target = members.find((m) => m.id === memberId);
        if (!target) return;
        if (target.role === "OWNER") return;

        let ok = confirmText(
            `정말 "${displayMemberName(target)}"님에게 스터디장 권한을 위임할까요?\n(현재 스터디장은 스터디원이 됩니다.)`
        );
        if (!ok) return;

        try {
            await api.patch(`/rooms/${subjectId}/participants/owner`, {
                targetUserId: memberId,
            });

            showToast("스터디장 권한을 위임했어요.");
            await fetchMembers();
        } catch (err) {
            let msg = err?.response?.data?.message;
            showToast(msg || "스터디장 위임에 실패했어요.");
        }
    };

    // ✅ 내보내기(강퇴)
    let kickMember = async (memberId) => {
        if (!isOwner) return;

        let target = members.find((m) => m.id === memberId);
        if (!target) return;

        if (target.role === "OWNER") {
            showToast("스터디장은 내보낼 수 없어요.");
            return;
        }

        let ok = confirmText(`정말 "${displayMemberName(target)}"님을 스터디룸에서 내보낼까요?`);
        if (!ok) return;

        try {
            // axios.delete는 body를 config.data로 넣음
            await api.delete(`/rooms/${subjectId}/participants`, {
                data: { targetUserId: memberId },
            });

            showToast("스터디원을 내보냈어요.");
            await fetchMembers();
        } catch (err) {
            let msg = err?.response?.data?.message;
            showToast(msg || "내보내기에 실패했어요.");
        }
    };

    // ✅ 최초 로딩
    useEffect(() => {
        isMountedRef.current = true;
        fetchMembers();

        return () => {
            isMountedRef.current = false;

            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId]);

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
                    참여 중인 스터디원 목록을 확인하고, 스터디장 위임이나 내보내기로 관리할 수 있습니다.
                </p>
            </div>

            {/* 로딩 */}
            {loading && <div className="smGuard">불러오는 중...</div>}

            {/* 에러 가드 */}
            {!loading && guardMsg && <div className="smGuard">{guardMsg}</div>}

            {/* 스터디원 전체: 방장 포함 모든 멤버 목록 (스터디 소속이면 조회 가능) */}
            {!loading && !guardMsg && (
                <div className="card smCard">
                    <div className="smCardHead">
                        <div className="smCardTitle">
                            멤버 목록 <span className="smCount">(방장 포함 {members.length}명)</span>
                        </div>

                        <div className="smTools">
                            <input
                                className="smSearch"
                                placeholder="닉네임/이메일 검색"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="smTable">
                        <div className={`smRow smRowHead ${isOwner ? "smRowCols3" : "smRowCols3NoActions"}`}>
                            <div>이름</div>
                            <div>이메일</div>
                            <div>권한</div>
                            {isOwner && <div className="smActionsCol">관리</div>}
                        </div>

                        {filtered.length === 0 && <div className="smEmpty">검색 결과가 없습니다.</div>}

                        {filtered.map((m) => {
                            let isOwnerRow = m.role === "OWNER";

                            return (
                                <div key={m.id} className={`smRow ${isOwner ? "smRowCols3" : "smRowCols3NoActions"}`}>
                                    <div className="smName">
                                        {displayMemberName(m)}
                                        {isOwnerRow && <span className="smBadgeOwner">스터디장</span>}
                                    </div>

                                    <div className="smEmail">{m.email}</div>

                                    <div>
                                        <span
                                            className={`smRoleBadge ${isOwnerRow ? "owner" : "member"
                                                }`}
                                        >
                                            {isOwnerRow ? "OWNER" : "MEMBER"}
                                        </span>
                                    </div>

                                    {isOwner && (
                                        <div className="smActionsCol">
                                            <button
                                                type="button"
                                                className="smGhostBtn"
                                                disabled={isOwnerRow}
                                                onClick={() => promoteToOwner(m.id)}
                                                title={isOwnerRow ? "이미 스터디장입니다" : "방장 위임"}
                                            >
                                                방장 위임
                                            </button>

                                            <button
                                                type="button"
                                                className="smDangerBtn"
                                                disabled={isOwnerRow}
                                                onClick={() => kickMember(m.id)}
                                                title={isOwnerRow ? "스터디장은 내보낼 수 없습니다" : "내보내기"}
                                            >
                                                내보내기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {toast && <div className="smToast">{toast}</div>}
        </div>
    );
}

export default StudyMembers;
