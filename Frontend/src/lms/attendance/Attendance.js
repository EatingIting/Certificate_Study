import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import "./Attendance.css";

/**
 * ✅ 나중에 백엔드에서 이런 형태로 내려주면 제일 편함(추천)
 *
 * studySchedule: {
 *   dayOfWeek: 1, // Monday
 *   start: "13:00",
 *   end: "15:00",
 *   requiredRatio: 0.9
 * }
 *
 * attendanceLogs: [
 *  {
 *    memberId: "m1",
 *    name: "김00",
 *    sessions: [
 *      { sessionNo: 1, joinAt: "2026-01-19T13:02:00", leaveAt: "2026-01-19T15:00:00" },
 *      { sessionNo: 2, joinAt: "2026-01-26T13:10:00", leaveAt: "2026-01-26T14:10:00" },
 *      ...
 *    ]
 *  },
 * ]
 *
 * 프론트는 session별로 "참여시간" 계산 -> 출석/결석 판정만 하면 됨.
 */

// ------- utils -------
const toMs = (iso) => {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const minutesBetween = (startIso, endIso) => {
    const s = toMs(startIso);
    const e = toMs(endIso);
    if (!s || !e || e <= s) return 0;
    return Math.floor((e - s) / 60000);
};

const calcTotalMinutes = (startHHMM, endHHMM) => {
    const [sh, sm] = startHHMM.split(":").map(Number);
    const [eh, em] = endHHMM.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return Math.max(0, end - start);
};

const judgeAttendance = ({ joinAt, leaveAt }, totalMin, requiredRatio) => {
    const attendedMin = minutesBetween(joinAt, leaveAt);
    const ratio = totalMin === 0 ? 0 : attendedMin / totalMin;
    const isPresent = ratio >= requiredRatio;
    return { attendedMin, ratio, isPresent };
};

const Attendance = () => {
    // ✅ 스터디 시간/기준(백엔드에서 내려줄 값)
    const studySchedule = useMemo(
        () => ({
            start: "13:00",
            end: "15:00",
            requiredRatio: 0.9, // 90%
            totalSessions: 6,
        }),
        []
    );

    const totalMin = useMemo(
        () => calcTotalMinutes(studySchedule.start, studySchedule.end),
        [studySchedule.start, studySchedule.end]
    );

    // ✅ 데모용 로그(백엔드 붙이면 이 구조로 그대로 갈아끼우면 됨)
    const members = useMemo(
        () => [
            {
                memberId: "m1",
                name: "김00",
                sessions: [
                    { sessionNo: 1, joinAt: "2026-01-19T13:00:00", leaveAt: "2026-01-19T15:00:00" }, // 120/120 출석
                    { sessionNo: 2, joinAt: "2026-01-26T13:05:00", leaveAt: "2026-01-26T14:58:00" }, // 113/120 출석(94%)
                    { sessionNo: 3, joinAt: "2026-02-02T13:20:00", leaveAt: "2026-02-02T14:50:00" }, // 90/120 결석(75%)
                    { sessionNo: 4, joinAt: "2026-02-09T13:00:00", leaveAt: "2026-02-09T15:00:00" },
                    { sessionNo: 5, joinAt: "2026-02-16T13:10:00", leaveAt: "2026-02-16T15:00:00" }, // 110/120 출석(91.6%)
                    { sessionNo: 6, joinAt: "2026-02-23T13:00:00", leaveAt: "2026-02-23T13:40:00" }, // 40/120 결석
                ],
            },
            {
                memberId: "m2",
                name: "손00",
                sessions: [
                    { sessionNo: 1, joinAt: "2026-01-19T13:10:00", leaveAt: "2026-01-19T15:00:00" }, // 110/120 출석
                    { sessionNo: 2, joinAt: "2026-01-26T13:30:00", leaveAt: "2026-01-26T14:30:00" }, // 60/120 결석
                    { sessionNo: 3, joinAt: "2026-02-02T13:00:00", leaveAt: "2026-02-02T15:00:00" },
                    { sessionNo: 4, joinAt: "2026-02-09T13:05:00", leaveAt: "2026-02-09T14:59:00" }, // 출석
                    { sessionNo: 5, joinAt: "2026-02-16T13:00:00", leaveAt: "2026-02-16T14:20:00" }, // 결석
                    { sessionNo: 6, joinAt: "2026-02-23T13:00:00", leaveAt: "2026-02-23T15:00:00" },
                ],
            },
        ],
        []
    );

    // ✅ 화면용으로 가공
    const viewRows = useMemo(() => {
        const totalSessions = studySchedule.totalSessions;

        return members.map((m) => {
            // sessionNo 기반으로 빈칸 없이 배열로 정렬(백엔드에서 누락 와도 안전)
            const byNo = new Map(m.sessions.map((s) => [s.sessionNo, s]));

            const sessionsView = Array.from({ length: totalSessions }).map((_, idx) => {
                const sessionNo = idx + 1;
                const log = byNo.get(sessionNo);

                // 미체크는 이번 요구사항에서 제외라서, 로그 없으면 결석 처리(정책 선택)
                // 원하면 여기서 "결석"이 아니라 "-" 처리도 가능하지만, 너가 미체크 빼달라고 해서 결석으로 통일
                const judged = log
                    ? judgeAttendance(log, totalMin, studySchedule.requiredRatio)
                    : { attendedMin: 0, ratio: 0, isPresent: false };

                return {
                    sessionNo,
                    ...judged,
                };
            });

            const presentCount = sessionsView.filter((s) => s.isPresent).length;
            const absentCount = totalSessions - presentCount;

            // 점수 예시(원하면 삭제 가능): 출석 20점 만점, 결석 1회당 -3점
            const score = Math.max(0, 20 - absentCount * 3);

            const ratioOverall = Math.round((presentCount / totalSessions) * 100);

            return {
                memberId: m.memberId,
                name: m.name,
                sessionsView,
                presentCount,
                absentCount,
                score,
                ratioOverall,
            };
        });
    }, [members, studySchedule.totalSessions, studySchedule.requiredRatio, totalMin]);

    const [sp] = useSearchParams();
    const scope = sp.get("scope") || "all"; // my | all


    return (
        <div className="at-page">
            <section className="at-card">
                <div className="at-card-header">
                    <div className="at-header-left">
                        <div className="at-icon" aria-hidden="true">
                                <img src="/calendar.png" alt="출석" />
                        </div>

                        <div>
                            <h2 className="at-title">출석</h2>
                            <p className="at-subtitle">
                                기준: 스터디 시간 중{" "}
                                {(studySchedule.requiredRatio * 100).toFixed(0)}% 이상 참여 시 출석 인정
                            </p>
                        </div>
                    </div>

                    <div className="at-header-actions">

                    </div>
                </div>

                <div className="at-card-body">
                    <div className="at-hint">
                        <span className="at-chip at-chip--ok">○ 출석</span>
                        <span className="at-chip at-chip--absent">× 결석</span>
                        <span className="at-chip at-chip--rule">
                            기준: 참여시간/전체시간 ≥ {(studySchedule.requiredRatio * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="at-table-wrap">
                        <table className="at-table">
                            <thead>
                            <tr>
                                <th className="at-th-name">이름</th>
                                <th className="at-th-att">출석률</th>
                                <th className="at-th-num">결석</th>
                                <th className="at-th-num">출석</th>
                                {Array.from({ length: studySchedule.totalSessions }).map((_, i) => (
                                    <th key={i} className="at-th-session">
                                        {i + 1}
                                    </th>
                                ))}
                            </tr>
                            </thead>

                            <tbody>
                            {viewRows.map((r) => (
                                <tr key={r.memberId}>
                                    <td className="at-td-name">
                                        <div className="at-person">
                                            <span className="at-name">{r.name}</span>
                                        </div>
                                    </td>

                                    <td className="at-td-att">
                                        <div className="at-progress">
                                            <div className="at-bar">
                                                <div className="at-bar-fill" style={{ width: `${r.ratioOverall}%` }} />
                                            </div>
                                            <span className="at-progress-text">
                          ({r.presentCount}/{studySchedule.totalSessions})
                        </span>
                                        </div>
                                    </td>

                                    <td className="at-td-num">{r.absentCount}</td>
                                    <td className="at-td-num">{r.score}</td>

                                    {r.sessionsView.map((s) => (
                                        <td key={s.sessionNo} className="at-td-session">
                        <span
                            className={`at-mark ${s.isPresent ? "is-ok" : "is-absent"}`}
                            title={`${s.attendedMin}분 참여 (${Math.round(s.ratio * 100)}%)`}
                        >
                          {s.isPresent ? "○" : "×"}
                        </span>
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {viewRows.length === 0 && (
                                <tr>
                                    <td className="at-empty" colSpan={4 + studySchedule.totalSessions}>
                                        출석 데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Attendance;
