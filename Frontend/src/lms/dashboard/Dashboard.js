// Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import api from "../../api/api"; // ✅ 추가 (경로는 너 프로젝트 구조에 맞춰 조정)

function Dashboard({ setActiveMenu }) {
  const navigate = useNavigate();
  const params = useParams();

  const subjectId =
    params.roomId ||
    params.subjectId ||
    params.id ||
    window.location.pathname.split("/")[2];

  const go = (menu) => {
    if (typeof setActiveMenu === "function") {
      setActiveMenu(menu);
    }
    navigate(`/lms/${subjectId}/${menu}`);
  };

  // =========================
  // ✅ 0) 대시보드용 상태 (출석/과제)
  // =========================
  const [dashAttendance, setDashAttendance] = useState({
    items: [], // 최근 4개 [{ roundNum, studyDate, isPresent }]
    ratio: 0,  // 0~100
  });

  const [dashAssignments, setDashAssignments] = useState({
    items: [], // 최근 4개 [{ id, title, dueAt, status }]
  });

  // =========================
  // ✅ 1) 출석 대시보드 데이터 불러오기 (내 출석)
  // - 백엔드: GET /subjects/{subjectId}/attendance?scope=my
  // =========================
  useEffect(() => {
    if (!subjectId) return;

    const fetchDashAttendance = async () => {
      try {
        const res = await api.get(`/subjects/${subjectId}/attendance`, {
          params: { scope: "my" },
        });

        const schedule = res.data?.studySchedule;
        const logs = res.data?.attendanceLogs || [];
        const me = logs[0]; // scope=my면 보통 내 데이터 1개만 내려옴

        const totalSessions = schedule?.totalSessions || 0;

        // sessions: [{sessionNo, studyDate, joinAt, leaveAt}]
        const sessions = me?.sessions || [];

       const toMs = (iso) => {
          if (!iso) return 0;
          // 혹시 백엔드가 "2026-02-01 13:05:00" 같이 줄 때도 안전하게
          const s = String(iso).trim().replace(" ", "T");
          const t = Date.parse(s);
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

        // ✅ Attendance 페이지 로직과 동일하게: 회차별 startTime/endTime 우선
        const judgeAttendance = (log, fallbackTotalMin, requiredRatio) => {
          const totalMin =
            log?.startTime && log?.endTime
              ? calcTotalMinutes(log.startTime, log.endTime)
              : fallbackTotalMin;

          const attendedMin = minutesBetween(log?.joinAt, log?.leaveAt);
          const ratio = totalMin === 0 ? 0 : attendedMin / totalMin;
          const isPresent = ratio >= requiredRatio;

          return { attendedMin, ratio, isPresent };
        };

        const requiredRatio = schedule?.requiredRatio ?? 0.9;
        const fallbackTotalMin = calcTotalMinutes(schedule?.start, schedule?.end);

        // ✅ 회차별 판정 결과 만들기 (비율은 회차별 수업 시간 startTime~endTime 기준)
        const sessionsOrdered = sessions || [];
        const judgedRows = Array.from({ length: totalSessions }).map((_, idx) => {
          const sessionNo = idx + 1;
          const log = sessionsOrdered[idx];

          const totalMinForSession = log?.startTime && log?.endTime
            ? calcTotalMinutes(log.startTime, log.endTime)
            : fallbackTotalMin;

          const judged = log
            ? judgeAttendance(log, totalMinForSession, requiredRatio)
            : { isPresent: false };

          return {
            roundNum: sessionNo,
            studyDate: log?.studyDate || (log?.joinAt ? log.joinAt.slice(0, 10) : "-"),
            isPresent: judged.isPresent,
          };
        });

        // ✅ 최근 4개: "가장 최근 회차" 기준 (회차 번호 큰 게 최신이라고 가정)
        const recent4 = [...judgedRows]
          .sort((a, b) => b.roundNum - a.roundNum)
          .slice(0, 4)
          .sort((a, b) => a.roundNum - b.roundNum); // 화면은 다시 오름차순

        // ✅ 출석률
        const presentCount = judgedRows.filter((x) => x.isPresent).length;
        const ratio = totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100);

        setDashAttendance({ items: recent4, ratio });
      } catch (e) {
        console.error("DASH ATTENDANCE ERROR:", e);
        setDashAttendance({ items: [], ratio: 0 });
      }
    };

    fetchDashAttendance();
  }, [subjectId]);

  // =========================
  // ✅ 2) 과제 대시보드 데이터 불러오기 (내 과제 목록)
  // - 백엔드: GET /rooms/{roomId}/assignments (auth로 userEmail 판단)
  // =========================
  useEffect(() => {
    if (!subjectId) return;

    const fetchDashAssignments = async () => {
      try {
        const res = await api.get(`/rooms/${subjectId}/assignments`);
        const list = res.data || [];

        // list item: { assignmentId, title, dueAt, authorEmail, status }
        // ✅ 최근 4개: dueAt이 가까운 순(또는 최신 생성순 원하면 바꿔도 됨)
        const sorted = [...list].sort((a, b) => {
          const da = a?.dueAt ? new Date(a.dueAt).getTime() : 0;
          const db = b?.dueAt ? new Date(b.dueAt).getTime() : 0;
          return da - db;
        });

        const top4 = sorted.slice(0, 4).map((x) => ({
          id: x.assignmentId,
          title: x.title,
          dueAt: x.dueAt,
          status: x.status, // "제출 완료" / "제출 하기"
        }));

        setDashAssignments({ items: top4 });
      } catch (e) {
        console.error("DASH ASSIGNMENTS ERROR:", e);
        setDashAssignments({ items: [] });
      }
    };

    fetchDashAssignments();
  }, [subjectId]);

  // ✅ 일정 더미
  const upcomingSchedules = [
    { date: "01.20", title: "정보처리기사 접수 시작", dday: "D-1" },
    { date: "01.21", title: "스터디 1회차", dday: "D-2" },
    { date: "01.22", title: "서류 준비", dday: "D-3" },
    { date: "01.28", title: "스터디 2회차", dday: "D-9" },
    { date: "02.02", title: "SQLD 시험", dday: "D-14" },
    { date: "02.04", title: "스터디 3회차", dday: "D-16" },
    { date: "02.10", title: "면접 준비", dday: "D-22" },
    { date: "02.15", title: "프로젝트 발표", dday: "D-27" },
    { date: "02.18", title: "서류 제출 마감", dday: "D-30" },
    { date: "02.25", title: "스터디 회의", dday: "D-37" },
  ];

  const parseMD = (md) => {
    const parts = String(md || "").split(".");
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (Number.isNaN(m) || Number.isNaN(d)) return { month: 0, day: 0 };
    return { month: m, day: d };
  };

  // ✅ 달력이 보고 있는 달(아래 목록 필터용)
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth() + 1);

  // ✅ 달력 월 이동 시 업데이트
  const onDatesSet = (arg) => {
    const d = arg.view.currentStart;
    setActiveYear(d.getFullYear());
    setActiveMonth(d.getMonth() + 1);
  };

  const toKey = (y, m, d) => {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  const itemsByKey = useMemo(() => {
    const map = {};
    for (const it of upcomingSchedules) {
      const md = parseMD(it.date);
      if (!md.month || !md.day) continue;

      const key = toKey(activeYear, md.month, md.day);
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [upcomingSchedules, activeYear]);

  const monthItems = useMemo(() => {
    const filtered = upcomingSchedules.filter((it) => parseMD(it.date).month === activeMonth);
    filtered.sort((a, b) => parseMD(a.date).day - parseMD(b.date).day);
    return filtered;
  }, [upcomingSchedules, activeMonth]);

  // =========================
  // ✅ 전역 툴팁
  // =========================
  function getGlobalTipEl() {
    let el = document.getElementById("dashGlobalTip");
    if (el) return el;

    el = document.createElement("div");
    el.id = "dashGlobalTip";
    el.className = "dashGlobalTip";
    document.body.appendChild(el);
    return el;
  }

  function closeGlobalTip() {
    const el = document.getElementById("dashGlobalTip");
    if (!el) return;
    el.classList.remove("isOpen");
  }

  function placeGlobalTip(el, anchorRect) {
    const pad = 10;
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 120;

    let left = anchorRect.left + 12;
    let top = anchorRect.top + 28;

    if (left + w + pad > window.innerWidth) left = anchorRect.right - w - 12;
    if (top + h + pad > window.innerHeight) top = anchorRect.top - h - 12;

    if (left < pad) left = pad;
    if (top < pad) top = pad;

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  useEffect(() => {
    return () => closeGlobalTip();
  }, []);

  const dayCellDidMount = (info) => {
    const old = info.el.querySelector(".dashDotWrap");
    if (old) old.remove();

    const y = info.date.getFullYear();
    const m = String(info.date.getMonth() + 1).padStart(2, "0");
    const d = String(info.date.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;

    const items = itemsByKey[key];
    if (!items || items.length === 0) return;

    const top = info.el.querySelector(".fc-daygrid-day-top");
    if (!top) return;

    const wrap = document.createElement("div");
    wrap.className = "dashDotWrap";
    const dot = document.createElement("span");
    dot.className = "dashDot";
    wrap.appendChild(dot);
    top.appendChild(wrap);

    const hoverTarget = info.el.querySelector(".fc-daygrid-day-frame") || info.el;

    if (hoverTarget._dashEnter) hoverTarget.removeEventListener("mouseenter", hoverTarget._dashEnter);
    if (hoverTarget._dashLeave) hoverTarget.removeEventListener("mouseleave", hoverTarget._dashLeave);

    const onEnter = () => {
      const globalTip = getGlobalTipEl();

      globalTip.innerHTML = `
        <div class="dashTipTitle">${m}.${d} 일정</div>
        ${items
          .slice(0, 6)
          .map((it) => `<div class="dashTipItem">• ${it.title}</div>`)
          .join("")}
        ${items.length > 6 ? `<div class="dashTipMore">+ ${items.length - 6}개 더 있음</div>` : ""}
      `;

      globalTip.classList.add("isOpen");
      const rect = hoverTarget.getBoundingClientRect();
      placeGlobalTip(globalTip, rect);
    };

    const onLeave = () => closeGlobalTip();

    hoverTarget.addEventListener("mouseenter", onEnter);
    hoverTarget.addEventListener("mouseleave", onLeave);

    hoverTarget._dashEnter = onEnter;
    hoverTarget._dashLeave = onLeave;
  };

  // ✅ 날짜 표시용 (출석 카드)
  const fmtYMD = (ymd) => {
    if (!ymd || ymd === "-") return "-";
    // "2026-01-19" -> "2026.01.19"
    return ymd.replaceAll("-", ".");
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* 1) 시험 카드 */}
        <div className="card study-card-back dashStudy">
          <div className="card study-card">
            <div className="study-info">
              <h3>정보처리기사</h3>
              <hr />
              <p>
                2026.04.27 <br />
                D-23
              </p>

              <div className="progress-bar">
                <div className="progress" />
              </div>
            </div>

            <div className="study-icon">🔥</div>
          </div>
        </div>

        {/* 2) 출석 카드 (✅ API 적용) */}
        <div className="card attendance-card dashAttendance">
          <div className="card-header line">
            <span className="card-title">출석 현황</span>
            <button type="button" className="card-linkBtn" onClick={() => go("attendance")}>
              출석으로 이동 →
            </button>
          </div>

          <ul className="table-list">
            {(dashAttendance.items || []).map((it) => (
              <li key={`att-${it.roundNum}`} className="trow tinted">
                <span className="tleft">
                  <span className="round">[{it.roundNum}회차]</span>
                  <span className="row-text">{fmtYMD(it.studyDate)}</span>
                </span>
                <span className="tright">
                  <span className={`status ${it.isPresent ? "ok" : "bad"}`}>
                    {it.isPresent ? "출석" : "결석"}
                  </span>
                </span>
              </li>
            ))}

            {(dashAttendance.items || []).length === 0 && (
              <li className="trow tinted">
                <span className="row-text">출석 데이터가 없습니다.</span>
              </li>
            )}
          </ul>

          <div className="card-footer">
            <button type="button" className="more-btn" onClick={() => go("attendance")}>
              더보기 &gt;
            </button>
          </div>

          <div className="attendance-rate-box">
            <div className="rate-top">
              <div className="rate-left">
                <img src="/calendar.png" alt="출석률" className="rate-badge" />
                <span className="rate-label">출석률</span>
              </div>
              <span className="rate-value">{dashAttendance.ratio}%</span>
            </div>

            <div className="rate-bar">
              <div className="rate-progress" style={{ width: `${dashAttendance.ratio}%` }} />
            </div>
          </div>
        </div>

        {/* 3) 달력 */}
        <div className="card dashCalendarTop">
          <div className="card-header line">
            <span className="card-title">달력</span>
            <button type="button" className="card-linkBtn" onClick={() => go("calendar")}>
              일정으로 이동 →
            </button>
          </div>

          <div className="dashMiniCal">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="ko"
              height="auto"
              expandRows={false}
              fixedWeekCount={true}
              showNonCurrentDates={true}
              events={[]}
              headerToolbar={{
                left: "prev",
                center: "title",
                right: "next",
              }}
              datesSet={onDatesSet}
              dayCellContent={(arg) => <span className="dashDayNum">{arg.date.getDate()}</span>}
              dayCellDidMount={dayCellDidMount}
            />
          </div>
        </div>

        {/* 4) 게시판 카드 */}
        <div className="card dashBoard">
          <div className="card-header line">
            <span className="card-title">게시판</span>
            <button type="button" className="card-linkBtn" onClick={() => go("board")}>
              게시판으로 이동 →
            </button>
          </div>

          <ul className="table-list">
            <li className="trow plain">
              <span className="row-text">[자료] 2024 기출 자료 공유합니다!</span>
            </li>
            <li className="trow plain">
              <span className="row-text">[자료] 필기 요약본입니다</span>
            </li>
            <li className="trow plain">
              <span className="row-text">[공지] 오늘 저녁 스터디 예정입니다</span>
            </li>
          </ul>

          <div className="card-footer">
            <button type="button" className="more-btn" onClick={() => go("board")}>
              더보기 &gt;
            </button>
          </div>
        </div>

        {/* 5) 과제 카드 (✅ API 적용) */}
        <div className="card dashAssignment">
          <div className="card-header line">
            <span className="card-title">과제</span>
            <button type="button" className="card-linkBtn" onClick={() => go("assignment")}>
              과제로 이동 →
            </button>
          </div>

          <ul className="table-list">
            {(dashAssignments.items || []).map((a) => (
              <li key={`as-${a.id}`} className="trow tinted">
                <span className="tleft">
                  <span className="round">[과제]</span>
                  <span className="row-text">{a.title}</span>
                </span>
                <span className="tright">
                  <span className={`pill ${a.status === "제출 완료" ? "done" : "pending"}`}>
                    {a.status === "제출 완료" ? "제출" : "제출하기"}
                  </span>
                </span>
              </li>
            ))}

            {(dashAssignments.items || []).length === 0 && (
              <li className="trow tinted">
                <span className="row-text">과제 데이터가 없습니다.</span>
              </li>
            )}
          </ul>

          <div className="card-footer">
            <button type="button" className="more-btn" onClick={() => go("assignment")}>
              더보기 &gt;
            </button>
          </div>
        </div>

        {/* 6) 월별 일정 목록 */}
        <div className="card dashCalendarBottom">
          <div className="card-header line">
            <span className="card-title">월별 일정</span>
            <span className="dashMonthBadge">{activeMonth}월</span>
          </div>

          <div className="dashListBody">
            {monthItems.length === 0 ? (
              <div className="dashEmpty">이번 달 일정이 없습니다.</div>
            ) : (
              <ul className="table-list dashCalListTight">
                {monthItems.map((it, idx) => (
                  <li key={`m-${activeMonth}-${idx}`} className="trow tinted">
                    <span className="tleft">
                      <span className="round">[{it.date}]</span>
                      <span className="row-text">{it.title}</span>
                    </span>
                    <span className="tright">
                      <span className="status ok">{it.dday}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card-footer">
            <button type="button" className="more-btn" onClick={() => go("calendar")}>
              더보기 &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
