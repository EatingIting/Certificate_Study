// Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function Dashboard({ setActiveMenu }) {
    let navigate = useNavigate();
    let params = useParams();

    let subjectId =
        params.roomId ||
        params.subjectId ||
        params.id ||
        window.location.pathname.split("/")[2];

    let go = (menu) => {
        if (typeof setActiveMenu === "function") {
            setActiveMenu(menu);
        }
        navigate(`/lms/${subjectId}/${menu}`);
    };

    // ✅ 일정 더미
    let upcomingSchedules = [
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

    let parseMD = (md) => {
        let parts = String(md || "").split(".");
        let m = parseInt(parts[0], 10);
        let d = parseInt(parts[1], 10);
        if (Number.isNaN(m) || Number.isNaN(d)) return { month: 0, day: 0 };
        return { month: m, day: d };
    };

    // ✅ 달력이 보고 있는 달(아래 목록 필터용)
    let [activeYear, setActiveYear] = useState(new Date().getFullYear());
    let [activeMonth, setActiveMonth] = useState(new Date().getMonth() + 1);

    // ✅ 달력 월 이동 시 업데이트
    let onDatesSet = (arg) => {
        let d = arg.view.currentStart; // 해당 월 그리드 시작점(보통 전월 말 포함)
        setActiveYear(d.getFullYear());
        setActiveMonth(d.getMonth() + 1);
    };

    // ✅ "YYYY-MM-DD" 키
    let toKey = (y, m, d) => {
        let mm = String(m).padStart(2, "0");
        let dd = String(d).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    };

    // ✅ 날짜키 -> 일정 배열
    let itemsByKey = useMemo(() => {
        let map = {};
        for (let it of upcomingSchedules) {
            let md = parseMD(it.date);
            if (!md.month || !md.day) continue;

            // 여기서는 “보고 있는 연도” 기준으로 맵 생성
            let key = toKey(activeYear, md.month, md.day);
            if (!map[key]) map[key] = [];
            map[key].push(it);
        }
        return map;
    }, [upcomingSchedules, activeYear]);

    // ✅ 해당 달 일정만 아래 목록으로
    let monthItems = useMemo(() => {
        let filtered = upcomingSchedules.filter((it) => parseMD(it.date).month === activeMonth);
        filtered.sort((a, b) => parseMD(a.date).day - parseMD(b.date).day);
        return filtered;
    }, [upcomingSchedules, activeMonth]);

    // =========================
    // ✅ "전역(body)" 툴팁: overflow/레이어 문제로 잘리는 것 방지
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
        let el = document.getElementById("dashGlobalTip");
        if (!el) return;
        el.classList.remove("isOpen");
    }

    function placeGlobalTip(el, anchorRect) {
        let pad = 10;

        // display가 none이면 offset 계산이 0 나올 수 있어서, 먼저 열고 계산하는 흐름을 가정
        let w = el.offsetWidth || 220;
        let h = el.offsetHeight || 120;

        // 기본: 칸 오른쪽 아래
        let left = anchorRect.left + 12;
        let top = anchorRect.top + 28;

        // 오른쪽 밖이면 왼쪽으로
        if (left + w + pad > window.innerWidth) {
            left = anchorRect.right - w - 12;
        }
        // 아래 밖이면 위로
        if (top + h + pad > window.innerHeight) {
            top = anchorRect.top - h - 12;
        }

        // 너무 왼쪽/위로 가면 보정
        if (left < pad) left = pad;
        if (top < pad) top = pad;

        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
    }

    useEffect(() => {
        // 페이지 벗어나거나 리렌더 시 툴팁 남아있으면 닫기
        return () => {
            closeGlobalTip();
        };
    }, []);

    // ✅ 점 + 전역툴팁: 달력 셀에는 dot만 붙이고, 툴팁은 body에 띄움
    let dayCellDidMount = (info) => {
        // 1) 이전 렌더에서 남아있는 점 제거(중복 방지)
        let old = info.el.querySelector(".dashDotWrap");
        if (old) old.remove();

        // 2) 해당 날짜 일정이 있으면 dot + hover
        let y = info.date.getFullYear();
        let m = String(info.date.getMonth() + 1).padStart(2, "0");
        let d = String(info.date.getDate()).padStart(2, "0");
        let key = `${y}-${m}-${d}`;

        let items = itemsByKey[key];
        if (!items || items.length === 0) return;

        let top = info.el.querySelector(".fc-daygrid-day-top");
        if (!top) return;

        // dot만 표시
        let wrap = document.createElement("div");
        wrap.className = "dashDotWrap";

        let dot = document.createElement("span");
        dot.className = "dashDot";
        wrap.appendChild(dot);

        top.appendChild(wrap);

        // ✅ hover 대상: "그 날짜 칸 전체"
        let hoverTarget =
            info.el.querySelector(".fc-daygrid-day-frame") ||
            info.el;

        // 기존 리스너 제거(중복 방지용)
        if (hoverTarget._dashEnter) hoverTarget.removeEventListener("mouseenter", hoverTarget._dashEnter);
        if (hoverTarget._dashLeave) hoverTarget.removeEventListener("mouseleave", hoverTarget._dashLeave);

        let onEnter = () => {
            let globalTip = getGlobalTipEl();

            globalTip.innerHTML = `
                <div class="dashTipTitle">${m}.${d} 일정</div>
                ${items
                .slice(0, 6)
                .map((it) => `<div class="dashTipItem">• ${it.title}</div>`)
                .join("")}
                ${items.length > 6 ? `<div class="dashTipMore">+ ${items.length - 6}개 더 있음</div>` : ""}
            `;

            // 먼저 보여서 크기 계산 가능하게
            globalTip.classList.add("isOpen");

            let rect = hoverTarget.getBoundingClientRect();
            placeGlobalTip(globalTip, rect);
        };

        let onLeave = () => {
            closeGlobalTip();
        };

        hoverTarget.addEventListener("mouseenter", onEnter);
        hoverTarget.addEventListener("mouseleave", onLeave);

        hoverTarget._dashEnter = onEnter;
        hoverTarget._dashLeave = onLeave;
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

                {/* 2) 출석 카드 */}
                <div className="card attendance-card dashAttendance">
                    <div className="card-header line">
                        <span className="card-title">출석 현황</span>
                        <button type="button" className="card-linkBtn" onClick={() => go("attendance")}>
                            출석으로 이동 →
                        </button>
                    </div>

                    <ul className="table-list">
                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[1회차]</span>
                                <span className="row-text">2026.01.01 (월)</span>
                            </span>
                            <span className="tright">
                                <span className="status ok">출석</span>
                            </span>
                        </li>

                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[2회차]</span>
                                <span className="row-text">2026.01.03 (수)</span>
                            </span>
                            <span className="tright">
                                <span className="status ok">출석</span>
                            </span>
                        </li>

                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[3회차]</span>
                                <span className="row-text">2026.01.05 (금)</span>
                            </span>
                            <span className="tright">
                                <span className="status ok">출석</span>
                            </span>
                        </li>
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
                            <span className="rate-value">83.3%</span>
                        </div>

                        <div className="rate-bar">
                            <div className="rate-progress" />
                        </div>
                    </div>
                </div>

                {/* ✅ 3) 달력(그리드 상단 오른쪽) */}
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
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            locale="ko"
                            height="auto"
                            expandRows={false}
                            fixedWeekCount={true}
                            showNonCurrentDates={true}
                            events={[]} // 막대 이벤트는 안 그림
                            headerToolbar={{
                                left: "prev",
                                center: "title",
                                right: "next",
                            }}
                            datesSet={onDatesSet}
                            dayCellContent={(arg) => {
                                return (
                                    <span className="dashDayNum">
                                        {arg.date.getDate()}
                                    </span>
                                );
                            }}
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

                {/* 5) 과제 카드 */}
                <div className="card dashAssignment">
                    <div className="card-header line">
                        <span className="card-title">과제</span>
                        <button type="button" className="card-linkBtn" onClick={() => go("assignment")}>
                            과제로 이동 →
                        </button>
                    </div>

                    <ul className="table-list">
                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[1회차]</span>
                                <span className="row-text">2024 기출 풀기</span>
                            </span>
                            <span className="tright">
                                <span className="pill done">제출</span>
                            </span>
                        </li>

                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[2회차]</span>
                                <span className="row-text">2023 기출 풀기</span>
                            </span>
                            <span className="tright">
                                <span className="pill done">제출</span>
                            </span>
                        </li>

                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[3회차]</span>
                                <span className="row-text">2022 기출 풀기</span>
                            </span>
                            <span className="tright">
                                <span className="pill done">제출</span>
                            </span>
                        </li>

                        <li className="trow tinted">
                            <span className="tleft">
                                <span className="round">[4회차]</span>
                                <span className="row-text">2021 기출 풀기</span>
                            </span>
                            <span className="tright">
                                <span className="pill pending">제출하기</span>
                            </span>
                        </li>
                    </ul>

                    <div className="card-footer">
                        <button type="button" className="more-btn" onClick={() => go("assignment")}>
                            더보기 &gt;
                        </button>
                    </div>
                </div>

                {/* ✅ 6) 월별 일정 목록(그리드 하단 오른쪽) */}
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
