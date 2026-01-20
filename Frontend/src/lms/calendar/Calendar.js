import React, { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./Calendar.css";

function Calendar() {
    let calendarRef = useRef(null);

    let [visibleRange, setVisibleRange] = useState(null);
    let [visibleTitle, setVisibleTitle] = useState("");

    let initialEvents = useMemo(() => {
        return [
            { id: "1", title: "정보처리기사 접수 시작", start: "2026-01-20", extendedProps: { type: "REGISTRATION" } },
            { id: "2", title: "SQLD 시험", start: "2026-02-02", extendedProps: { type: "EXAM" } },
            { id: "3", title: "정처기 접수 기간", start: "2026-01-20", end: "2026-01-28", extendedProps: { type: "REGISTRATION" } },
            { id: "4", title: "기타 일정", start: "2026-01-22", extendedProps: { type: "OTHER", customLabel: "서류 준비" } },
        ];
    }, []);

    let [events, setEvents] = useState(initialEvents);

    let [isAddOpen, setIsAddOpen] = useState(false);
    let [form, setForm] = useState({
        title: "",
        description: "",     // ✅ 추가
        start: "",
        end: "",
        type: "OTHER",
        customLabel: "",
        colorHex: "#97c793", // ✅ 추가(기본 색)
    });
    let [formError, setFormError] = useState("");

    let openAddModal = () => {
        setForm({
            title: "",
            description: "",
            start: "",
            end: "",
            type: "OTHER",
            customLabel: "",
            colorHex: "#97c793",
        });
        setFormError("");
        setIsAddOpen(true);
    };

    let closeAddModal = () => {
        setIsAddOpen(false);
        setFormError("");
    };

    let onChangeForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    let toDate = (yyyyMmDd) => {
        let [y, m, d] = yyyyMmDd.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    let overlaps = (event, range) => {
        if (!range) return true;

        let s = event.start instanceof Date ? event.start : toDate(event.start);

        let e;
        if (event.end) {
            e = event.end instanceof Date ? event.end : toDate(event.end);
        } else {
            e = new Date(s);
            e.setDate(e.getDate() + 1);
        }

        return s < range.end && e > range.start;
    };

    let monthlyEvents = useMemo(() => {
        if (!visibleRange) return events;

        let filtered = events.filter((ev) => overlaps(ev, visibleRange));

        filtered.sort((a, b) => {
            let aS = a.start instanceof Date ? a.start : toDate(a.start);
            let bS = b.start instanceof Date ? b.start : toDate(b.start);
            return aS - bS;
        });

        return filtered;
    }, [events, visibleRange]);

    let typeLabel = (ev) => {
        let t = ev.extendedProps?.type;
        if (t === "REGISTRATION") return "접수";
        if (t === "EXAM") return "시험";
        if (t === "RESULT") return "발표";
        if (t === "OTHER") return ev.extendedProps?.customLabel || "기타";
        return "일정";
    };

    let fmtDate = (yyyyMmDd) => {
        let [, m, d] = yyyyMmDd.split("-");
        return `${m}.${d}`;
    };

    let eventClassNames = (arg) => {
        let t = arg.event.extendedProps?.type;
        if (t === "REGISTRATION") return ["calEvent", "reg"];
        if (t === "EXAM") return ["calEvent", "exam"];
        if (t === "RESULT") return ["calEvent", "result"];
        return ["calEvent", "other"];
    };

    let saveEventFromModal = () => {
        let title = form.title.trim();
        if (!title) {
            setFormError("제목을 입력해 주세요.");
            return;
        }
        if (!form.start) {
            setFormError("시작일을 선택해 주세요.");
            return;
        }
        if (form.end && form.end < form.start) {
            setFormError("종료일은 시작일 이후여야 합니다.");
            return;
        }

        let id = String(Date.now());
        let extendedProps = {
            type: form.type,
            description: form.description.trim(), // ✅ 저장
        };

        if (form.type === "OTHER" && form.customLabel.trim()) {
            extendedProps.customLabel = form.customLabel.trim();
        }

        let newEvent = {
            id,
            title,
            start: form.start,
            ...(form.end ? { end: form.end } : {}),
            extendedProps,

            // ✅ 색상 커스텀(FullCalendar 기본 지원 속성)
            backgroundColor: form.colorHex,
            borderColor: form.colorHex,
            textColor: "#ffffff",
        };

        setEvents((prev) => [...prev, newEvent]);
        closeAddModal();
    };

    return (
        <div className="page calPage">
            <div className="calHead">
                <h1 className="pageTitle">일정관리</h1>
                <p className="pageSub">달을 이동하면 해당 월의 일정이 오른쪽에 모두 표시됩니다.</p>
            </div>

            <div className="calGrid">
                {/* 왼쪽: 달력 */}
                <div className="card calCard calCalendarCard">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        locale="ko"
                        height="100%"
                        expandRows={true}
                        fixedWeekCount={true}
                        showNonCurrentDates={true}
                        dayMaxEventRows={2}
                        events={events}
                        eventClassNames={eventClassNames}
                        customButtons={{
                            myToday: {
                                text: "오늘로 이동",
                                click: () => {
                                    let api = calendarRef.current?.getApi?.();
                                    api?.today();
                                },
                            },
                        }}
                        headerToolbar={{
                            left: "prev",
                            center: "title myToday",
                            right: "next",
                        }}
                        datesSet={(info) => {
                            setVisibleRange({ start: info.view.currentStart, end: info.view.currentEnd });
                            setVisibleTitle(info.view.title || "");
                        }}
                    />
                </div>

                {/* 오른쪽: 월간 일정 목록 */}
                <div className="card calCard calListCard">
                    <div className="calListHead">
                        <div className="cardTitle calListTitle">
                            {visibleTitle ? `${visibleTitle} 일정` : "이번 달 일정"}
                        </div>

                        <button type="button" className="calAddBtn" onClick={openAddModal}>
                            일정 추가
                        </button>
                    </div>

                    <div className="calListBody">
                        {monthlyEvents.length === 0 && <div className="calEmpty">이번 달에 등록된 일정이 없습니다.</div>}

                        {monthlyEvents.map((ev) => {
                            let startStr = typeof ev.start === "string" ? ev.start : ev.startStr?.slice(0, 10);
                            let endStr = ev.end ? (typeof ev.end === "string" ? ev.end : ev.endStr?.slice(0, 10)) : null;

                            return (
                                <div key={ev.id} className="calItem">
                                    <div className="calItemTop">
                                        <span className={`calBadge ${ev.extendedProps?.type || "OTHER"}`}>
                                            {typeLabel(ev)}
                                        </span>
                                        <span className="calDate">
                                            {startStr ? fmtDate(startStr) : ""}
                                            {endStr ? ` ~ ${fmtDate(endStr)}` : ""}
                                        </span>
                                    </div>

                                    <div className="calItemTitle" title={ev.title}>
                                        {ev.title}
                                    </div>

                                    {ev.extendedProps?.description && (
                                        <div className="calItemDesc">{ev.extendedProps.description}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ✅ 일정 추가 모달 */}
            {isAddOpen && (
                <div className="calModalOverlay" onMouseDown={closeAddModal}>
                    <div className="calModal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="calModalHead">
                            <div className="calModalTitle">일정 추가</div>
                            <button type="button" className="calModalClose" onClick={closeAddModal}>
                                ✕
                            </button>
                        </div>

                        <div className="calModalBody">
                            <label className="calField">
                                <span className="calFieldLabel">제목</span>
                                <input
                                    className="calInput"
                                    value={form.title}
                                    onChange={(e) => onChangeForm("title", e.target.value)}
                                    placeholder="예: SQLD 원서접수"
                                />
                            </label>

                            <label className="calField">
                                <span className="calFieldLabel">설명(선택)</span>
                                <textarea
                                    className="calTextarea"
                                    value={form.description}
                                    onChange={(e) => onChangeForm("description", e.target.value)}
                                    placeholder="예: 장소/준비물/간단 메모"
                                    rows={3}
                                />
                            </label>

                            <label className="calField">
                                <span className="calFieldLabel">색상</span>
                                <input
                                    type="color"
                                    className="calColor"
                                    value={form.colorHex}
                                    onChange={(e) => onChangeForm("colorHex", e.target.value)}
                                    aria-label="색상 선택"
                                />
                            </label>

                            <div className="calRow2">
                                <label className="calField">
                                    <span className="calFieldLabel">시작일</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.start}
                                        onChange={(e) => onChangeForm("start", e.target.value)}
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">종료일(선택)</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.end}
                                        onChange={(e) => onChangeForm("end", e.target.value)}
                                    />
                                </label>
                            </div>

                            <div className="calRow2">
                                <label className="calField">
                                    <span className="calFieldLabel">유형</span>
                                    <select
                                        className="calSelect"
                                        value={form.type}
                                        onChange={(e) => onChangeForm("type", e.target.value)}
                                    >
                                        <option value="REGISTRATION">접수</option>
                                        <option value="EXAM">시험</option>
                                        <option value="RESULT">발표</option>
                                        <option value="OTHER">기타</option>
                                    </select>
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">기타 라벨(선택)</span>
                                    <input
                                        className="calInput"
                                        value={form.customLabel}
                                        onChange={(e) => onChangeForm("customLabel", e.target.value)}
                                        placeholder="예: 서류 준비"
                                        disabled={form.type !== "OTHER"}
                                    />
                                </label>
                            </div>

                            {formError && <div className="calError">{formError}</div>}
                        </div>

                        <div className="calModalFoot">
                            <button type="button" className="calBtn calBtnGhost" onClick={closeAddModal}>
                                취소
                            </button>
                            <button type="button" className="calBtn calBtnPrimary" onClick={saveEventFromModal}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Calendar;
