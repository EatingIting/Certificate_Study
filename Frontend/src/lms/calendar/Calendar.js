import React, { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import "./Calendar.css";

function toYmd(dateObj) {
    if (!dateObj) return "";
    let y = dateObj.getFullYear();
    let m = String(dateObj.getMonth() + 1).padStart(2, "0");
    let d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function safeTrim(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
}

function isBlank(v) {
    return safeTrim(v).length === 0;
}

function Calendar() {
    let calendarRef = useRef(null);

    // ===== API / auth (임시) =====
    // 네 프로젝트에 맞게 바꿔도 됨
    let API_BASE = "http://localhost:8080";
    let roomId = localStorage.getItem("roomId") || "";
    let userId = localStorage.getItem("userId") || "";

    // ===== State =====
    let [visibleRange, setVisibleRange] = useState(null);

    let [events, setEvents] = useState([]);
    let [studyEvents, setStudyEvents] = useState([]);

    let [openMenuId, setOpenMenuId] = useState(null);

    // 일반 일정 모달
    let [isAddModalOpen, setIsAddModalOpen] = useState(false);
    let [editingEventId, setEditingEventId] = useState(null);
    let [formError, setFormError] = useState("");
    let [form, setForm] = useState({
        title: "",
        description: "",
        start: "",
        end: "",
        type: "ETC",
        customLabel: "",
        colorHex: "#3b82f6",
        textColor: "#ffffff"
    });

    // 스터디 일정 모달
    let [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
    let [editingStudyId, setEditingStudyId] = useState(null);
    let [studyError, setStudyError] = useState("");
    let [studyForm, setStudyForm] = useState({
        round: "",
        date: "",
        description: ""
    });

    // ===== Derived =====
    let allEvents = useMemo(() => {
        return [...events, ...studyEvents];
    }, [events, studyEvents]);

    // 날짜별 회차 맵: { "YYYY-MM-DD": [1,2,3] }
    let studyRoundsByDate = useMemo(() => {
        let map = {};
        for (let i = 0; i < studyEvents.length; i++) {
            let ev = studyEvents[i];
            let start = ev?.start;
            let dateKey = "";

            if (typeof start === "string") {
                dateKey = start.slice(0, 10);
            } else if (start instanceof Date) {
                dateKey = toYmd(start);
            }

            if (!dateKey) continue;

            let round = ev?.extendedProps?.round;
            if (!map[dateKey]) map[dateKey] = [];
            if (round && !map[dateKey].includes(round)) map[dateKey].push(round);
        }

        // 정렬
        let keys = Object.keys(map);
        for (let k = 0; k < keys.length; k++) {
            map[keys[k]].sort((a, b) => a - b);
        }
        return map;
    }, [studyEvents]);

    // ===== Helpers =====
    function typeLabel(type, customLabel) {
        if (type === "STUDY") return "스터디";
        if (type === "EXAM") return "시험";
        if (type === "PRESENTATION") return "발표";
        if (type === "ASSIGNMENT") return "과제";
        if (type === "OTHER") return safeTrim(customLabel) || "기타";
        return "기타";
    }

    async function reloadRange() {
        if (!visibleRange) return;
        if (isBlank(roomId)) return;

        let start = toYmd(visibleRange.start);
        let end = toYmd(visibleRange.end); // 보통 FullCalendar의 end는 exclusive 성격

        try {
            let res = await axios.get(`${API_BASE}/api/rooms/${roomId}/schedule`, {
                params: { start, end }
            });

            let items = res.data?.items || [];

            let nextEvents = [];
            let nextStudy = [];

            for (let i = 0; i < items.length; i++) {
                let ev = items[i];
                let t = ev?.extendedProps?.type;

                if (t === "STUDY") nextStudy.push(ev);
                else nextEvents.push(ev);
            }

            setEvents(nextEvents);
            setStudyEvents(nextStudy);
        } catch (e) {
            console.error(e);
        }
    }

    // ===== Load when visibleRange changes =====
    useEffect(() => {
        reloadRange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleRange, roomId]);

    // ===== Calendar handlers =====
    function handleDatesSet(arg) {
        // arg.view.currentStart/currentEnd
        // currentEnd는 보통 "다음 달 1일" 같은 배타 범위로 들어옴
        setVisibleRange({
            start: arg?.view?.currentStart || null,
            end: arg?.view?.currentEnd || null
        });
    }

    function handleDateClick(info) {
        // 날짜 클릭 시: 일반 일정 모달 기본값 세팅
        let dateStr = info?.dateStr || "";
        setEditingEventId(null);
        setFormError("");
        setForm({
            title: "",
            description: "",
            start: dateStr,
            end: "",
            type: "ETC",
            customLabel: "",
            colorHex: "#3b82f6",
            textColor: "#ffffff"
        });
        setIsAddModalOpen(true);
    }

    function eventClassNames(arg) {
        let t = arg?.event?.extendedProps?.type;
        if (t === "STUDY") return ["calEvent", "study"];
        return ["calEvent"];
    }

    function dayCellContent(arg) {
        // 날짜칸 상단에 회차 표시(스터디)
        // arg.date: Date
        let key = toYmd(arg.date);
        let rounds = studyRoundsByDate[key] || [];

        return (
            <div className="calDayCell">
                <div className="calDayTop">
                    <span className="calDayNumber">{arg.dayNumberText}</span>
                    {rounds.length > 0 ? (
                        <span className="calStudyRounds">
                            {rounds.map((r, idx) => (
                                <span key={`${key}-${r}`}>
                                    {r}회차{idx < rounds.length - 1 ? " " : ""}
                                </span>
                            ))}
                        </span>
                    ) : null}
                </div>
            </div>
        );
    }

    // ===== Modal open/close =====
    function closeAddModal() {
        setIsAddModalOpen(false);
        setEditingEventId(null);
        setFormError("");
    }

    function closeStudyModal() {
        setIsStudyModalOpen(false);
        setEditingStudyId(null);
        setStudyError("");
    }

    // ===== CRUD: Schedule (일반 일정) =====
    async function saveEventFromModal() {
        setFormError("");

        let title = safeTrim(form.title);
        if (isBlank(title)) {
            setFormError("제목을 입력해 주세요.");
            return;
        }
        if (isBlank(form.start)) {
            setFormError("시작일을 선택해 주세요.");
            return;
        }
        if (isBlank(roomId) || isBlank(userId)) {
            setFormError("roomId/userId가 없습니다. 로그인/방 선택 로직을 확인해 주세요.");
            return;
        }

        // end는 선택: 비어있으면 start로 처리(백엔드에서도 동일 규칙이면 안정적)
        let start = form.start;
        let end = isBlank(form.end) ? "" : form.end;

        try {
            if (!editingEventId) {
                // CREATE
                let body = {
                    roomId,
                    userId,
                    title,
                    description: safeTrim(form.description),
                    start,
                    end,
                    type: form.type,
                    colorHex: form.colorHex,
                    textColor: form.textColor,
                    customLabel: safeTrim(form.customLabel)
                };

                await axios.post(`${API_BASE}/api/schedules`, body);
            } else {
                // UPDATE
                let body = {
                    title,
                    description: safeTrim(form.description),
                    start,
                    end,
                    type: form.type,
                    colorHex: form.colorHex,
                    customLabel: safeTrim(form.customLabel)
                };

                await axios.put(`${API_BASE}/api/schedules/${editingEventId}`, body, {
                    params: { roomId, userId }
                });
            }

            closeAddModal();
            await reloadRange();
        } catch (e) {
            console.error(e);
            setFormError("저장에 실패했습니다.");
        }
    }

    async function deleteEventById(id) {
        if (isBlank(roomId) || isBlank(userId)) return;

        try {
            await axios.delete(`${API_BASE}/api/schedules/${id}`, {
                params: { roomId, userId }
            });

            setOpenMenuId(null);
            if (editingEventId === id) closeAddModal();
            await reloadRange();
        } catch (e) {
            console.error(e);
        }
    }

    function openEditEvent(ev) {
        let id = ev?.id;
        setEditingEventId(id);
        setFormError("");

        setForm({
            title: ev?.title || "",
            description: ev?.extendedProps?.description || "",
            start: (ev?.start || "").slice ? ev.start.slice(0, 10) : ev?.start || "",
            end: (ev?.end || "").slice ? ev.end.slice(0, 10) : ev?.end || "",
            type: ev?.extendedProps?.type || "ETC",
            customLabel: ev?.extendedProps?.customLabel || "",
            colorHex: ev?.backgroundColor || ev?.color || "#3b82f6",
            textColor: ev?.textColor || "#ffffff"
        });

        setIsAddModalOpen(true);
        setOpenMenuId(null);
    }

    // ===== CRUD: StudySchedule (스터디 일정) =====
    async function saveStudyFromModal() {
        setStudyError("");

        let roundNum = Number(studyForm.round);
        if (!roundNum || roundNum < 1) {
            setStudyError("회차는 1 이상의 숫자여야 합니다.");
            return;
        }
        if (isBlank(studyForm.date)) {
            setStudyError("날짜를 선택해 주세요.");
            return;
        }
        if (isBlank(roomId)) {
            setStudyError("roomId가 없습니다. 방 선택 로직을 확인해 주세요.");
            return;
        }

        try {
            if (!editingStudyId) {
                // CREATE
                let body = {
                    roomId,
                    round: roundNum,
                    date: studyForm.date,
                    description: safeTrim(studyForm.description)
                };
                await axios.post(`${API_BASE}/api/study-schedules`, body);
            } else {
                // UPDATE
                let body = {
                    round: roundNum,
                    date: studyForm.date,
                    description: safeTrim(studyForm.description)
                };

                await axios.put(`${API_BASE}/api/study-schedules/${editingStudyId}`, body, {
                    params: { roomId }
                });
            }

            closeStudyModal();
            await reloadRange();
        } catch (e) {
            console.error(e);
            setStudyError("저장에 실패했습니다.");
        }
    }

    async function deleteStudyById(id) {
        if (isBlank(roomId)) return;

        try {
            await axios.delete(`${API_BASE}/api/study-schedules/${id}`, {
                params: { roomId }
            });

            setOpenMenuId(null);
            if (editingStudyId === id) closeStudyModal();
            await reloadRange();
        } catch (e) {
            console.error(e);
        }
    }

    function openCreateStudy(dateStr) {
        setEditingStudyId(null);
        setStudyError("");
        setStudyForm({
            round: "",
            date: dateStr || "",
            description: ""
        });
        setIsStudyModalOpen(true);
        setOpenMenuId(null);
    }

    function openEditStudy(ev) {
        setEditingStudyId(ev?.id);
        setStudyError("");

        let start = ev?.start || "";
        let date = "";
        if (typeof start === "string") date = start.slice(0, 10);
        else if (start instanceof Date) date = toYmd(start);

        setStudyForm({
            round: ev?.extendedProps?.round || "",
            date,
            description: ev?.extendedProps?.description || ""
        });

        setIsStudyModalOpen(true);
        setOpenMenuId(null);
    }

    // ===== UI: Right list (events grouped by date) =====
    let monthlyEvents = useMemo(() => {
        // allEvents를 start 기준으로 정렬해서 리스트용으로 사용
        let list = [...allEvents];
        list.sort((a, b) => {
            let sa = a?.start || "";
            let sb = b?.start || "";
            return String(sa).localeCompare(String(sb));
        });
        return list;
    }, [allEvents]);

    // ===== Render =====
    return (
        <div className="calendarWrap">
            <div className="calendarLeft">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    height="auto"
                    fixedWeekCount={false}
                    showNonCurrentDates={true}
                    dayMaxEvents={true}
                    datesSet={handleDatesSet}
                    dateClick={handleDateClick}
                    events={allEvents}
                    eventClassNames={eventClassNames}
                    dayCellContent={dayCellContent}
                />
            </div>

            <div className="calendarRight">
                <div className="calRightHeader">
                    <div className="calRightTitle">이번 달 일정</div>
                    <div className="calRightActions">
                        <button
                            className="calBtn calBtnPrimary"
                            onClick={() => openCreateStudy(toYmd(new Date()))}
                        >
                            스터디 회차 추가
                        </button>
                        <button
                            className="calBtn"
                            onClick={() => {
                                setEditingEventId(null);
                                setFormError("");
                                setForm({
                                    title: "",
                                    description: "",
                                    start: toYmd(new Date()),
                                    end: "",
                                    type: "ETC",
                                    customLabel: "",
                                    colorHex: "#3b82f6",
                                    textColor: "#ffffff"
                                });
                                setIsAddModalOpen(true);
                            }}
                        >
                            일정 추가
                        </button>
                    </div>
                </div>

                <div className="calList">
                    {monthlyEvents.length === 0 ? (
                        <div className="calEmpty">표시할 일정이 없습니다.</div>
                    ) : (
                        monthlyEvents.map((ev) => {
                            let isStudy = ev?.extendedProps?.type === "STUDY";
                            let label = typeLabel(ev?.extendedProps?.type, ev?.extendedProps?.customLabel);

                            return (
                                <div key={ev.id} className="calListItem">
                                    <div className="calListMain">
                                        <div className="calListTop">
                                            <span className={`calBadge ${isStudy ? "study" : ""}`}>
                                                {label}
                                            </span>
                                            <span className="calDate">
                                                {(ev.start || "").slice ? ev.start.slice(0, 10) : ev.start}
                                            </span>
                                        </div>

                                        <div className="calListTitleRow">
                                            <span className="calListTitle">{ev.title}</span>

                                            <button
                                                className="calKebab"
                                                onClick={() => setOpenMenuId(openMenuId === ev.id ? null : ev.id)}
                                            >
                                                ⋮
                                            </button>

                                            {openMenuId === ev.id ? (
                                                <div className="calMenu">
                                                    <button
                                                        className="calMenuItem"
                                                        onClick={() => {
                                                            if (isStudy) openEditStudy(ev);
                                                            else openEditEvent(ev);
                                                        }}
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        className="calMenuItem danger"
                                                        onClick={() => {
                                                            if (isStudy) deleteStudyById(ev.id);
                                                            else deleteEventById(ev.id);
                                                        }}
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>

                                        {ev?.extendedProps?.description ? (
                                            <div className="calListDesc">{ev.extendedProps.description}</div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ===== 일반 일정 모달 ===== */}
            {isAddModalOpen ? (
                <div className="calModalOverlay" onClick={closeAddModal}>
                    <div className="calModal" onClick={(e) => e.stopPropagation()}>
                        <div className="calModalHeader">
                            <div className="calModalTitle">
                                {editingEventId ? "일정 수정" : "일정 추가"}
                            </div>
                            <button className="calModalClose" onClick={closeAddModal}>
                                ✕
                            </button>
                        </div>

                        <div className="calModalBody">
                            {formError ? <div className="calError">{formError}</div> : null}

                            <label className="calField">
                                <span className="calFieldLabel">제목</span>
                                <input
                                    className="calInput"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </label>

                            <label className="calField">
                                <span className="calFieldLabel">설명</span>
                                <textarea
                                    className="calTextarea"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </label>

                            <div className="calRow">
                                <label className="calField">
                                    <span className="calFieldLabel">시작일</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.start}
                                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">종료일(선택)</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.end}
                                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="calRow">
                                <label className="calField">
                                    <span className="calFieldLabel">유형</span>
                                    <select
                                        className="calSelect"
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="ASSIGNMENT">과제</option>
                                        <option value="EXAM">시험</option>
                                        <option value="PRESENTATION">발표</option>
                                        <option value="OTHER">기타(직접 입력)</option>
                                        <option value="ETC">기타</option>
                                    </select>
                                </label>

                                {form.type === "OTHER" ? (
                                    <label className="calField">
                                        <span className="calFieldLabel">기타 라벨</span>
                                        <input
                                            className="calInput"
                                            value={form.customLabel}
                                            onChange={(e) => setForm({ ...form, customLabel: e.target.value })}
                                        />
                                    </label>
                                ) : null}
                            </div>

                            <div className="calRow">
                                <label className="calField">
                                    <span className="calFieldLabel">배경색</span>
                                    <input
                                        type="color"
                                        className="calColor"
                                        value={form.colorHex}
                                        onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">글자색</span>
                                    <input
                                        type="color"
                                        className="calColor"
                                        value={form.textColor}
                                        onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="calModalFooter">
                            <button className="calBtn" onClick={closeAddModal}>
                                취소
                            </button>
                            <button className="calBtn calBtnPrimary" onClick={saveEventFromModal}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ===== 스터디 모달 ===== */}
            {isStudyModalOpen ? (
                <div className="calModalOverlay" onClick={closeStudyModal}>
                    <div className="calModal" onClick={(e) => e.stopPropagation()}>
                        <div className="calModalHeader">
                            <div className="calModalTitle">
                                {editingStudyId ? "스터디 회차 수정" : "스터디 회차 추가"}
                            </div>
                            <button className="calModalClose" onClick={closeStudyModal}>
                                ✕
                            </button>
                        </div>

                        <div className="calModalBody">
                            {studyError ? <div className="calError">{studyError}</div> : null}

                            <div className="calRow">
                                <label className="calField">
                                    <span className="calFieldLabel">회차</span>
                                    <input
                                        type="number"
                                        className="calInput"
                                        value={studyForm.round}
                                        onChange={(e) => setStudyForm({ ...studyForm, round: e.target.value })}
                                        min="1"
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">날짜</span>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={studyForm.date}
                                        onChange={(e) => setStudyForm({ ...studyForm, date: e.target.value })}
                                    />
                                </label>
                            </div>

                            <label className="calField">
                                <span className="calFieldLabel">설명</span>
                                <textarea
                                    className="calTextarea"
                                    value={studyForm.description}
                                    onChange={(e) => setStudyForm({ ...studyForm, description: e.target.value })}
                                />
                            </label>
                        </div>

                        <div className="calModalFooter">
                            <button className="calBtn" onClick={closeStudyModal}>
                                취소
                            </button>
                            <button className="calBtn calBtnPrimary" onClick={saveStudyFromModal}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Calendar;
