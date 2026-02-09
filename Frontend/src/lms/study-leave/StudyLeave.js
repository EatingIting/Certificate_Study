// StudyLeave.js (UI=StudyLeave1 그대로 + 로직=StudyLeave2 적용)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/api"; // ✅ 프로젝트 경로에 맞게 유지/수정
import "./StudyLeave.css";

function StudyLeave() {
    let navigate = useNavigate();
    let { subjectId } = useParams(); // = roomId

    // ✅ 서버에서 받아올 상태
    let [loading, setLoading] = useState(true);
    let [guardMsg, setGuardMsg] = useState("");
    let [myRole, setMyRole] = useState(""); // "OWNER" | "MEMBER" | ""
    let [studyName, setStudyName] = useState(""); // 확인용(가능하면 서버에서 받아옴)

    // ✅ 입력 상태 (UI는 1번 그대로)
    let [password, setPassword] = useState("");
    let [typedStudyName, setTypedStudyName] = useState("");
    let [error, setError] = useState("");
    let [isSubmitting, setIsSubmitting] = useState(false);

    let isOwner = myRole === "OWNER";
    let isMember = myRole === "MEMBER";

    let isStudyNameMatched = useMemo(() => {
        // studyName을 못 받아왔을 때도 있을 수 있으니, 그 경우에는 매칭을 강제하지 않음(UX만 유지)
        if (!(studyName || "").trim()) return typedStudyName.trim().length > 0;
        return typedStudyName.trim() === studyName.trim();
    }, [typedStudyName, studyName]);

    let canSubmit = useMemo(() => {
        return password.trim().length > 0 && isStudyNameMatched && !isSubmitting;
    }, [password, isStudyNameMatched, isSubmitting]);

    async function fetchContext() {
        setLoading(true);
        setGuardMsg("");
        setError("");

        try {
            let res = await api.get(`/rooms/${subjectId}/context`);
            let data = res.data || {};

            setMyRole(data.myRole || "");

            // room name 후보들(프로젝트별 필드 차이 대응)
            let nameCandidate =
                data.studyName ||
                data.roomName ||
                data.name ||
                data.title ||
                (data.room && (data.room.name || data.room.roomName)) ||
                "";

            // 못 받으면 빈 값으로 두고(입력 검증은 약화됨), placeholder에만 subjectId를 사용
            setStudyName(nameCandidate || "");
        } catch (err) {
            let status = err?.response?.status;

            if (status === 401) setGuardMsg("로그인이 필요합니다.");
            else if (status === 404) setGuardMsg("스터디룸을 찾을 수 없습니다.");
            else setGuardMsg("정보를 불러오지 못했습니다.");

            setMyRole("");
        } finally {
            setLoading(false);
        }
    }

    let onSubmit = async () => {
        if (isSubmitting) return;

        // 방장 탈퇴 불가
        if (isOwner) {
            setError("방장은 탈퇴할 수 없습니다. (방장 위임이 필요합니다.)");
            return;
        }

        if (!password.trim()) {
            setError("비밀번호를 입력해 주세요.");
            return;
        }

        // studyName을 못 받아온 경우는 강제 매칭을 약하게 처리했지만,
        // studyName이 있다면 정확히 입력하도록 유지(원본 UI 의도)
        if ((studyName || "").trim() && !isStudyNameMatched) {
            setError(`스터디 이름을 정확히 입력해 주세요. (정확히: "${studyName}")`);
            return;
        }

        let ok = window.confirm(
            "정말 스터디를 탈퇴하시겠습니까?\n탈퇴 후에는 다시 가입할 수 없습니다."
        );
        if (!ok) return;

        setIsSubmitting(true);
        setError("");

        try {
            // ✅ 1) 비밀번호 검증 먼저
            await api.post(`/rooms/${subjectId}/participants/me/verify-password`, {
                password: password.trim(),
            });

            // ✅ 2) 검증 성공하면 탈퇴 실행
            await api.delete(`/rooms/${subjectId}/participants/me`);

            window.alert("탈퇴가 완료되었습니다.");
            navigate("/room/mystudy", { replace: true });
        } catch (err) {
            let status = err?.response?.status;

            if (status === 401) setError("로그  인이 필요합니다.");
            else if (status === 403) setError("권한이 없습니다.");
            else if (status === 400) {
                // ✅ 400은 전부 "비밀번호 틀림"으로 통일
                let msg = "비밀번호가 일치하지 않습니다.";
                setError(msg);
                window.alert(msg);
            } else {
                setError("탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            }
        }
    };

    useEffect(() => {
        fetchContext();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId]);

    // ✅ UI 구조는 StudyLeave1 그대로 유지하되, loading/guard 처리만 추가
    if (loading) {
        return (
            <div className="page slPage">
                <div className="card slCard">
                    <div className="slGuard">불러오는 중...</div>
                </div>
            </div>
        );
    }

    if (guardMsg) {
        return (
            <div className="page slPage">
                <div className="card slCard">
                    <div className="slGuard">{guardMsg}</div>
                    <div className="slActions">
                        <button
                            type="button"
                            className="slBtn slBtnGhost"
                            onClick={() => navigate(-1)}
                        >
                            돌아가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page slPage">
            <div className="card slCard">
                <div className="slHead">
                    <h1 className="pageTitle">스터디 탈퇴</h1>
                    <p className="pageSub">
                        탈퇴하면 이 스터디룸의 게시판/일정/과제/출석 등을 더 이상 이용할 수 없습니다.
                    </p>
                </div>

                {/* ✅ 원본과 동일: 멤버만 가능 / 방장은 가드 */}
                {!isMember && (
                    <div className="slGuard">
                        스터디원만 탈퇴할 수 있습니다. (방장은 먼저 방장 위임이 필요합니다.)
                    </div>
                )}

                {isMember && (
                    <div className="slStack">
                        {/* ✅ 주의사항 먼저 */}
                        <div className="slNotice">
                            <div className="slInfoTitle">주의사항</div>

                            <ul className="slInfoList">
                                <li>탈퇴 후에는 이 스터디룸에 접근할 수 없습니다.</li>
                                <li>탈퇴 후에는 다시 가입할 수 없습니다.</li>
                                <li>탈퇴는 되돌릴 수 없으니 신중하게 진행해 주세요.</li>
                            </ul>

                            <div className="slInfoBox">
                                실수 방지를 위해 <b>비밀번호</b>와 <b>스터디 이름</b> 입력이 필요합니다.
                            </div>
                        </div>

                        {/* ✅ 입력 폼 */}
                        <div className="slForm">
                            <label className="slField">
                                <div className="slLabel">비밀번호 확인</div>
                                <input
                                    type="password"
                                    className="slInput"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError("");
                                    }}
                                    placeholder="비밀번호를 입력하세요"
                                    autoFocus
                                    autoComplete="current-password"
                                />
                            </label>

                            <label className="slField">
                                <div className="slLabel">스터디 이름 입력</div>
                                <input
                                    type="text"
                                    className={`slInput ${
                                        typedStudyName.length > 0 ? (isStudyNameMatched ? "ok" : "bad") : ""
                                    }`}
                                    value={typedStudyName}
                                    onChange={(e) => {
                                        setTypedStudyName(e.target.value);
                                        if (error) setError("");
                                    }}
                                    placeholder={
                                        (studyName || "").trim()
                                            ? `"${studyName}" 를 입력하세요`
                                            : `"스터디(${subjectId})" 를 입력하세요`
                                    }
                                />
                                <div className="slHint">
                                    {(studyName || "").trim() ? (
                                        <>
                                            정확히 <b>{studyName}</b> 를 입력해야 탈퇴할 수 있습니다.
                                        </>
                                    ) : (
                                        <>스터디 이름을 불러오지 못해도 입력 후 진행할 수 있습니다.</>
                                    )}
                                </div>
                            </label>

                            {error && <div className="slError">{error}</div>}

                            <div className="slActions">
                                <button
                                    type="button"
                                    className="slBtn slBtnGhost"
                                    disabled={isSubmitting}
                                    onClick={() => navigate(-1)}
                                >
                                    돌아가기
                                </button>

                                <button
                                    type="button"
                                    className="slBtn slBtnDanger"
                                    disabled={!canSubmit}
                                    onClick={onSubmit}
                                >
                                    {isSubmitting ? "처리 중..." : "탈퇴하기"}
                                </button>
                            </div>

                            {!canSubmit && (
                                <div className="slMiniWarn">
                                    비밀번호 입력 + 스터디 이름을 정확히 입력해야 탈퇴 버튼이 활성화됩니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StudyLeave;