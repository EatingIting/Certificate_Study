import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./Calendar.css";

function Calendar() {
    let calendarRef = useRef(null);

    let [sp, setSp] = useSearchParams();

    let [visibleRange, setVisibleRange] = useState(null);
    let [visibleTitle, setVisibleTitle] = useState("");

    let [openMenuId, setOpenMenuId] = useState(null);

    /* =========================
       일반 일정(더미)
    ========================= */
    let initialEvents = useMemo(() => {
        return [
            {
                id: "1",
                title: "정보처리기사 접수 시작",
                start: "2026-01-20",
                extendedProps: { type: "REGISTRATION" },
                backgroundColor: "#e9fadc",
                borderColor: "#e9fadc",
                textColor: "#2f6a2f",
            },
            {
                id: "2",
                title: "SQLD 시험",
                start: "2026-02-02",
                extendedProps: { type: "EXAM" },
                backgroundColor: "#97c793",
                borderColor: "#97c793",
                textColor: "#ffffff",
            },
            {
                id: "3",
                title: "정처기 접수 기간",
                start: "2026-01-20",
                end: "2026-01-28",
                extendedProps: { type: "REGISTRATION" },
                backgroundColor: "#e9fadc",
                borderColor: "#e9fadc",
                textColor: "#2f6a2f",
            },
            {
                id: "4",
                title: "기타 일정",
                start: "2026-01-22",
                extendedProps: { type: "OTHER", customLabel: "서류 준비" },
                backgroundColor: "#eef5ec",
                borderColor: "#eef5ec",
                textColor: "#374151",
            },
        ];
    }, []);

    let [events, setEvents] = useState(initialEvents);

    /* =========================
       스터디 일정(더미)
    ========================= */
    let initialStudyEvents = useMemo(() => {
        return [
            {
                id: "S1",
                title: "스터디 1회차",
                start: "2026-01-21",
                extendedProps: {
                    type: "STUDY",
                    round: 1,
                    description: "오리엔테이션 / 진행 방식 정하기",
                },
            },
        ];
    }, []);

    let [studyEvents, setStudyEvents] = useState(initialStudyEvents);

    /* =========================
       모달 - 일반 일정
    ========================= */
    let [isAddOpen, setIsAddOpen] = useState(false);
    let [editingEventId, setEditingEventId] = useState(null);
    let [formError, setFormError] = useState("");

    let [form, setForm] = useState({
        title: "",
        description: "",
        start: "",
        end: "",
        type: "OTHER",
        customLabel: "",
        colorHex: "#97c793",
        textColor: "#ffffff",
    });

    /* =========================
       모달 - 스터디
    ========================= */
    let [isStudyOpen, setIsStudyOpen] = useState(false);
    let [editingStudyId, setEditingStudyId] = useState(null);
    let [studyError, setStudyError] = useState("");

    let [studyForm, setStudyForm] = useState({
        round: 1,
        date: "",
        description: "",
    });

    /* =========================
       유틸
    ========================= */
    let toDate = (yyyyMmDd) => {
        let [y, m, d] = yyyyMmDd.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    let toYmd = (date) => {
        let y = date.getFullYear();
        let m = String(date.getMonth() + 1).padStart(2, "0");
        let d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    let addDays = (yyyyMmDd, days) => {
        let dt = toDate(yyyyMmDd);
        dt.setDate(dt.getDate() + days);
        return toYmd(dt);
    };

    // FullCalendar end(exclusive) -> 표시용 end(inclusive)
    let toInclusiveEnd = (endExclusiveYmd) => addDays(endExclusiveYmd, -1);

    // 입력 end(inclusive) -> FullCalendar end(exclusive)
    let toExclusiveEnd = (endInclusiveYmd) => addDays(endInclusiveYmd, 1);

    let fmtDate = (yyyyMmDd) => {
        let [, m, d] = yyyyMmDd.split("-");
        return `${m}.${d}`;
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

    /* =========================
       달력 표시 이벤트(합치기)
    ========================= */
    let allEvents = useMemo(() => {
        return [...events, ...studyEvents];
    }, [events, studyEvents]);

    /* =========================
       날짜 상단 "회차" 맵
    ========================= */
    let studyRoundsByDate = useMemo(() => {
        let map = {};

        for (let i = 0; i < studyEvents.length; i++) {
            let ev = studyEvents[i];

            let ymd =
                typeof ev.start === "string"
                    ? ev.start
                    : ev.startStr?.slice(0, 10);

            if (!ymd) continue;

            let round = Number(ev.extendedProps?.round);
            if (!round) continue;

            if (!map[ymd]) map[ymd] = [];
            map[ymd].push(round);
        }

        for (let key in map) {
            map[key] = Array.from(new Set(map[key])).sort((a, b) => a - b);
        }

        return map;
    }, [studyEvents]);

    /* =========================
       오른쪽 리스트
    ========================= */
    let monthlyEvents = useMemo(() => {
        if (!visibleRange) return allEvents;

        let filtered = allEvents.filter((ev) => overlaps(ev, visibleRange));

        filtered.sort((a, b) => {
            let aS = a.start instanceof Date ? a.start : toDate(a.start);
            let bS = b.start instanceof Date ? b.start : toDate(b.start);
            return aS - bS;
        });

        return filtered;
    }, [allEvents, visibleRange]);

    /* =========================
       라벨/스타일
    ========================= */
    let typeLabel = (ev) => {
        let t = ev.extendedProps?.type;
        if (t === "STUDY") return "스터디";
        if (t === "REGISTRATION") return "접수";
        if (t === "EXAM") return "시험";
        if (t === "RESULT") return "발표";
        if (t === "OTHER") return ev.extendedProps?.customLabel || "기타";
        return "일정";
    };

    let eventClassNames = (arg) => {
        let t = arg.event.extendedProps?.type;
        if (t === "STUDY") return ["calEvent", "study"];
        if (t === "REGISTRATION") return ["calEvent", "reg"];
        if (t === "EXAM") return ["calEvent", "exam"];
        if (t === "RESULT") return ["calEvent", "result"];
        return ["calEvent", "other"];
    };

    /* =========================
       URL 쿼리
    ========================= */
    let goListView = () => {
        let next = new URLSearchParams(sp);
        next.delete("modal");
        next.set("view", "list");
        setSp(next, { replace: true });
    };

    /* =========================
       일반 일정 모달
    ========================= */
    let closeAddModal = () => {
        setIsAddOpen(false);
        setFormError("");
        setEditingEventId(null);

        if (sp.get("modal") === "add") {
            goListView();
        }
    };

    let openAddModal = () => {
        setEditingEventId(null);
        setOpenMenuId(null);

        setForm({
            title: "",
            description: "",
            start: "",
            end: "",
            type: "OTHER",
            customLabel: "",
            colorHex: "#97c793",
            textColor: "#ffffff",
        });

        setFormError("");
        setIsAddOpen(true);
    };

    let openEditModal = (eventLike) => {
        setEditingEventId(eventLike.id);
        setOpenMenuId(null);

        let startStr =
            typeof eventLike.start === "string"
                ? eventLike.start
                : eventLike.startStr?.slice(0, 10) || "";

        let endInclusive = "";
        if (eventLike.end) {
            let endStr =
                typeof eventLike.end === "string"
                    ? eventLike.end
                    : eventLike.endStr?.slice(0, 10) || "";
            endInclusive = endStr ? toInclusiveEnd(endStr) : "";
        }

        setForm({
            title: eventLike.title || "",
            description: eventLike.extendedProps?.description || "",
            start: startStr,
            end: endInclusive,
            type: eventLike.extendedProps?.type || "OTHER",
            customLabel: eventLike.extendedProps?.customLabel || "",
            colorHex: eventLike.backgroundColor || "#97c793",
            textColor: eventLike.textColor || "#ffffff",
        });

        setFormError("");
        setIsAddOpen(true);
    };

    let onChangeForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
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

        let hasEnd = Boolean(form.end);
        let endInclusive = hasEnd ? form.end : null;

        if (hasEnd && endInclusive < form.start) {
            setFormError("종료일은 시작일 이후여야 합니다.");
            return;
        }

        let extendedProps = {
            type: form.type,
            description: form.description.trim(),
        };

        if (form.type === "OTHER" && form.customLabel.trim()) {
            extendedProps.customLabel = form.customLabel.trim();
        }

        let endExclusive = hasEnd ? toExclusiveEnd(endInclusive) : null;

        let nextEvent = {
            id: editingEventId ? editingEventId : String(Date.now()),
            title,
            start: form.start,
            ...(endExclusive ? { end: endExclusive } : {}),
            extendedProps,
            backgroundColor: form.colorHex,
            borderColor: form.colorHex,
            textColor: form.textColor,
        };

        if (!editingEventId) {
            setEvents((prev) => [...prev, nextEvent]);
        } else {
            setEvents((prev) => prev.map((e) => (e.id === editingEventId ? nextEvent : e)));
        }

        closeAddModal();
    };

    let deleteEventById = (id) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setOpenMenuId(null);

        if (editingEventId === id) {
            closeAddModal();
        }
    };

    /* =========================
       스터디 모달
    ========================= */
    let closeStudyModal = () => {
        setIsStudyOpen(false);
        setEditingStudyId(null);
        setStudyError("");
    };

    let openStudyAddModal = () => {
        setEditingStudyId(null);
        setOpenMenuId(null);

        setStudyForm({
            round: 1,
            date: "",
            description: "",
        });

        setStudyError("");
        setIsStudyOpen(true);
    };

    let openStudyEditModal = (studyEvent) => {
        setEditingStudyId(studyEvent.id);
        setOpenMenuId(null);

        let dateStr =
            typeof studyEvent.start === "string"
                ? studyEvent.start
                : studyEvent.startStr?.slice(0, 10) || "";

        setStudyForm({
            round: Number(studyEvent.extendedProps?.round || 1),
            date: dateStr,
            description: studyEvent.extendedProps?.description || "",
        });

        setStudyError("");
        setIsStudyOpen(true);
    };

    let onChangeStudyForm = (key, value) => {
        setStudyForm((prev) => ({ ...prev, [key]: value }));
    };

    let saveStudyFromModal = () => {
        let roundNum = Number(studyForm.round);

        if (!roundNum || roundNum < 1) {
            setStudyError("회차는 1 이상 숫자로 입력해 주세요.");
            return;
        }

        if (!studyForm.date) {
            setStudyError("날짜를 선택해 주세요.");
            return;
        }

        let title = `스터디 ${roundNum}회차`;

        let nextStudyEvent = {
            id: editingStudyId ? editingStudyId : `S${Date.now()}`,
            title,
            start: studyForm.date,
            extendedProps: {
                type: "STUDY",
                round: roundNum,
                description: studyForm.description.trim(),
            },
        };

        if (!editingStudyId) {
            setStudyEvents((prev) => [...prev, nextStudyEvent]);
        } else {
            setStudyEvents((prev) => prev.map((e) => (e.id === editingStudyId ? nextStudyEvent : e)));
        }

        closeStudyModal();
    };

    let deleteStudyById = (id) => {
        setStudyEvents((prev) => prev.filter((e) => e.id !== id));
        setOpenMenuId(null);

        if (editingStudyId === id) {
            closeStudyModal();
        }
    };

    /* =========================
       URL modal=add 대응
    ========================= */
    useEffect(() => {
        if (sp.get("modal") === "add") openAddModal();
    }, [sp]);

    /* =========================
       팔레트(일정 색) - 온실 톤 중심
    ========================= */
    let palette = useMemo(() => {
        return ["#97c793", "#a5dea0", "#e9fadc", "#eef5ec", "#f6faf3"];
    }, []);

    return (
        <div
            className="page calPage"
            onMouseDown={() => {
                if (openMenuId) setOpenMenuId(null);
            }}
        >
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
                        events={allEvents}
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
                            setVisibleRange({
                                start: info.view.currentStart,
                                end: info.view.currentEnd,
                            });
                            setVisibleTitle(info.view.title || "");
                        }}
                        /* 날짜칸 상단: 날짜 숫자 + 스터디 회차 */
                        dayCellContent={(arg) => {
                            let ymd = toYmd(arg.date);
                            let rounds = studyRoundsByDate[ymd];

                            let roundText = "";
                            if (rounds && rounds.length > 0) {
                                roundText = rounds.length === 1 ? `${rounds[0]}회차` : `${rounds.join(",")}회차`;
                            }

                            return (
                                <div className="calDayTopRow">
                                    <span className="calDayNum">{arg.date.getDate()}</span>
                                    {roundText ? <span className="calDayStudyRound">{roundText}</span> : null}
                                </div>
                            );
                        }}
                    />
                </div>

                {/* 오른쪽: 월간 일정 목록 */}
                <div className="card calCard calListCard">
                    <div className="calListHead">
                        <div className="cardTitle calListTitle">
                            {visibleTitle ? `${visibleTitle} 일정` : "이번 달 일정"}
                        </div>

                        <div className="calListActions">
                            <button
                                type="button"
                                className="calStudyBtn"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    openStudyAddModal();
                                }}
                            >
                                스터디 일정 추가
                            </button>

                            <button
                                type="button"
                                className="calAddBtn"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    openAddModal();
                                }}
                            >
                                일정 추가
                            </button>
                        </div>
                    </div>

                    <div
                        className="calListBody"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            if (openMenuId) setOpenMenuId(null);
                        }}
                    >
                        {monthlyEvents.length === 0 && (
                            <div className="calEmpty">이번 달에 등록된 일정이 없습니다.</div>
                        )}

                        {monthlyEvents.map((ev) => {
                            let startStr = typeof ev.start === "string" ? ev.start : ev.startStr?.slice(0, 10);

                            let endStr = null;
                            if (ev.end) {
                                let rawEnd = typeof ev.end === "string" ? ev.end : ev.endStr?.slice(0, 10);
                                endStr = rawEnd ? toInclusiveEnd(rawEnd) : null;
                            }

                            let isStudy = ev.extendedProps?.type === "STUDY";

                            return (
                                <div key={ev.id} className="calItem">
                                    <div className="calItemTop">
                                        <span className={`calBadge ${ev.extendedProps?.type || "OTHER"}`}>
                                            {typeLabel(ev)}
                                        </span>

                                        <div className="calItemRight">
                                            <span className="calDate">
                                                {startStr ? fmtDate(startStr) : ""}
                                                {endStr ? ` ~ ${fmtDate(endStr)}` : ""}
                                            </span>

                                            <button
                                                type="button"
                                                className="calKebabBtn"
                                                aria-label="일정 메뉴"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId((prev) => (prev === ev.id ? null : ev.id));
                                                }}
                                            >
                                                ⋮
                                            </button>

                                            {openMenuId === ev.id && (
                                                <div className="calKebabMenu" onMouseDown={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        className="calKebabItem"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            if (isStudy) openStudyEditModal(ev);
                                                            else openEditModal(ev);
                                                        }}
                                                    >
                                                        수정하기
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="calKebabItem calKebabDanger"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            if (isStudy) deleteStudyById(ev.id);
                                                            else deleteEventById(ev.id);
                                                        }}
                                                    >
                                                        삭제하기
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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

            {/* =========================
               일반 일정 추가/수정 모달
            ========================= */}
            {isAddOpen && (
                <div
                    className="calModalOverlay"
                    onMouseDown={() => {
                        setOpenMenuId(null);
                        closeAddModal();
                    }}
                >
                    <div className="calModal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="calModalHead">
                            <div className="calModalTitle">{editingEventId ? "일정 수정" : "일정 추가"}</div>
                            <button type="button" className="calModalClose" onMouseDown={closeAddModal}>
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

                            {/* ✅ 원래 느낌: 팔레트 + 글자색 버튼 + 미리보기 */}
                            <div className="calColorRow">
                                <div className="calColorGroup">
                                    <span className="calFieldLabel">색상</span>

                                    <div className="calColorBtns">
                                        {palette.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                className={`calColorBtn ${form.colorHex === c ? "isActive" : ""}`}
                                                style={{ background: c }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    onChangeForm("colorHex", c);
                                                }}
                                                aria-label={`색상 ${c}`}
                                                title={c}
                                            />
                                        ))}

                                        {/* 직접 선택도 유지 */}
                                        <input
                                            type="color"
                                            className="calColorPicker"
                                            value={form.colorHex}
                                            onChange={(e) => onChangeForm("colorHex", e.target.value)}
                                            title="색 직접 선택"
                                        />
                                    </div>
                                </div>

                                <div className="calColorGroup">
                                    <span className="calFieldLabel">글자</span>

                                    <div className="calColorBtns">
                                        {[
                                            { label: "흰색", value: "#ffffff" },
                                            { label: "검정", value: "#1f2937" },
                                        ].map((t) => (
                                            <button
                                                key={t.value}
                                                type="button"
                                                className={`calTextColorBtn ${form.textColor === t.value ? "isActive" : ""}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    onChangeForm("textColor", t.value);
                                                }}
                                                title={t.label}
                                            >
                                                <span className="calTextColorDot" style={{ background: t.value }} />
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="calColorPreview">
                                <span
                                    className="calPreviewPill"
                                    style={{
                                        backgroundColor: form.colorHex,
                                        color: form.textColor,
                                    }}
                                >
                                    미리보기
                                </span>
                            </div>

                            {formError && <div className="calError">{formError}</div>}
                        </div>

                        <div className="calModalFoot">
                            {editingEventId && (
                                <button
                                    type="button"
                                    className="calBtn calBtnGhost"
                                    onMouseDown={() => deleteEventById(editingEventId)}
                                >
                                    삭제하기
                                </button>
                            )}

                            <button type="button" className="calBtn calBtnGhost" onMouseDown={closeAddModal}>
                                취소
                            </button>

                            <button type="button" className="calBtn calBtnPrimary" onMouseDown={saveEventFromModal}>
                                {editingEventId ? "수정 저장" : "저장"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================
               스터디 일정 추가/수정 모달
            ========================= */}
            {isStudyOpen && (
                <div
                    className="calModalOverlay"
                    onMouseDown={() => {
                        setOpenMenuId(null);
                        closeStudyModal();
                    }}
                >
                    <div className="calModal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="calModalHead">
                            <div className="calModalTitle">{editingStudyId ? "스터디 일정 수정" : "스터디 일정 추가"}</div>
                            <button type="button" className="calModalClose" onMouseDown={closeStudyModal}>
                                ✕
                            </button>
                        </div>

                        <div className="calModalBody">
                            <div className="calRow2">
                                <label className="calField">
                                    <span className="calFieldLabel">회차</span>
                                    <input
                                        type="number"
                                        className="calInput"
                                        min={1}
                                        value={studyForm.round}
                                        onChange={(e) => onChangeStudyForm("round", e.target.value)}
                                        placeholder="예: 1"
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">날짜</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={studyForm.date}
                                        onChange={(e) => onChangeStudyForm("date", e.target.value)}
                                    />
                                </label>
                            </div>

                            <label className="calField">
                                <span className="calFieldLabel">설명(선택)</span>
                                <textarea
                                    className="calTextarea"
                                    value={studyForm.description}
                                    onChange={(e) => onChangeStudyForm("description", e.target.value)}
                                    placeholder="예: 준비물 / 숙제 / 링크"
                                    rows={3}
                                />
                            </label>

                            {studyError && <div className="calError">{studyError}</div>}
                        </div>

                        <div className="calModalFoot">
                            {editingStudyId && (
                                <button
                                    type="button"
                                    className="calBtn calBtnGhost"
                                    onMouseDown={() => deleteStudyById(editingStudyId)}
                                >
                                    삭제하기
                                </button>
                            )}

                            <button type="button" className="calBtn calBtnGhost" onMouseDown={closeStudyModal}>
                                취소
                            </button>

                            <button type="button" className="calBtn calBtnPrimary" onMouseDown={saveStudyFromModal}>
                                {editingStudyId ? "수정 저장" : "저장"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Calendar;
