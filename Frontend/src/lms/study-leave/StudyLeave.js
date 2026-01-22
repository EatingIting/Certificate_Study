import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./StudyLeave.css";

function StudyLeave() {
    let navigate = useNavigate();

    // ✅ (임시) 내 역할 - 백엔드 붙이면 교체
    let myRole = "OWNER"; // "OWNER" | "MEMBER"
    let isMember = myRole === "MEMBER";

    // ✅ (임시) 현재 스터디 이름 (백엔드 붙이면 subjectId로 조회해서 가져오면 됨)
    let studyName = "온실 스터디룸";

    let [password, setPassword] = useState("");
    let [typedStudyName, setTypedStudyName] = useState("");
    let [error, setError] = useState("");
    let [isSubmitting, setIsSubmitting] = useState(false);

    let isStudyNameMatched = useMemo(() => {
        return typedStudyName.trim() === studyName.trim();
    }, [typedStudyName, studyName]);

    let canSubmit = useMemo(() => {
        return password.trim().length > 0 && isStudyNameMatched && !isSubmitting;
    }, [password, isStudyNameMatched, isSubmitting]);

    let onSubmit = async () => {
        if (!password.trim()) {
            setError("비밀번호를 입력해 주세요.");
            return;
        }

        if (!isStudyNameMatched) {
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
            // TODO: 백엔드 연결 시 탈퇴 API 호출
            // POST /api/studies/{subjectId}/leave
            // body: { password }
            // (studyName은 프론트에서 검증용으로만 쓰고 서버는 subjectId로 처리하면 됨)

            window.alert("탈퇴 처리(임시) 완료: 백엔드 연결 후 실제 탈퇴로 변경하세요.");
            navigate("/lmsMain", { replace: true });
        } catch (e) {
            setError("탈퇴 처리에 실패했습니다. 비밀번호를 확인해 주세요.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page slPage">
            <div className="card slCard">
                <div className="slHead">
                    <h1 className="pageTitle">스터디 탈퇴</h1>
                    <p className="pageSub">
                        탈퇴하면 이 스터디룸의 게시판/일정/과제/출석 등을 더 이상 이용할 수 없습니다.
                    </p>
                </div>

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
                                />
                            </label>

                            <label className="slField">
                                <div className="slLabel">스터디 이름 입력</div>
                                <input
                                    type="text"
                                    className={`slInput ${typedStudyName.length > 0 ? (isStudyNameMatched ? "ok" : "bad") : ""}`}
                                    value={typedStudyName}
                                    onChange={(e) => {
                                        setTypedStudyName(e.target.value);
                                        if (error) setError("");
                                    }}
                                    placeholder={`"${studyName}" 를 입력하세요`}
                                />
                                <div className="slHint">
                                    정확히 <b>{studyName}</b> 를 입력해야 탈퇴할 수 있습니다.
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
