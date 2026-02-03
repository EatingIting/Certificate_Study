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
  const [calendarEvents, setCalendarEvents] = useState([]);

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
  // 게시판 (공지 맨 위, 그 다음 최신순 6개)
  // =========================
  const [dashBoard, setDashBoard] = useState({ items: [] }); // [{ postId, title, category, isPinned }]

  useEffect(() => {
    if (!subjectId) return;

    const fetchDashBoard = async () => {
      try {
        const res = await api.get("/board/posts", {
          params: { roomId: subjectId, page: 1, size: 30 },
        });
        const items = res.data?.items || [];
        const noticeOrPinned = (p) => !!p?.isPinned || p?.category === "NOTICE";
        const sorted = [...items]
          .sort((a, b) => {
            const aNotice = noticeOrPinned(a);
            const bNotice = noticeOrPinned(b);
            if (aNotice && !bNotice) return -1;
            if (!aNotice && bNotice) return 1;
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          })
          .slice(0, 6);
        setDashBoard({ items: sorted });
      } catch (e) {
        console.error("DASH BOARD ERROR:", e);
        setDashBoard({ items: [] });
      }
    };

    fetchDashBoard();
  }, [subjectId]);

  const categoryToLabel = (code) => {
    if (!code) return "";
    if (code === "NOTICE") return "공지";
    if (code === "GENERAL") return "일반";
    if (code === "QNA") return "질문";
    if (code === "RESOURCE") return "자료";
    return code;
  };

  // =========================
  // ✅ 시험 일정 (type=EXAM, 가장 가까운 1건) - D-day·프로그레스바용
  // =========================
  const [dashExam, setDashExam] = useState({ item: null }); // { item: { id, title, start } | null }

  useEffect(() => {
    if (!subjectId) return;

    const getClientTodayStr = () => {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    };

    const fetchNextExam = async () => {
      const todayStr = getClientTodayStr();

      const fetchFromScheduleRange = async () => {
        const end = new Date();
        end.setDate(end.getDate() + 120);
        const endYmd =
          `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
        const res = await api.get(
          `/rooms/${subjectId}/schedule?start=${encodeURIComponent(todayStr)}&end=${encodeURIComponent(endYmd)}`
        );
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const exams = items.filter(
          (it) => (it?.extendedProps?.type || it?.type) === "EXAM" && it?.start
        );
        exams.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
        const startYmd = (it) => (it.start || "").slice(0, 10);
        const next =
          exams.find((it) => startYmd(it) > todayStr) ||
          exams.find((it) => startYmd(it) === todayStr);
        return next
          ? {
              id: next.id,
              title: next.title,
              start: typeof next.start === "string" ? next.start.slice(0, 10) : next.start,
            }
          : null;
      };

      try {
        let item = null;
        try {
          const res = await api.get(`/rooms/${subjectId}/schedule/exam/next`);
          item = res.data?.item ?? null;
        } catch {
          // 전용 API 없음 → 폴백
        }

        const startYmd = (it) => (it?.start && String(it.start).slice(0, 10)) || "";
        if (item?.start && startYmd(item) < todayStr) {
          // 받은 시험이 과거(클라이언트 기준) → 다음 시험 찾기
          item = await fetchFromScheduleRange();
        }
        if (!item?.start) {
          item = await fetchFromScheduleRange();
        }
        if (item?.start && startYmd(item) < todayStr) {
          item = null;
        }
        setDashExam({ item });
      } catch (e) {
        console.error("DASH EXAM ERROR:", e);
        setDashExam({ item: null });
      }
    };

    fetchNextExam();
  }, [subjectId]);

  // D-day: 시험일(start) 기준 오늘(로컬)과의 일수 차이. 당일=0, 과거면 null.
  const examDday = useMemo(() => {
    const item = dashExam?.item;
    if (!item?.start) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startYmd = String(item.start).slice(0, 10);
    const examDate = new Date(startYmd + "T00:00:00");
    const diffMs = examDate - today;
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return days < 0 ? null : days;
  }, [dashExam?.item]);

  // 표시용 라벨: 며칠 남았으면 D-n, 당일만 D-day. (과거 시험은 카드에 안 보이므로 "지남" 없음)
  const examDdayLabel = useMemo(() => {
    if (!dashExam?.item?.start) return "";
    if (examDday != null && examDday > 0) return `D-${examDday}`;
    const today = new Date();
    const todayStr =
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const startYmd = String(dashExam.item.start).slice(0, 10);
    if (startYmd === todayStr || examDday === 0) return "D-day";
    if (examDday != null && examDday >= 0) return `D-${examDday}`;
    return "";
  }, [examDday, dashExam?.item?.start]);

  // 프로그레스: 30일 전~시험일 기준, 하루에 한 번씩 진행 (0~100%)
  const examProgress = useMemo(() => {
    if (examDday == null) return 0;
    const totalDays = 30;
    const elapsed = totalDays - examDday;
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  }, [examDday]);

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

    useEffect(() => {
        if (!subjectId) return;

        const fetchSchedules = async () => {
            try {
                const today = new Date();

                const start = new Date(today);
                start.setMonth(start.getMonth() - 1);

                const end = new Date(today);
                end.setMonth(end.getMonth() + 3);

                const startStr = start.toISOString().slice(0, 10);
                const endStr = end.toISOString().slice(0, 10);

                const res = await api.get("/schedules", {
                    params: {
                        roomId: subjectId,
                        start: startStr,
                        end: endStr,
                    },
                });

                setCalendarEvents(res.data || []);
            } catch (e) {
                console.error("DASH SCHEDULE ERROR:", e);
                setCalendarEvents([]);
            }
        };

        fetchSchedules();
    }, [subjectId]);

    const fcEvents = useMemo(() => {
        return calendarEvents.map((ev) => {
            const raw = ev.start || ev.startDate;

            const localDate = raw.length === 10
                ? raw + "T00:00:00"
                : raw;

            return {
                id: ev.id || ev.scheduleId,
                title: ev.title,
                start: localDate,
            };
        });
    }, [calendarEvents]);




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

        fcEvents.forEach((ev) => {
            const key = String(ev.start).slice(0, 10);

            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });

        return map;
    }, [fcEvents]);




    const monthItems = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return fcEvents
            .filter((ev) => {
                const startDate = new Date(String(ev.start).slice(0, 10));
                startDate.setHours(0, 0, 0, 0);

                const month = Number(String(ev.start).slice(5, 7));
                if (month !== activeMonth) return false;

                if (startDate < today) return false;

                return true;
            })
            .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    }, [fcEvents, activeMonth]);



    const calcDday = (startDate) => {
        if (!startDate) return "";

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const target = new Date(String(startDate).slice(0, 10));
        target.setHours(0, 0, 0, 0);

        const diff = Math.floor((target - today) / (1000 * 60 * 60 * 24));

        if (diff === 0) return "D-day";
        if (diff > 0) return `D-${diff}`;
        return "지남";
    };



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

        const hoverTarget =
            info.el.querySelector(".fc-daygrid-day-frame") || info.el;

        if (hoverTarget._dashEnter) {
            hoverTarget.removeEventListener("mouseenter", hoverTarget._dashEnter);
        }

        if (hoverTarget._dashLeave) {
            hoverTarget.removeEventListener("mouseleave", hoverTarget._dashLeave);
        }

        const onEnter = () => {
            const globalTip = getGlobalTipEl();

            globalTip.innerHTML = `
      <div class="dashTipTitle">${key} 일정</div>
      ${items
                .slice(0, 6)
                .map((it) => `<div class="dashTipItem">• ${it.title}</div>`)
                .join("")}
    `;

            globalTip.classList.add("isOpen");
            placeGlobalTip(globalTip, hoverTarget.getBoundingClientRect());
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
        {/* 1) 시험 카드 - schedules type=EXAM 중 가장 가까운 시험, D-day·프로그레스바 */}
        <div className="card study-card-back dashStudy">
          <div className="card study-card">
            {dashExam.item && examDday !== null ? (
              <>
                <div className="study-info">
                  <h3>{dashExam.item.title || "시험"}</h3>
                  <hr />
                  <p>
                    {(dashExam.item.start || "").replaceAll("-", ".")} <br />
                    {examDdayLabel}
                  </p>

                  <div className="progress-bar">
                    <div
                      className="progress"
                      style={{ width: `${examProgress}%` }}
                    />
                  </div>
                </div>

                <div className="study-icon">🔥</div>
              </>
            ) : (
              <div className="study-info study-info-empty">
                <h3>시험 일정</h3>
                <hr />
                <p className="study-empty-msg">시험 일정이 없습니다.</p>
              </div>
            )}
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
                  <button
                      type="button"
                      className="card-linkBtn"
                      onClick={() => go("calendar")}
                  >
                      일정으로 이동 →
                  </button>
              </div>

              <div className="dashMiniCal">
                  <FullCalendar
                      key={fcEvents.length}
                      plugins={[dayGridPlugin, interactionPlugin]}
                      initialView="dayGridMonth"
                      locale="ko"
                      height="auto"
                      fixedWeekCount={true}
                      showNonCurrentDates={true}
                      events={fcEvents}

                      datesSet={onDatesSet}

                      dayCellContent={(arg) => (
                          <span className="dashDayNum">
                              {arg.date.getDate()}
                          </span>
                      )}

                      dayCellDidMount={dayCellDidMount}
                      eventDisplay="none"
                  />

              </div>
          </div>

        {/* 4) 게시판 카드 - 공지 맨 위, 최신순 6개 */}
        <div className="card dashBoard">
          <div className="card-header line">
            <span className="card-title">게시판</span>
            <button type="button" className="card-linkBtn" onClick={() => go("board")}>
              게시판으로 이동 →
            </button>
          </div>

          <ul className="table-list">
            {(dashBoard.items || []).map((p) => (
              <li
                key={`post-${p.postId}`}
                className="trow plain dashBoard-item"
                onClick={() => {
                  if (typeof setActiveMenu === "function") setActiveMenu("board");
                  navigate(`/lms/${subjectId}/board/${p.postId}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (typeof setActiveMenu === "function") setActiveMenu("board");
                    navigate(`/lms/${subjectId}/board/${p.postId}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="row-text">
                  [{categoryToLabel(p.category)}] {p.title}
                </span>
              </li>
            ))}

            {(dashBoard.items || []).length === 0 && (
              <li className="trow plain">
                <span className="row-text">게시글이 없습니다.</span>
              </li>
            )}
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
                          {monthItems.map((it) => (
                              <li key={it.id} className="trow tinted">
                    <span className="tleft">
                      <span className="round">
                          [{String(it.start).slice(0, 10).slice(5).replace("-", ".")}]
                      </span>

                      <span className="row-text">{it.title}</span>
                    </span>

                    <span className="tright">
                      <span className="status ok">
                          {calcDday(it.start)}
                      </span>
                    </span>
                              </li>
                          ))}
                      </ul>
                  )}
              </div>

              <div className="card-footer">
                  <button
                      type="button"
                      className="more-btn"
                      onClick={() => go("calendar")}
                  >
                      더보기 &gt;
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
}

export default Dashboard;
