import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./Calendar.css";

function Calendar() {
    /* =========================
       Ref (FullCalendar 제어용)
    ========================= */
    let calendarRef = useRef(null);

    /* =========================
       달력 화면(월) 표시 관련 상태
    ========================= */
    let [visibleRange, setVisibleRange] = useState(null);
    let [visibleTitle, setVisibleTitle] = useState("");

    /* =========================
       리스트 ⋮ 메뉴 / 수정 모드 상태
    ========================= */
    let [openMenuId, setOpenMenuId] = useState(null); // ⋮ 메뉴 열린 이벤트 id
    let [editingEventId, setEditingEventId] = useState(null); // null이면 추가, 있으면 수정

    /* =========================
       더미 일정 데이터 (DB 연동 전)
    ========================= */
    let initialEvents = useMemo(() => {
        return [
            { id: "1", title: "정보처리기사 접수 시작", start: "2026-01-20", extendedProps: { type: "REGISTRATION" } },
            { id: "2", title: "SQLD 시험", start: "2026-02-02", extendedProps: { type: "EXAM" } },
            // FullCalendar는 end가 'exclusive'라서 1/20~1/27을 채우려면 end를 1/28로 넣는 형태가 정상
            { id: "3", title: "정처기 접수 기간", start: "2026-01-20", end: "2026-01-28", extendedProps: { type: "REGISTRATION" } },
            { id: "4", title: "기타 일정", start: "2026-01-22", extendedProps: { type: "OTHER", customLabel: "서류 준비" } },
        ];
    }, []);

    let [events, setEvents] = useState(initialEvents);

    /* =========================
       모달 상태
    ========================= */
    let [isAddOpen, setIsAddOpen] = useState(false);
    let [formError, setFormError] = useState("");

    let [form, setForm] = useState({
        title: "",
        description: "",
        start: "",
        end: "", // 사용자는 "포함 종료일"로 입력한다고 가정 (저장 시 +1 해서 FC end(exclusive)로 변환)
        type: "OTHER",
        customLabel: "",
        colorHex: "#97c793",
        textColor: "#ffffff",
        isTextColorManual: false,
    });

    /* =========================
       유틸 함수
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

    // FullCalendar end(exclusive) -> 사용자 표시용 end(inclusive)
    let toInclusiveEnd = (endExclusiveYmd) => {
        return addDays(endExclusiveYmd, -1);
    };

    // 사용자 입력 end(inclusive) -> FullCalendar end(exclusive)
    let toExclusiveEnd = (endInclusiveYmd) => {
        return addDays(endInclusiveYmd, 1);
    };

    let fmtDate = (yyyyMmDd) => {
        let [, m, d] = yyyyMmDd.split("-");
        return `${m}.${d}`;
    };

    // 배경색(hex)에 따라 자동으로 글자색 추천
    let getAutoTextColor = (hex) => {
        if (!hex) return "#ffffff";

        let c = hex.replace("#", "").trim();
        if (c.length !== 6) return "#ffffff";

        let r = parseInt(c.slice(0, 2), 16);
        let g = parseInt(c.slice(2, 4), 16);
        let b = parseInt(c.slice(4, 6), 16);

        let brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 150 ? "#000000" : "#ffffff";
    };

    // 일정이 현재 달력 화면 범위에 걸치는지(리스트 필터)
    let overlaps = (event, range) => {
        if (!range) return true;

        let s = event.start instanceof Date ? event.start : toDate(event.start);

        // end가 있으면 exclusive 기준
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
       오른쪽 리스트(현재 월 일정) 계산
    ========================= */
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

    /* =========================
       라벨/스타일
    ========================= */
    let typeLabel = (ev) => {
        let t = ev.extendedProps?.type;
        if (t === "REGISTRATION") return "접수";
        if (t === "EXAM") return "시험";
        if (t === "RESULT") return "발표";
        if (t === "OTHER") return ev.extendedProps?.customLabel || "기타";
        return "일정";
    };

    let eventClassNames = (arg) => {
        let t = arg.event.extendedProps?.type;
        if (t === "REGISTRATION") return ["calEvent", "reg"];
        if (t === "EXAM") return ["calEvent", "exam"];
        if (t === "RESULT") return ["calEvent", "result"];
        return ["calEvent", "other"];
    };

    /* =========================
       모달 열기/닫기
    ========================= */
    let closeAddModal = () => {
        setIsAddOpen(false);
        setFormError("");
        setEditingEventId(null);
    };

    // 추가 모드
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
            isTextColorManual: false,
        });

        setFormError("");
        setIsAddOpen(true);
    };

    let onChangeForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    // 수정 모드
    let openEditModal = (eventLike) => {
        setEditingEventId(eventLike.id);
        setOpenMenuId(null);

        let startStr =
            typeof eventLike.start === "string"
                ? eventLike.start
                : eventLike.startStr?.slice(0, 10) || "";

        // eventLike.end는 FullCalendar 기준(exclusive)일 수 있으니, 사용자 입력은 inclusive로 변환
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
            isTextColorManual: true,
        });

        setFormError("");
        setIsAddOpen(true);
    };

    /* =========================
       추가/수정 저장
    ========================= */
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

        // 종료일이 비어있으면 "단일 일정"으로 처리
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

        // FullCalendar end는 exclusive
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

    /* =========================
       삭제
    ========================= */
    let deleteEventById = (id) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setOpenMenuId(null);

        if (editingEventId === id) {
            closeAddModal();
        }
    };
    const [sp] = useSearchParams();

    useEffect(() => {
        if (sp.get("modal") === "add") openAddModal();
    }, [sp]);


    /* =========================
       렌더
    ========================= */
    return (
        <div
            className="page calPage"
            onMouseDown={() => {
                // 바깥 클릭하면 ⋮ 메뉴 닫기
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
                            setVisibleRange({
                                start: info.view.currentStart,
                                end: info.view.currentEnd,
                            });
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

                    <div
                        className="calListBody"
                        onMouseDown={(e) => {
                            // 리스트 영역 클릭으로도 메뉴 닫기
                            e.stopPropagation();
                            if (openMenuId) setOpenMenuId(null);
                        }}
                    >
                        {monthlyEvents.length === 0 && (
                            <div className="calEmpty">이번 달에 등록된 일정이 없습니다.</div>
                        )}

                        {monthlyEvents.map((ev) => {
                            let startStr =
                                typeof ev.start === "string"
                                    ? ev.start
                                    : ev.startStr?.slice(0, 10);

                            // ev.end는 FC exclusive -> 표시용으로 -1
                            let endStr = null;
                            if (ev.end) {
                                let rawEnd =
                                    typeof ev.end === "string"
                                        ? ev.end
                                        : ev.endStr?.slice(0, 10);
                                endStr = rawEnd ? toInclusiveEnd(rawEnd) : null;
                            }

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

                                            {/* ⋮ 버튼 */}
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

                                            {/* 메뉴 */}
                                            {openMenuId === ev.id && (
                                                <div
                                                    className="calKebabMenu"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        className="calKebabItem"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            openEditModal(ev);
                                                        }}
                                                    >
                                                        수정하기
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="calKebabItem calKebabDanger"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            deleteEventById(ev.id);
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

            {/* 일정 추가/수정 모달 */}
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

                            <label className="calField">
                                <span className="calFieldLabel">색상</span>
                                <input
                                    type="color"
                                    className="calColor"
                                    value={form.colorHex}
                                    onChange={(e) => {
                                        let nextColor = e.target.value;

                                        setForm((prev) => {
                                            if (prev.isTextColorManual) {
                                                return { ...prev, colorHex: nextColor };
                                            }
                                            return {
                                                ...prev,
                                                colorHex: nextColor,
                                                textColor: getAutoTextColor(nextColor),
                                            };
                                        });
                                    }}
                                    aria-label="색상 선택"
                                />
                            </label>

                            <label className="calField">
                                <span className="calFieldLabel">글자색</span>
                                <div className="calTextColorRow">
                                    <button
                                        type="button"
                                        className={`calTextColorBtn ${form.textColor === "#000000" ? "active" : ""}`}
                                        onMouseDown={() => {
                                            setForm((prev) => ({
                                                ...prev,
                                                textColor: "#000000",
                                                isTextColorManual: true,
                                            }));
                                        }}
                                    >
                                        검은색
                                    </button>

                                    <button
                                        type="button"
                                        className={`calTextColorBtn ${form.textColor === "#ffffff" ? "active" : ""}`}
                                        onMouseDown={() => {
                                            setForm((prev) => ({
                                                ...prev,
                                                textColor: "#ffffff",
                                                isTextColorManual: true,
                                            }));
                                        }}
                                    >
                                        하얀색
                                    </button>
                                </div>
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
        </div>
    );
}

export default Calendar;
