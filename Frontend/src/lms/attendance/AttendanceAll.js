import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../../api/api";

import "./AttendanceAll.css";

/**
 * ✅ 백엔드 응답 형태(권장)
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

const AttendanceAll = () => {
  const { subjectId } = useParams();
  const [sp] = useSearchParams();
  // scope는 그냥 all로 고정해도 되지만, URL에 scope가 있으면 그걸도 반영
  const scope = sp.get("scope") || "all";

  const [studySchedule, setStudySchedule] = useState({
    start: "00:00",
    end: "00:00",
    requiredRatio: 0.9,
    totalSessions: 0,
  });

  const [members, setMembers] = useState([]); // attendanceLogs

  useEffect(() => {
    if (!subjectId) return;

    const fetchAll = async () => {
      try {
        const res = await api.get(`/subjects/${subjectId}/attendance`, {
          params: { scope: "all" },
        });

        setStudySchedule(res.data?.studySchedule || {
          start: "00:00",
          end: "00:00",
          requiredRatio: 0.9,
          totalSessions: 0,
        });
        setMembers(res.data?.attendanceLogs || []);
      } catch (e) {
        console.error("ATTENDANCE ALL FETCH ERROR:", {
          message: e.message,
          status: e.response?.status,
          data: e.response?.data,
          url: e.config?.baseURL + e.config?.url,
        });
        alert("전체 출석 데이터 불러오기 실패");
      }
    };

    fetchAll();
  }, [subjectId, scope]);

  const totalMin = useMemo(
    () => calcTotalMinutes(studySchedule.start, studySchedule.end),
    [studySchedule.start, studySchedule.end]
  );

  // ✅ 화면용으로 가공
  const viewRows = useMemo(() => {
    const totalSessions = studySchedule.totalSessions || 0;

    return (members || []).map((m) => {
      // sessionNo 기반으로 빈칸 없이 배열로 정렬(백엔드에서 누락 와도 안전)
      const byNo = new Map((m.sessions || []).map((s) => [s.sessionNo, s]));

      const sessionsView = Array.from({ length: totalSessions }).map((_, idx) => {
        const sessionNo = idx + 1;
        const log = byNo.get(sessionNo);

        // 로그 없으면 결석 처리(정책)
        const judged = log
          ? judgeAttendance(log, totalMin, studySchedule.requiredRatio)
          : { attendedMin: 0, ratio: 0, isPresent: false };

        return { sessionNo, ...judged };
      });

      const presentCount = sessionsView.filter((s) => s.isPresent).length;
      const absentCount = totalSessions - presentCount;
      const ratioOverall =
        totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100);

      return {
        memberId: m.memberId,
        name: m.name,
        sessionsView,
        presentCount,
        absentCount,
        ratioOverall,
      };
    });
  }, [members, studySchedule.totalSessions, studySchedule.requiredRatio, totalMin]);

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
                기준: 스터디 시간 중 {(studySchedule.requiredRatio * 100).toFixed(0)}% 이상 참여 시
                출석 인정
              </p>
            </div>
          </div>

          <div className="at-header-actions">{/* 필요하면 버튼 */}</div>
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
                  {Array.from({ length: studySchedule.totalSessions || 0 }).map((_, i) => (
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
                          ({r.presentCount}/{studySchedule.totalSessions || 0})
                        </span>
                      </div>
                    </td>

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
                    <td className="at-empty" colSpan={2 + (studySchedule.totalSessions || 0)}>
                      출석 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 디버그용: 원하면 삭제 */}
          {/* <pre style={{ marginTop: 12 }}>{JSON.stringify({ studySchedule, members }, null, 2)}</pre> */}
        </div>
      </section>
    </div>
  );
};

export default AttendanceAll;
