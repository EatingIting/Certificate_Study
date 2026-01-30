// Attendance.js (완성본: 그대로 교체해서 사용)

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
        memberId: "m2",
        name: "손00",
        sessions: [
          { sessionNo: 1, joinAt: "2026-01-19T13:10:00", leaveAt: "2026-01-19T15:00:00" }, // 출석
          { sessionNo: 2, joinAt: "2026-01-26T13:30:00", leaveAt: "2026-01-26T14:30:00" }, // 결석
          { sessionNo: 3, joinAt: "2026-02-02T13:00:00", leaveAt: "2026-02-02T15:00:00" }, // 출석
          { sessionNo: 4, joinAt: "2026-02-09T13:05:00", leaveAt: "2026-02-09T14:59:00" }, // 출석
          { sessionNo: 5, joinAt: "2026-02-16T13:00:00", leaveAt: "2026-02-16T14:20:00" }, // 결석
          { sessionNo: 6, joinAt: "2026-02-23T13:00:00", leaveAt: "2026-02-23T15:00:00" }, // 출석
        ],
      },
    ],
    []
  );

  // ✅ 회차(세로형) rows 만들기 (현재는 members[0] = 내 데이터라고 가정)
  const sessionRows = useMemo(() => {
    const totalSessions = studySchedule.totalSessions;

    const my = members[0];
    const byNo = new Map((my?.sessions || []).map((s) => [s.sessionNo, s]));

    return Array.from({ length: totalSessions }).map((_, idx) => {
      const sessionNo = idx + 1;
      const log = byNo.get(sessionNo);

      const judged = log
        ? judgeAttendance(log, totalMin, studySchedule.requiredRatio)
        : { attendedMin: 0, ratio: 0, isPresent: false };

      const studyDate = log?.joinAt ? log.joinAt.slice(0, 10) : "-";

      return {
        sessionNo,
        studyDate,
        ...judged,
      };
    });
  }, [members, studySchedule.totalSessions, studySchedule.requiredRatio, totalMin]);

  // ✅ 요약(출석률/출석/결석/전체)
  const summary = useMemo(() => {
    const total = sessionRows.length;
    const present = sessionRows.filter((s) => s.isPresent).length;
    const absent = total - present;
    const ratio = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, absent, ratio };
  }, [sessionRows]);

  const [sp] = useSearchParams();
  const scope = sp.get("scope") || "all"; // my | all (나중 확장용)

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
                기준: 스터디 시간 중 {(studySchedule.requiredRatio * 100).toFixed(0)}% 이상 참여 시 출석 인정
              </p>
            </div>
          </div>

          <div className="at-header-actions">{/* 필요하면 버튼 추가 */}</div>
        </div>

        <div className="at-card-body">
          <div className="at-hint">
            <span className="at-chip at-chip--rule">
              기준: 참여시간/전체시간 ≥ {(studySchedule.requiredRatio * 100).toFixed(0)}%
            </span>
          </div>

          {/* ✅ 출석 요약(바 형태) */}
          <div className="at-summary">
            <div className="at-summary-item at-summary-item--wide">
              <div className="at-summary-head">
                <span className="at-summary-label">출석률</span>
                <span className="at-summary-count">
                  ({summary.present}/{summary.total})
                </span>
              </div>

              <div
                className="at-progressbar"
                role="progressbar"
                aria-valuenow={summary.ratio}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="at-progressbar-fill" style={{ width: `${summary.ratio}%` }} />
              </div>

              <div className="at-progressbar-sub">
                <span className="at-summary-value">{summary.ratio}%</span>
              </div>
            </div>

            <div className="at-summary-item at-summary-item--triple">
            <div className="at-summary-grid">
                <div>
                <span className="at-summary-label">전체</span>
                <span className="at-summary-big">{summary.total}회</span>
                </div>
                <div>
                <span className="at-summary-label">출석</span>
                <span className="at-summary-big is-ok">{summary.present}회</span>
                </div>
                <div>
                <span className="at-summary-label">결석</span>
                <span className="at-summary-big is-absent">{summary.absent}회</span>
                </div>
            </div>
            </div>

          </div>

          <div className="at-table-wrap">
            <table className="at-table">
              <thead>
                <tr>
                  <th className="at-th-sessionno">회차</th>
                  <th className="at-th-date">스터디일</th>
                  <th className="at-th-status">출석여부</th>
                </tr>
              </thead>

              <tbody>
                {sessionRows.map((s) => (
                  <tr key={s.sessionNo}>
                    <td className="at-td-sessionno">{s.sessionNo}회차</td>
                    <td className="at-td-date">{s.studyDate}</td>
                    <td className="at-td-status">
                      <span className={`at-badge ${s.isPresent ? "is-ok" : "is-absent"}`}>
                        {s.isPresent ? "출석" : "결석"}
                      </span>
                      <span className="at-td-muted">
                        ({s.attendedMin}분 · {Math.round(s.ratio * 100)}%)
                      </span>
                    </td>
                  </tr>
                ))}

                {sessionRows.length === 0 && (
                  <tr>
                    <td className="at-empty" colSpan={3}>
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
