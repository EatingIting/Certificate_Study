import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../../api/api";
import "./AttendanceAll.css";

// ------- 유틸 -------
const toKey = (value) => String(value || "").trim().toLowerCase();

const pushKeys = (set, ...values) => {
  values.forEach((value) => {
    const key = toKey(value);
    if (key) set.add(key);
  });
};

const getAttendanceKeys = (row) => {
  const keys = new Set();
  if (!row || typeof row !== "object") return keys;
  pushKeys(keys, row.memberId, row.userId, row.id, row.email, row.name, row.nickname);
  return keys;
};

const getParticipantKeys = (row) => {
  const keys = new Set();
  if (!row || typeof row !== "object") return keys;
  pushKeys(keys, row.id, row.userId, row.memberId, row.email, row.name, row.nickname);
  return keys;
};

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

/** 회차 시간(studyDate+startTime~endTime)과 참여(joinAt~leaveAt)가 겹치는 분만 인정 */
const minutesOverlapInSession = (log) => {
  if (!log?.studyDate || !log?.startTime || !log?.endTime || !log?.joinAt || !log?.leaveAt) return 0;
  const pad = (t) => (String(t).length >= 8 ? t : `${t}:00`);
  const sessionStart = new Date(`${log.studyDate}T${pad(log.startTime)}`).getTime();
  const sessionEnd = new Date(`${log.studyDate}T${pad(log.endTime)}`).getTime();
  const joinMs = toMs(log.joinAt);
  const leaveMs = toMs(log.leaveAt);
  const overlapStart = Math.max(joinMs, sessionStart);
  const overlapEnd = Math.min(leaveMs, sessionEnd);
  if (overlapEnd <= overlapStart) return 0;
  return Math.floor((overlapEnd - overlapStart) / 60000);
};

const calcTotalMinutes = (startHHMM, endHHMM) => {
  if (!startHHMM || !endHHMM) return 0;
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return Math.max(0, end - start);
};

/** 출석 판정: 참석시간/회차시간 >= requiredRatio */
const judgeAttendance = (log, fallbackTotalMin, requiredRatio) => {
  const totalMin =
    log?.startTime && log?.endTime
      ? calcTotalMinutes(log.startTime, log.endTime)
      : fallbackTotalMin;

  const attendedMin =
    log?.studyDate && log?.startTime && log?.endTime
      ? minutesOverlapInSession(log)
      : minutesBetween(log?.joinAt, log?.leaveAt);

  const ratio = totalMin === 0 ? 0 : attendedMin / totalMin;
  return { attendedMin, ratio, isPresent: ratio >= requiredRatio };
};

const AttendanceAll = () => {
  const { subjectId } = useParams();
  const [sp] = useSearchParams();
  const scope = sp.get("scope") || "all";

  const [studySchedule, setStudySchedule] = useState({
    start: "00:00",
    end: "00:00",
    requiredRatio: 0.9,
    totalSessions: 0,
  });

  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!subjectId) return;

    const fetchAll = async () => {
      try {
        const [attendanceRes, participantsRes] = await Promise.allSettled([
          api.get(`/subjects/${subjectId}/attendance`, { params: { scope: "all" } }),
          api.get(`/rooms/${subjectId}/participants`),
        ]);

        const attendanceData =
          attendanceRes.status === "fulfilled" ? attendanceRes.value?.data : null;
        const attendanceLogs = Array.isArray(attendanceData?.attendanceLogs)
          ? attendanceData.attendanceLogs
          : [];
        const participants = Array.isArray(participantsRes.value?.data?.participants)
          ? participantsRes.value.data.participants
          : [];

        setStudySchedule(
          attendanceData?.studySchedule || {
            start: "00:00",
            end: "00:00",
            requiredRatio: 0.9,
            totalSessions: 0,
          }
        );

        // 출석 로그가 없어도 참여자 이름은 표에 보이도록 병합
        const merged = [];
        const usedAttendanceIdx = new Set();

        participants.forEach((p, idx) => {
          const participantKeys = getParticipantKeys(p);
          let matchedIdx = -1;

          for (let i = 0; i < attendanceLogs.length; i += 1) {
            if (usedAttendanceIdx.has(i)) continue;
            const logKeys = getAttendanceKeys(attendanceLogs[i]);
            const isMatched = [...participantKeys].some((key) => logKeys.has(key));
            if (isMatched) {
              matchedIdx = i;
              break;
            }
          }

          if (matchedIdx >= 0) {
            usedAttendanceIdx.add(matchedIdx);
            const log = attendanceLogs[matchedIdx];
            merged.push({
              ...log,
              memberId:
                log?.memberId ?? p?.id ?? p?.userId ?? p?.email ?? `participant-${idx}`,
              name: log?.name || p?.nickname || p?.name || p?.email || `멤버 ${idx + 1}`,
              sessions: Array.isArray(log?.sessions) ? log.sessions : [],
            });
            return;
          }

          merged.push({
            memberId: p?.id ?? p?.userId ?? p?.email ?? `participant-${idx}`,
            name: p?.nickname || p?.name || p?.email || `멤버 ${idx + 1}`,
            sessions: [],
          });
        });

        // 참여자 API에는 없지만 출석 로그에만 있는 경우도 보존
        attendanceLogs.forEach((log, idx) => {
          if (usedAttendanceIdx.has(idx)) return;
          merged.push({
            ...log,
            memberId: log?.memberId ?? log?.userId ?? log?.email ?? `attendance-${idx}`,
            name: log?.name || log?.nickname || log?.email || `멤버 ${idx + 1}`,
            sessions: Array.isArray(log?.sessions) ? log.sessions : [],
          });
        });

        setMembers(merged);
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

  // 로그가 단 한 건도 없으면 회차를 숨긴다.
  const hasAnyAttendance = useMemo(
    () => (members || []).some((m) => Array.isArray(m?.sessions) && m.sessions.length > 0),
    [members]
  );
  const visibleTotalSessions = hasAnyAttendance ? (studySchedule.totalSessions || 0) : 0;

  // 표 렌더링용 데이터 가공
  const viewRows = useMemo(() => {
    const totalSessions = visibleTotalSessions;
    const fallbackTotalMin = calcTotalMinutes(studySchedule.start, studySchedule.end);

    return (members || []).map((m) => {
      const sessionsOrdered = Array.isArray(m.sessions) ? m.sessions : [];

      const sessionsView = Array.from({ length: totalSessions }).map((_, idx) => {
        const sessionNo = idx + 1;
        const log = sessionsOrdered[idx];

        const totalMinForSession =
          log?.startTime && log?.endTime
            ? calcTotalMinutes(log.startTime, log.endTime)
            : fallbackTotalMin;

        const judged = log
          ? judgeAttendance(log, totalMinForSession, studySchedule.requiredRatio)
          : { attendedMin: 0, ratio: 0, isPresent: false };

        return { sessionNo, ...judged };
      });

      const presentCount = sessionsView.filter((s) => s.isPresent).length;
      const absentCount = totalSessions - presentCount;
      const ratioOverall = totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100);

      return {
        memberId: m.memberId,
        name: m.name,
        sessionsView,
        presentCount,
        absentCount,
        ratioOverall,
      };
    });
  }, [
    members,
    visibleTotalSessions,
    studySchedule.requiredRatio,
    studySchedule.start,
    studySchedule.end,
  ]);

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

          <div className="at-header-actions" />
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
                  {Array.from({ length: visibleTotalSessions }).map((_, i) => (
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
                      {visibleTotalSessions > 0 ? (
                        <div className="at-progress">
                          <div className="at-bar">
                            <div className="at-bar-fill" style={{ width: `${r.ratioOverall}%` }} />
                          </div>
                          <span className="at-progress-text">
                            ({r.presentCount}/{visibleTotalSessions})
                          </span>
                        </div>
                      ) : (
                        <span className="at-progress-text">-</span>
                      )}
                    </td>

                    {r.sessionsView.map((s) => (
                      <td key={s.sessionNo} className="at-td-session">
                        <span
                          className={`at-mark ${s.isPresent ? "is-ok" : "is-absent"}`}
                          title={`${s.attendedMin}분 참여 (${s.isPresent ? 100 : Math.round(s.ratio * 100)}%)`}
                        >
                          {s.isPresent ? "○" : "×"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}

                {viewRows.length === 0 && (
                  <tr>
                    <td className="at-empty" colSpan={2 + visibleTotalSessions}>
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

export default AttendanceAll;
