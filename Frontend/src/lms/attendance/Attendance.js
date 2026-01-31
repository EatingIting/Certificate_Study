import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../../api/api";

import "./Attendance.css";

/**
 * ✅ 백엔드에서 이런 형태로 내려주면 제일 편함(추천)
 *
 * {
 *   studySchedule: { start, end, requiredRatio, totalSessions },
 *   attendanceLogs: [
 *     {
 *       memberId: "user@email.com",
 *       name: "닉네임(김***)",
 *       sessions: [
 *         { sessionNo: 1, studyDate: "2026-01-19", joinAt: "...", leaveAt: "..." },
 *         ...
 *       ]
 *     }
 *   ]
 * }
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
  if (!startHHMM || !endHHMM) return 0;
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
  const { subjectId } = useParams();
  const [sp] = useSearchParams();
  const scope = sp.get("scope") || "my"; // my | all

  // ✅ 백엔드에서 내려줄 값(기본값)
  const [studySchedule, setStudySchedule] = useState({
    start: "00:00",
    end: "00:00",
    requiredRatio: 0.9,
    totalSessions: 0,
  });

  // ✅ 백엔드 attendanceLogs
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!subjectId) return;

    const fetchAttendance = async () => {
      try {
        const res = await api.get(`/subjects/${subjectId}/attendance`, {
          params: { scope },
        });

        setStudySchedule(res.data?.studySchedule || studySchedule);
        setMembers(res.data?.attendanceLogs || []);
      } catch (e) {
        console.error("ATTENDANCE FETCH ERROR:", {
          message: e.message,
          status: e.response?.status,
          data: e.response?.data,
          url: e.config?.baseURL + e.config?.url,
        });
        alert("출석 데이터 불러오기 실패");
      }
    };

    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, scope]);

  // ✅ 회차(세로형) rows 만들기 (백엔드가 회차를 시간 순으로 내려줌 → 1회차=첫 시간, 2회차=두번째 시간)
  // ✅ 비율은 회차별 수업 시간(startTime~endTime) 기준으로 계산 (2시~2시5분 = 5분 기준)
  const sessionRows = useMemo(() => {
    const totalSessions = studySchedule.totalSessions || 0;
    const fallbackTotalMin = calcTotalMinutes(studySchedule.start, studySchedule.end);

    const myEmail =
      sessionStorage.getItem("userEmail") ||
      sessionStorage.getItem("userId") ||
      "";

    const my =
      scope === "all"
        ? members.find((m) => m.memberId === myEmail) || members[0]
        : members[0];

    const sessionsOrdered = my?.sessions || [];

    return Array.from({ length: totalSessions }).map((_, idx) => {
      const sessionNo = idx + 1;
      const log = sessionsOrdered[idx];

      const totalMinForSession = log?.startTime && log?.endTime
        ? calcTotalMinutes(log.startTime, log.endTime)
        : fallbackTotalMin;

      const judged = log
        ? judgeAttendance(log, totalMinForSession, studySchedule.requiredRatio)
        : { attendedMin: 0, ratio: 0, isPresent: false };

      // ✅ 백엔드에서 studyDate 내려주면 그걸 우선 사용
      const studyDate = log?.studyDate
        ? log.studyDate
        : log?.joinAt
        ? log.joinAt.slice(0, 10)
        : "-";

      return {
        sessionNo,
        studyDate,
        ...judged,
      };
    });
  }, [
    members,
    scope,
    studySchedule.totalSessions,
    studySchedule.requiredRatio,
    studySchedule.start,
    studySchedule.end,
  ]);

  // ✅ 요약(출석률/출석/결석/전체)
  const summary = useMemo(() => {
    const total = sessionRows.length;
    const present = sessionRows.filter((s) => s.isPresent).length;
    const absent = total - present;
    const ratio = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, absent, ratio };
  }, [sessionRows]);

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
                {(studySchedule.requiredRatio * 100).toFixed(0)}% 이상 참여 시
                출석 인정
              </p>
            </div>
          </div>

          <div className="at-header-actions">{/* 필요하면 버튼 추가 */}</div>
        </div>

        <div className="at-card-body">
          <div className="at-hint">
            <span className="at-chip at-chip--rule">
              기준: 참여시간/전체시간 ≥{" "}
              {(studySchedule.requiredRatio * 100).toFixed(0)}%
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
                <div
                  className="at-progressbar-fill"
                  style={{ width: `${summary.ratio}%` }}
                />
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
                  <span className="at-summary-big is-ok">
                    {summary.present}회
                  </span>
                </div>
                <div>
                  <span className="at-summary-label">결석</span>
                  <span className="at-summary-big is-absent">
                    {summary.absent}회
                  </span>
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
                      <span
                        className={`at-badge ${
                          s.isPresent ? "is-ok" : "is-absent"
                        }`}
                      >
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
