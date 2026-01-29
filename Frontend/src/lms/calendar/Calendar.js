import React, { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./Calendar.css";

function Calendar() {
    let calendarRef = useRef(null);

    let [sp, setSp] = useSearchParams();

    let { subjectId } = useParams();

    // roomId는 라우트 파라미터(subjectId) 또는 쿼리(roomId/subjectId)에서 가져온다.
    let roomId = useMemo(() => {
        return subjectId || sp.get("roomId") || sp.get("subjectId") || "";
    }, [subjectId, sp]);

    let [visibleRange, setVisibleRange] = useState(null);
    let [visibleTitle, setVisibleTitle] = useState("");

    let [openMenuId, setOpenMenuId] = useState(null);
    let [isLoadingRemote, setIsLoadingRemote] = useState(false);
    let [remoteError, setRemoteError] = useState("");

    /* =========================
       일반 일정(더미)
    ========================= */
    let initialEvents = useMemo(() => {
        return [
            {
                id: "1",
                title: "정보처리기사 접수 시작",
                start: "2026-01-20",
                end: "2026-01-23",
                backgroundColor: "#e9fadc",
                borderColor: "#e9fadc",
                textColor: "#2f6a2f",
                extendedProps: {
                    type: "REGISTRATION",
                    customLabel: "접수",
                },
            },
            {
                id: "2",
                title: "정보처리기사 시험",
                start: "2026-01-25",
                backgroundColor: "#97c793",
                borderColor: "#97c793",
                textColor: "#ffffff",
                extendedProps: {
                    type: "EXAM",
                },
            },
            {
                id: "3",
                title: "정보처리기사 발표",
                start: "2026-01-30",
                backgroundColor: "#a5dea0",
                borderColor: "#a5dea0",
                textColor: "#1f2937",
                extendedProps: {
                    type: "RESULT",
                },
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
                },
            },
            {
                id: "S2",
                title: "스터디 2회차",
                start: "2026-01-24",
                extendedProps: {
                    type: "STUDY",
                    round: 2,
                },
            },
        ];
    }, []);

    let [studyEvents, setStudyEvents] = useState(initialStudyEvents);

    /* =========================
       UI 상태
    ========================= */
    let [isAddOpen, setIsAddOpen] = useState(false);
    let [isStudyAddOpen, setIsStudyAddOpen] = useState(false);

    let [editingEventId, setEditingEventId] = useState(null);
    let [editingStudyId, setEditingStudyId] = useState(null);

    let [formError, setFormError] = useState("");

    let [form, setForm] = useState({
        title: "",
        start: "",
        end: "",
        type: "OTHER",
        customLabel: "",
    });

    let [studyForm, setStudyForm] = useState({
        round: "",
        date: "",
        description: "",
    });

    /* =========================
       유틸
    ========================= */
    let clamp = (v) => (v == null ? "" : String(v));
    let parseYmd = (v) => clamp(v).slice(0, 10);

    let getTypeLabel = (ev) => {
        let t = ev.extendedProps?.type;
        if (t === "REGISTRATION") return ev.extendedProps?.customLabel || "접수";
        if (t === "EXAM") return "시험";
        if (t === "RESULT") return "발표";
        if (t === "OTHER") return ev.extendedProps?.customLabel || "기타";
        if (t === "STUDY") return `스터디`;
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
       서버 조회(캘린더 이벤트)
       - 더미는 유지하되, roomId + visibleRange가 잡히면 서버 데이터를 우선 사용
       - "CSS가 안 먹는 것처럼 보이는" 문제는 대부분 type/extendedProps 불일치라 정규화로 해결
    ========================= */
    let toYmd = (d) => {
        let y = d.getFullYear();
        let m = String(d.getMonth() + 1).padStart(2, "0");
        let day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    let normalizeEvent = (ev) => {
        let ext = ev?.extendedProps && typeof ev.extendedProps === "object" ? ev.extendedProps : {};
        let rawType = ext.type || ev?.type || "OTHER";
        let upper = String(rawType).toUpperCase();

        if (upper !== "STUDY" && upper !== "REGISTRATION" && upper !== "EXAM" && upper !== "RESULT") {
            upper = "OTHER";
        }

        // 색상이 없을 때도 더미와 비슷한 톤을 유지(커스텀 CSS 클래스가 핵심이지만, 기본 컬러도 보정)
        let defaults = {
            REGISTRATION: { bg: "#e9fadc", text: "#2f6a2f" },
            EXAM: { bg: "#97c793", text: "#ffffff" },
            RESULT: { bg: "#a5dea0", text: "#1f2937" },
            OTHER: { bg: "#eef5ec", text: "#374151" },
            STUDY: { bg: "#e9fadc", text: "#2f6a2f" },
        };

        let d = defaults[upper] || defaults.OTHER;

        return {
            ...ev,
            extendedProps: { ...ext, type: upper },
            backgroundColor: ev?.backgroundColor || ev?.color || d.bg,
            borderColor: ev?.borderColor || ev?.color || d.bg,
            textColor: ev?.textColor || d.text,
        };
    };

    useEffect(() => {
        if (!roomId) return;
        if (!visibleRange?.start || !visibleRange?.end) return;

        let start = toYmd(visibleRange.start);
        let end = toYmd(visibleRange.end); // FullCalendar currentEnd는 exclusive

        let ignore = false;

        (async () => {
            try {
                setIsLoadingRemote(true);
                setRemoteError("");

                let res = await fetch(`/api/rooms/${roomId}/schedule?start=${start}&end=${end}`, {
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error(`일정 조회 실패 (${res.status})`);
                }

                let data = await res.json();
                let items = Array.isArray(data?.items) ? data.items : [];
                let normalized = items.map(normalizeEvent);

                if (ignore) return;

                setStudyEvents(normalized.filter((e) => e?.extendedProps?.type === "STUDY"));
                setEvents(normalized.filter((e) => e?.extendedProps?.type !== "STUDY"));
            } catch (e) {
                if (!ignore) setRemoteError(e?.message || "일정 조회 중 오류");
            } finally {
                if (!ignore) setIsLoadingRemote(false);
            }
        })();

        return () => {
            ignore = true;
        };
    }, [roomId, visibleRange]);

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

        setForm({
            title: "",
            start: "",
            end: "",
            type: "OTHER",
            customLabel: "",
        });
    };

    let openAddModal = (dateStr) => {
        setIsAddOpen(true);
        setFormError("");
        setEditingEventId(null);

        setForm((prev) => {
            return {
                ...prev,
                title: "",
                start: dateStr || "",
                end: "",
                type: "OTHER",
                customLabel: "",
            };
        });
    };

    let openEditModal = (eventId) => {
        let target = events.find((e) => e.id === eventId);
        if (!target) return;

        setIsAddOpen(true);
        setFormError("");
        setEditingEventId(eventId);

        setForm({
            title: clamp(target.title),
            start: parseYmd(target.start),
            end: parseYmd(target.end),
            type: target.extendedProps?.type || "OTHER",
            customLabel: clamp(target.extendedProps?.customLabel || ""),
        });
    };

    let saveNormalEventLocalOnly = () => {
        // 서버 저장은 아직 연결 안 한 상태. (요청하면 이 부분도 API로 붙여줄게)
        let title = clamp(form.title).trim();
        let start = clamp(form.start).trim();
        if (!title || !start) {
            setFormError("제목과 시작일은 필수야.");
            return;
        }

        let end = clamp(form.end).trim();
        let type = clamp(form.type).trim() || "OTHER";
        let customLabel = clamp(form.customLabel).trim();

        let nextEv = normalizeEvent({
            id: editingEventId || String(Date.now()),
            title,
            start,
            end: end || null,
            extendedProps: {
                type,
                customLabel,
            },
        });

        if (editingEventId) {
            setEvents((prev) => prev.map((e) => (e.id === editingEventId ? nextEv : e)));
        } else {
            setEvents((prev) => [nextEv, ...prev]);
        }

        closeAddModal();
    };

    let deleteNormalEventLocalOnly = (eventId) => {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setOpenMenuId(null);
    };

    /* =========================
       스터디 일정 모달
    ========================= */
    let closeStudyModal = () => {
        setIsStudyAddOpen(false);
        setFormError("");
        setEditingStudyId(null);

        setStudyForm({
            round: "",
            date: "",
            description: "",
        });
    };

    let openStudyAddModal = (dateStr) => {
        setIsStudyAddOpen(true);
        setFormError("");
        setEditingStudyId(null);

        setStudyForm({
            round: "",
            date: dateStr || "",
            description: "",
        });
    };

    let openStudyEditModal = (studyId) => {
        let target = studyEvents.find((e) => e.id === studyId);
        if (!target) return;

        setIsStudyAddOpen(true);
        setFormError("");
        setEditingStudyId(studyId);

        setStudyForm({
            round: clamp(target.extendedProps?.round || ""),
            date: parseYmd(target.start),
            description: clamp(target.extendedProps?.description || ""),
        });
    };

    let saveStudyEventLocalOnly = () => {
        let round = Number(studyForm.round);
        let date = clamp(studyForm.date).trim();
        if (!round || round < 1 || !date) {
            setFormError("회차(1 이상)와 날짜는 필수야.");
            return;
        }

        let description = clamp(studyForm.description).trim();

        let nextEv = normalizeEvent({
            id: editingStudyId || `S${Date.now()}`,
            title: `스터디 ${round}회차`,
            start: date,
            extendedProps: {
                type: "STUDY",
                round,
                description,
            },
        });

        if (editingStudyId) {
            setStudyEvents((prev) => prev.map((e) => (e.id === editingStudyId ? nextEv : e)));
        } else {
            setStudyEvents((prev) => [nextEv, ...prev]);
        }

        closeStudyModal();
    };

    let deleteStudyEventLocalOnly = (studyId) => {
        setStudyEvents((prev) => prev.filter((e) => e.id !== studyId));
        setOpenMenuId(null);
    };

    /* =========================
       외부 클릭 시 메뉴 닫기
    ========================= */
    useEffect(() => {
        let onDoc = (e) => {
            let el = e.target;
            if (!el?.closest) return;
            if (el.closest(".calMenu")) return;
            if (el.closest(".calDotsBtn")) return;
            setOpenMenuId(null);
        };

        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    /* =========================
       렌더
    ========================= */
    let view = sp.get("view") || "calendar";

    let allForList = useMemo(() => {
        let merged = [...events, ...studyEvents];
        merged.sort((a, b) => (clamp(a.start) > clamp(b.start) ? 1 : -1));
        return merged;
    }, [events, studyEvents]);

    return (
        <div className="calWrap">
            <div className="calTop">
                <div className="calTitleBox">
                    <div className="calTitle">일정</div>
                    <div className="calSub">
                        {visibleTitle ? visibleTitle : ""}
                        {roomId ? <span className="calRoomHint"> (room: {roomId})</span> : null}
                    </div>
                </div>

                <div className="calTopActions">
                    <button type="button" className="calBtn" onClick={() => openAddModal("")}>
                        일반 일정 추가
                    </button>
                    <button type="button" className="calBtn calBtnGhost" onClick={() => openStudyAddModal("")}>
                        스터디 일정 추가
                    </button>
                    <button type="button" className="calBtn calBtnGhost" onClick={goListView}>
                        목록 보기
                    </button>
                </div>
            </div>

            <div className="calBody">
                <div className="calMain">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        fixedWeekCount={false}
                        height="auto"
                        selectable={true}
                        eventClassNames={eventClassNames}
                        events={[...events, ...studyEvents]}
                        dateClick={(info) => {
                            // 더블클릭 느낌으로: 스터디/일반은 버튼으로도 추가 가능
                            openAddModal(info.dateStr);
                        }}
                        eventClick={(info) => {
                            let id = info?.event?.id;
                            if (!id) return;
                            // 클릭하면 메뉴 열기
                            setOpenMenuId(id);
                        }}
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

                <div className="calSide">
                    <div className="calSideHeader">
                        <div className="calSideTitle">이번 달 일정</div>
                        <div className="calSideMeta">
                            {isLoadingRemote ? <span className="calMetaLoading">불러오는 중...</span> : null}
                            {remoteError ? <span className="calMetaError">{remoteError}</span> : null}
                        </div>
                    </div>

                    <div className="calListBody">
                        {allForList.length === 0 ? (
                            <div className="calEmpty">일정이 없어.</div>
                        ) : (
                            allForList.map((ev) => {
                                let isStudy = ev.extendedProps?.type === "STUDY";
                                let id = ev.id;

                                return (
                                    <div key={id} className={`calItem ${isStudy ? "isStudy" : ""}`}>
                                        <div className="calItemLeft">
                                            <div className={`calBadge ${clamp(ev.extendedProps?.type)}`}>
                                                {getTypeLabel(ev)}
                                            </div>
                                            <div className="calItemTitle">{ev.title}</div>
                                            <div className="calItemDate">
                                                {parseYmd(ev.start)}
                                                {ev.end ? ` ~ ${parseYmd(ev.end)}` : ""}
                                            </div>
                                        </div>

                                        <div className="calItemRight">
                                            <button
                                                type="button"
                                                className="calDotsBtn"
                                                onClick={() => setOpenMenuId((prev) => (prev === id ? null : id))}
                                            >
                                                ⋮
                                            </button>

                                            {openMenuId === id ? (
                                                <div className="calMenu">
                                                    <button
                                                        type="button"
                                                        className="calMenuBtn"
                                                        onClick={() => {
                                                            setOpenMenuId(null);
                                                            if (isStudy) openStudyEditModal(id);
                                                            else openEditModal(id);
                                                        }}
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="calMenuBtn calMenuDanger"
                                                        onClick={() => {
                                                            if (isStudy) deleteStudyEventLocalOnly(id);
                                                            else deleteNormalEventLocalOnly(id);
                                                        }}
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ===== 일반 일정 모달 ===== */}
            {isAddOpen ? (
                <div className="calModalOverlay" onMouseDown={(e) => e.target === e.currentTarget && closeAddModal()}>
                    <div className="calModal">
                        <div className="calModalHeader">
                            <div className="calModalTitle">{editingEventId ? "일정 수정" : "일정 추가"}</div>
                            <button type="button" className="calX" onClick={closeAddModal}>
                                ×
                            </button>
                        </div>

                        <div className="calModalBody">
                            {formError ? <div className="calFormError">{formError}</div> : null}

                            <div className="calField">
                                <label className="calLabel">제목</label>
                                <input
                                    className="calInput"
                                    value={form.title}
                                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                    placeholder="예) 정보처리기사 접수"
                                />
                            </div>

                            <div className="calFieldRow">
                                <div className="calField">
                                    <label className="calLabel">시작일</label>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.start}
                                        onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
                                    />
                                </div>

                                <div className="calField">
                                    <label className="calLabel">종료일(선택)</label>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={form.end}
                                        onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="calFieldRow">
                                <div className="calField">
                                    <label className="calLabel">유형</label>
                                    <select
                                        className="calSelect"
                                        value={form.type}
                                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                                    >
                                        <option value="OTHER">기타</option>
                                        <option value="REGISTRATION">접수</option>
                                        <option value="EXAM">시험</option>
                                        <option value="RESULT">발표</option>
                                    </select>
                                </div>

                                <div className="calField">
                                    <label className="calLabel">라벨(선택)</label>
                                    <input
                                        className="calInput"
                                        value={form.customLabel}
                                        onChange={(e) => setForm((p) => ({ ...p, customLabel: e.target.value }))}
                                        placeholder="예) 원서접수"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="calModalFooter">
                            <button type="button" className="calBtn calBtnGhost" onClick={closeAddModal}>
                                취소
                            </button>
                            <button type="button" className="calBtn" onClick={saveNormalEventLocalOnly}>
                                저장(로컬)
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ===== 스터디 일정 모달 ===== */}
            {isStudyAddOpen ? (
                <div className="calModalOverlay" onMouseDown={(e) => e.target === e.currentTarget && closeStudyModal()}>
                    <div className="calModal">
                        <div className="calModalHeader">
                            <div className="calModalTitle">{editingStudyId ? "스터디 일정 수정" : "스터디 일정 추가"}</div>
                            <button type="button" className="calX" onClick={closeStudyModal}>
                                ×
                            </button>
                        </div>

                        <div className="calModalBody">
                            {formError ? <div className="calFormError">{formError}</div> : null}

                            <div className="calFieldRow">
                                <div className="calField">
                                    <label className="calLabel">회차</label>
                                    <input
                                        className="calInput"
                                        value={studyForm.round}
                                        onChange={(e) => setStudyForm((p) => ({ ...p, round: e.target.value }))}
                                        placeholder="예) 1"
                                    />
                                </div>

                                <div className="calField">
                                    <label className="calLabel">날짜</label>
                                    <input
                                        type="date"
                                        className="calInput"
                                        value={studyForm.date}
                                        onChange={(e) => setStudyForm((p) => ({ ...p, date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="calField">
                                <label className="calLabel">설명(선택)</label>
                                <textarea
                                    className="calTextarea"
                                    value={studyForm.description}
                                    onChange={(e) => setStudyForm((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="예) 챕터 3 문제풀이"
                                />
                            </div>
                        </div>

                        <div className="calModalFooter">
                            <button type="button" className="calBtn calBtnGhost" onClick={closeStudyModal}>
                                취소
                            </button>
                            <button type="button" className="calBtn" onClick={saveStudyEventLocalOnly}>
                                저장(로컬)
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Calendar;
