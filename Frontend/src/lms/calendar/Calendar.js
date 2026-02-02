import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useLMS } from "../LMSContext";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import "./Calendar.css";

function Calendar() {
    const { isHost } = useLMS();
    let calendarRef = useRef(null);

    let { subjectId } = useParams();
    let [sp, setSp] = useSearchParams();

    let [visibleRange, setVisibleRange] = useState(null);
    let [visibleTitle, setVisibleTitle] = useState("");

    /** 클릭한 날짜(YYYY-MM-DD). 있으면 오른쪽 리스트는 해당 날짜 일정만 표시 */
    let [selectedDate, setSelectedDate] = useState(null);

    let [openMenuId, setOpenMenuId] = useState(null);

    // ✅ roomId 전달 방식은 프로젝트마다 달라서 흔한 키들을 순서대로 본다.
    let roomId =
        subjectId ||
        sp.get("roomId") ||
        sp.get("subjectId") ||
        sp.get("room") ||
        sp.get("id") ||
        "";

    /* =========================
       일반 일정(서버 연동)
    ========================= */
    let [events, setEvents] = useState([]);

    /* =========================
       스터디 일정(서버 연동)
    ========================= */
    let [studyEvents, setStudyEvents] = useState([]);

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
        startTime: "09:00",
        endTime: "11:00",
        description: "",
    });

    /* =========================
       유틸
    ========================= */
    let toDate = (yyyyMmDd) => {
        // "YYYY-MM-DD" 뿐 아니라 "YYYY-MM-DDTHH:mm:ss" 같은 ISO 문자열도 안전 처리
        let ymd = String(yyyyMmDd || "").slice(0, 10);
        let [y, m, d] = ymd.split("-").map(Number);
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
        if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
        let ymd = yyyyMmDd.slice(0, 10);
        if (ymd.length !== 10) return "";
        let [, m, d] = ymd.split("-");
        return `${m}.${d}`;
    };

    // "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm:ss" 등에서 YYYY-MM-DD만 뽑기
    let ymdOf = (v) => String(v || "").slice(0, 10);

    // 과거 코드 호환용 별칭(기존 ymdOnly 사용 부분 대응)
    let ymdOnly = (v) => ymdOf(v);

    // end 표기용(포함 end):
    // - 날짜만 오는 경우(YYYY-MM-DD): FullCalendar 규칙(end exclusive)이라 하루 빼서 inclusive로 변환
    // - 시간이 포함된 경우(YYYY-MM-DDTHH:mm:ss): 이미 같은 날의 시각이므로 그대로 그 날을 사용
    let endInclusiveYmdOf = (rawEnd) => {
        let s = String(rawEnd || "");
        if (!s) return null;
        let ymd = s.slice(0, 10);
        if (s.length > 10) return ymd;
        return toInclusiveEnd(ymd);
    };

    let overlaps = (event, range) => {
        if (!range) return true;

        let startStr = event.start instanceof Date ? toYmd(event.start) : (event.startStr?.slice(0, 10) || ymdOnly(event.start) || "");
        let s = startStr ? toDate(startStr) : null;
        if (!s) return false;

        let e;
        if (event.end) {
            let endStr = event.end instanceof Date ? toYmd(event.end) : (event.endStr?.slice(0, 10) || ymdOnly(event.end) || "");
            e = endStr ? toDate(endStr) : null;
            if (!e) e = new Date(s.getTime());
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

    /* 달력 그리드·+N개 팝업에는 일반 일정만 (스터디는 날짜칸 회차로만 표시) */
    let calendarEvents = useMemo(() => {
        return events.filter((ev) => {
            if (ev.extendedProps?.type === "STUDY") return false;
            if (typeof ev.id === "string" && ev.id.startsWith("S")) return false;
            return true;
        });
    }, [events]);

    /* =========================
       날짜 상단 "회차 + 시간대" 맵 (회차별 startTime, endTime 포함)
    ========================= */
    let studyRoundsByDate = useMemo(() => {
        let map = {};

        for (let i = 0; i < studyEvents.length; i++) {
            let ev = studyEvents[i];

            let rawStart =
                typeof ev.start === "string" ? ev.start : ev.startStr || "";
            let ymd = rawStart.slice(0, 10);

            if (ymd.length !== 10) continue;

            let round = Number(ev.extendedProps?.round);
            if (!round) continue;

            let startTime = ev.extendedProps?.startTime || "";
            let endTime = ev.extendedProps?.endTime || "";
            if (!/^\d{2}:\d{2}$/.test(startTime)) startTime = "";
            if (!/^\d{2}:\d{2}$/.test(endTime)) endTime = "";

            if (!map[ymd]) map[ymd] = [];
            map[ymd].push({ round, startTime, endTime });
        }

        for (let key in map) {
            let arr = map[key];
            map[key] = arr
                .sort((a, b) => a.round - b.round)
                .filter(
                    (item, idx, self) =>
                        self.findIndex((x) => x.round === item.round) === idx
                );
        }

        return map;
    }, [studyEvents]);

    // ✅ 스터디 회차가 있는 날이 포함된 "주(week) 줄"에 클래스를 부여해서,
    //    기간(멀티데이) 이벤트 바도 끊김 없이 아래로 내릴 수 있게 한다.
    let applyWeekHasStudyClass = useCallback(() => {
        let api = calendarRef.current?.getApi?.();
        let root = api?.el;
        if (!root) return;

        // 기존 클래스 제거
        root
            .querySelectorAll?.(".fc-daygrid-week.calWeekHasStudy")
            ?.forEach((w) => w.classList.remove("calWeekHasStudy"));

        // 스터디가 있는 날짜를 찾아 해당 week에 클래스 추가
        root.querySelectorAll?.(".fc-daygrid-day")?.forEach((dayEl) => {
            let ymd = dayEl.getAttribute?.("data-date");
            if (!ymd) return;
            let items = studyRoundsByDate[ymd];
            if (!items || items.length === 0) return;
            dayEl.closest?.(".fc-daygrid-week")?.classList.add("calWeekHasStudy");
        });
    }, [studyRoundsByDate]);

    useEffect(() => {
        // DOM 렌더 타이밍을 조금 기다렸다가 적용
        let t = setTimeout(() => applyWeekHasStudyClass(), 0);
        return () => clearTimeout(t);
    }, [applyWeekHasStudyClass, visibleRange]);

    /* =========================
       오른쪽 리스트 (선택한 날짜가 있으면 해당 날짜만, 없으면 월간)
    ========================= */
    let monthlyEvents = useMemo(() => {
        let list = allEvents;
        if (visibleRange && !selectedDate) {
            list = allEvents.filter((ev) => overlaps(ev, visibleRange));
        }
        if (selectedDate) {
            list = allEvents.filter((ev) => {
                let startYmd = ymdOf(typeof ev.start === "string" ? ev.start : ev.startStr);
                if (!startYmd) return false;
                if (startYmd === selectedDate) return true;
                if (ev.end) {
                    let endInclusive = endInclusiveYmdOf(typeof ev.end === "string" ? ev.end : ev.endStr);
                    if (endInclusive && selectedDate >= startYmd && selectedDate <= endInclusive)
                        return true;
                }
                return false;
            });
        }

        list.sort((a, b) => {
            let aYmd = a.start instanceof Date ? toYmd(a.start) : (a.startStr?.slice(0, 10) || ymdOnly(a.start));
            let bYmd = b.start instanceof Date ? toYmd(b.start) : (b.startStr?.slice(0, 10) || ymdOnly(b.start));
            let aS = aYmd ? toDate(aYmd) : new Date(0);
            let bS = bYmd ? toDate(bYmd) : new Date(0);
            return aS - bS;
        });
        // ✅ 오른쪽 일정 목록에는 스터디 일정도 포함
        return list;
    }, [allEvents, visibleRange, selectedDate]);

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

    /* STUDY만 타입 클래스 적용(고정 스타일). 일반 일정은 calEvent만 → FullCalendar가 event.backgroundColor 사용 */
    let eventClassNames = (arg) => {
        let t = arg.event.extendedProps?.type;
        if (t === "STUDY") return ["calEvent", "study"];
        return ["calEvent"];
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

    /* =========================
       ✅ 토큰/인증 fetch
       - localStorage: jwt_token, token
       - sessionStorage: accessToken
    ========================= */
    let getToken = () => {
        let t = sessionStorage.getItem("accessToken") || "";
        return t.replace(/^Bearer\s+/i, "");
    };

    let authFetch = (url, options = {}) => {
        let token = getToken();

        let headers = {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        return fetch(url, {
            ...options,
            headers,
            // 프로젝트가 쿠키 기반이 아니어도 있어도 무해
            credentials: "include",
        });
    };

    /* =========================
       서버 호출(조회)
       GET /api/rooms/{roomId}/schedule?start=YYYY-MM-DD&end=YYYY-MM-DD (end exclusive)
    ========================= */
    let fetchRangeEvents = useCallback(
        async (startYmd, endYmdExclusive) => {
            if (!roomId) return;

            let url = `/api/rooms/${roomId}/schedule?start=${encodeURIComponent(
                startYmd
            )}&end=${encodeURIComponent(endYmdExclusive)}`;

            let res = await authFetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                let msg = await res.text().catch(() => "");
                throw new Error(msg || `일정 조회 실패 (${res.status})`);
            }

            // { items: [ScheduleEventResponse...] } :contentReference[oaicite:4]{index=4}
            let data = await res.json();
            let items = Array.isArray(data?.items) ? data.items : [];

            let normal = [];
            let study = [];

            for (let i = 0; i < items.length; i++) {
                let it = items[i];
                let t = it?.extendedProps?.type;
                let idStr = typeof it?.id === "string" ? it.id : String(it?.id ?? "");

                // 색상: 백엔드가 backgroundColor로 주든, colorHex로 주든 다 커버
                let bg =
                    it?.backgroundColor ||
                    it?.borderColor ||
                    it?.colorHex ||
                    it?.extendedProps?.backgroundColor ||
                    it?.extendedProps?.colorHex ||
                    "";

                let tc =
                    it?.textColor ||
                    it?.extendedProps?.textColor ||
                    "";

                let ev = {
                    id: idStr,
                    title: it?.title || "",
                    start: it?.start,
                    ...(it?.end ? { end: it.end } : {}),
                    extendedProps: it?.extendedProps || {},
                };
                
                // 조건부 spread 대신 if로 넣어서 “조용히 빠지는” 문제 방지
                if (bg) {
                    ev.backgroundColor = bg;
                    ev.borderColor = bg;
                }
                if (tc) {
                    ev.textColor = tc;
                }

                // type이 STUDY이거나 id가 S로 시작하면 스터디 일정
                let isStudy = t === "STUDY" || idStr.startsWith("S");
                if (isStudy) study.push(ev);
                else normal.push(ev);
            }

            setEvents(normal);
            setStudyEvents(study);
        },
        [roomId]
    );

    useEffect(() => {
        if (!visibleRange) return;
        if (!roomId) return;

        let startYmd = toYmd(visibleRange.start);
        let endYmd = toYmd(visibleRange.end); // currentEnd는 exclusive

        (async () => {
            try {
                await fetchRangeEvents(startYmd, endYmd);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [visibleRange, roomId, fetchRangeEvents]);


    /* =========================
       서버 호출(일반 일정 저장/수정/삭제)
       POST /api/schedules
       PUT/DELETE /api/schedules/{id}?roomId=...&userId=...
    ========================= */
    let saveEventFromModal = async () => {
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

        if (!roomId) {
            setFormError("roomId가 없습니다. (URL 쿼리로 roomId 전달 필요)");
            return;
        }

        let userId = sessionStorage.getItem("userId") || "";
        if (!userId) {
            setFormError("로그인 userId가 없습니다. 다시 로그인 해주세요.");
            return;
        }

        let payload = {
            title,
            description: form.description.trim(),
            start: form.start,
            end: hasEnd ? form.end : "",
            type: form.type,
            colorHex: form.colorHex,
            customLabel: form.type === "OTHER" ? form.customLabel.trim() : "",
            textColor: form.textColor,
        };

        try {
            if (!editingEventId) {
                let res = await authFetch(`/api/schedules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        roomId,
                        userId,
                        ...payload,
                    }),
                });

                if (!res.ok) {
                    let msg = await res.text().catch(() => "");
                    throw new Error(msg || `일정 생성 실패 (${res.status})`);
                }

                await res.json().catch(() => null);
            } else {
                let scheduleId = Number(editingEventId);
                if (!scheduleId) throw new Error("수정할 scheduleId가 숫자가 아닙니다.");

                let res = await authFetch(
                    `/api/schedules/${scheduleId}?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(
                        userId
                    )}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }
                );

                if (!res.ok) {
                    let msg = await res.text().catch(() => "");
                    throw new Error(msg || `일정 수정 실패 (${res.status})`);
                }
            }

            if (visibleRange) {
                let startYmd = toYmd(visibleRange.start);
                let endYmd = toYmd(visibleRange.end);
                await fetchRangeEvents(startYmd, endYmd);
            }

            closeAddModal();
        } catch (e) {
            console.error(e);
            setFormError(e?.message || "저장 중 오류가 발생했습니다.");
        }
    };

    let deleteEventById = async (id) => {
        try {
            if (!roomId) return;

            let userId = sessionStorage.getItem("userId") || "";
            if (!userId) {
                setFormError("로그인 userId가 없습니다. 다시 로그인 해주세요.");
                return;
            }


            let scheduleId = Number(id);
            if (!scheduleId) throw new Error("삭제할 scheduleId가 숫자가 아닙니다.");

            let res = await authFetch(
                `/api/schedules/${scheduleId}?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(
                    userId
                )}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                let msg = await res.text().catch(() => "");
                throw new Error(msg || `일정 삭제 실패 (${res.status})`);
            }

            setOpenMenuId(null);

            if (visibleRange) {
                let startYmd = toYmd(visibleRange.start);
                let endYmd = toYmd(visibleRange.end);
                await fetchRangeEvents(startYmd, endYmd);
            }

            if (editingEventId === id) {
                closeAddModal();
            }
        } catch (e) {
            console.error(e);
            setFormError(e?.message || "삭제 중 오류가 발생했습니다.");
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

    let openStudyAddModal = async () => {
        setEditingStudyId(null);
        setOpenMenuId(null);

        setStudyForm({
            round: 1,
            date: "",
            startTime: "09:00",
            endTime: "11:00",
            description: "",
        });

        setStudyError("");
        setIsStudyOpen(true);

        // 이미 등록된 회차와 겹치지 않도록 다음 회차 번호 제안
        if (roomId) {
            try {
                let res = await authFetch(
                    `/api/study-schedules/next-round?roomId=${encodeURIComponent(roomId)}`
                );
                if (res.ok) {
                    let nextRound = await res.json();
                    if (typeof nextRound === "number" && nextRound >= 1) {
                        setStudyForm((prev) => ({ ...prev, round: nextRound }));
                    }
                }
            } catch (e) {
                // 무시
            }
        }
    };

    let openStudyEditModal = (studyEvent) => {
        setEditingStudyId(studyEvent.id);
        setOpenMenuId(null);

        let dateStr =
            typeof studyEvent.start === "string"
                ? studyEvent.start
                : studyEvent.startStr?.slice(0, 10) || "";
        if (dateStr.length > 10) dateStr = dateStr.slice(0, 10);

        let startTime = studyEvent.extendedProps?.startTime || "09:00";
        let endTime = studyEvent.extendedProps?.endTime || "11:00";
        if (!/^\d{2}:\d{2}$/.test(startTime)) startTime = "09:00";
        if (!/^\d{2}:\d{2}$/.test(endTime)) endTime = "11:00";

        setStudyForm({
            round: Number(studyEvent.extendedProps?.round || 1),
            date: dateStr,
            startTime,
            endTime,
            description: studyEvent.extendedProps?.description || "",
        });

        setStudyError("");
        setIsStudyOpen(true);
    };

    let onChangeStudyForm = (key, value) => {
        setStudyForm((prev) => ({ ...prev, [key]: value }));
    };

    /* =========================
       서버 호출(스터디 저장/수정/삭제)
       POST /api/study-schedules
       PUT/DELETE /api/study-schedules/{id}?roomId=...
    ========================= */
    let saveStudyFromModal = async () => {
        let roundNum = Number(studyForm.round);

        if (!roundNum || roundNum < 1) {
            setStudyError("회차는 1 이상 숫자로 입력해 주세요.");
            return;
        }

        if (!studyForm.date) {
            setStudyError("날짜를 선택해 주세요.");
            return;
        }

        let startTime = studyForm.startTime?.trim() || "09:00";
        let endTime = studyForm.endTime?.trim() || "11:00";
        if (startTime.length === 5) startTime = startTime + ":00";
        if (endTime.length === 5) endTime = endTime + ":00";
        if (startTime >= endTime) {
            setStudyError("종료 시간은 시작 시간보다 이후여야 합니다.");
            return;
        }

        if (!roomId) {
            setStudyError("roomId가 없습니다. (URL 쿼리로 roomId 전달 필요)");
            return;
        }

        try {
            if (!editingStudyId) {
                let res = await authFetch(`/api/study-schedules`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        roomId,
                        round: roundNum,
                        date: studyForm.date,
                        startTime: studyForm.startTime?.trim() || "09:00",
                        endTime: studyForm.endTime?.trim() || "11:00",
                        description: studyForm.description.trim(),
                    }),
                });

                if (!res.ok) {
                    let msg = await res.text().catch(() => "");
                    throw new Error(msg || `스터디 일정 생성 실패 (${res.status})`);
                }

                await res.json().catch(() => null);
            } else {
                let raw = String(editingStudyId);
                let studyScheduleId = raw.startsWith("S") ? Number(raw.slice(1)) : Number(raw);
                if (!studyScheduleId) throw new Error("수정할 studyScheduleId 파싱 실패");

                let res = await authFetch(
                    `/api/study-schedules/${studyScheduleId}?roomId=${encodeURIComponent(roomId)}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            round: roundNum,
                            date: studyForm.date,
                            startTime: studyForm.startTime?.trim() || "09:00",
                            endTime: studyForm.endTime?.trim() || "11:00",
                            description: studyForm.description.trim(),
                        }),
                    }
                );

                if (!res.ok) {
                    let msg = await res.text().catch(() => "");
                    throw new Error(msg || `스터디 일정 수정 실패 (${res.status})`);
                }
            }

            if (visibleRange) {
                let startYmd = toYmd(visibleRange.start);
                let endYmd = toYmd(visibleRange.end);
                await fetchRangeEvents(startYmd, endYmd);
            }

            closeStudyModal();
        } catch (e) {
            console.error(e);
            setStudyError(e?.message || "저장 중 오류가 발생했습니다.");
        }
    };

    let deleteStudyById = async (id) => {
        try {
            if (!roomId) return;

            let raw = String(id);
            let studyScheduleId = raw.startsWith("S") ? Number(raw.slice(1)) : Number(raw);
            if (!studyScheduleId) throw new Error("삭제할 studyScheduleId 파싱 실패");

            let res = await authFetch(
                `/api/study-schedules/${studyScheduleId}?roomId=${encodeURIComponent(roomId)}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                let msg = await res.text().catch(() => "");
                throw new Error(msg || `스터디 일정 삭제 실패 (${res.status})`);
            }

            setOpenMenuId(null);

            if (visibleRange) {
                let startYmd = toYmd(visibleRange.start);
                let endYmd = toYmd(visibleRange.end);
                await fetchRangeEvents(startYmd, endYmd);
            }

            if (editingStudyId === id) {
                closeStudyModal();
            }
        } catch (e) {
            console.error(e);
            setStudyError(e?.message || "삭제 중 오류가 발생했습니다.");
        }
    };

    /* =========================
       URL modal=add 대응
    ========================= */
    useEffect(() => {
        if (sp.get("modal") === "add") openAddModal();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                        locale={koLocale}
                        height="100%"
                        expandRows={true}
                        fixedWeekCount={true}
                        showNonCurrentDates={true}
                        dayMaxEventRows={1}
                        events={calendarEvents}
                        dateClick={(info) => {
                            let ymd = toYmd(info.date);
                            setSelectedDate((prev) => (prev === ymd ? null : ymd));
                        }}
                        dayCellClassNames={(arg) => {
                            let ymd = toYmd(arg.date);
                            let classes = [];
                            if (selectedDate === ymd) classes.push("calDaySelected");
                            if (studyRoundsByDate[ymd] && studyRoundsByDate[ymd].length > 0) {
                                classes.push("calDayHasStudy");
                            }
                            return classes;
                        }}
                        eventClassNames={eventClassNames}
                        eventDidMount={(info) => {
                            let id = info.event.id;
                            if (id != null) info.el.setAttribute("data-event-id", String(id));
                        }}
                        eventContent={(arg) => {
                            if (arg.event.extendedProps?.type === "STUDY") {
                                let r = arg.event.extendedProps?.round;
                                let s = arg.event.extendedProps?.startTime;
                                let e = arg.event.extendedProps?.endTime;
                                let timePart = s && e ? ` ${s} ~ ${e}` : "";
                                return `${r != null ? r : ""}회차${timePart}`.trim();
                            }
                            return arg.event.title || "";
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
                            // 달 이동/렌더 직후 week 클래스 재적용
                            setTimeout(() => applyWeekHasStudyClass(), 0);
                        }}
                        /* 날짜칸 상단: 날짜 숫자 + 스터디 회차 + 시간대 */
                        dayCellContent={(arg) => {
                            let ymd = toYmd(arg.date);
                            let items = studyRoundsByDate[ymd];

                            return (
                                <div className="calDayTopRow">
                                    <span className="calDayNum">{arg.date.getDate()}</span>
                                    {items && items.length > 0 ? (
                                        <div className="calDayStudyRounds">
                                            {items.map((item) => (
                                                <div key={item.round} className="calDayStudyRoundWrap">
                                                    <span className="calDayStudyRound">{item.round}회차</span>
                                                    {item.startTime && item.endTime ? (
                                                        <span className="calDayStudyTime">
                                                            {item.startTime} ~ {item.endTime}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        }}
                    />
                </div>

                {/* 오른쪽: 월간 일정 목록 (날짜 클릭 시 해당 날짜만) */}
                <div className="card calCard calListCard">
                    <div className="calListHead">
                        <div className="calListHeadRow">
                            <div className="cardTitle calListTitle">
                                {selectedDate
                                    ? (() => {
                                        let [y, m, d] = selectedDate.split("-").map(Number);
                                        return `${y}년 ${m}월 ${d}일 일정`;
                                    })()
                                    : visibleTitle
                                        ? `${visibleTitle} 일정`
                                        : "이번 달 일정"}
                            </div>
                            <div className="calListActions">
                                {isHost && (
                                    <>
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
                                    </>
                                )}
                            </div>
                        </div>
                        {selectedDate && (
                            <div className="calListShowAllRow">
                                <button
                                    type="button"
                                    className="calShowAllBtn"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedDate(null);
                                    }}
                                >
                                    전체 보기
                                </button>
                            </div>
                        )}
                    </div>

                    <div
                        className="calListBody"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            if (openMenuId) setOpenMenuId(null);
                        }}
                    >
                        {monthlyEvents.length === 0 && (
                            <div className="calEmpty">
                                {selectedDate
                                    ? "해당 날짜에 등록된 일정이 없습니다."
                                    : "이번 달에 등록된 일정이 없습니다."}
                            </div>
                        )}

                        {monthlyEvents.map((ev) => {
                            let startYmd = ymdOf(typeof ev.start === "string" ? ev.start : ev.startStr);

                            let endStr = null;
                            if (ev.end) {
                                let rawEnd = typeof ev.end === "string" ? ev.end : ev.endStr;
                                endStr = endInclusiveYmdOf(rawEnd);
                            }

                            // ✅ 배지 색상을 달력 이벤트 색상과 동일하게
                            let badgeBg =
                                ev.backgroundColor ||
                                ev.borderColor ||
                                ev.extendedProps?.backgroundColor ||
                                ev.extendedProps?.colorHex ||
                                "";

                            let badgeText =
                                ev.textColor ||
                                ev.extendedProps?.textColor ||
                                "";

                            // 비어있으면(혹시 서버 누락) 기존 톤으로 안전 fallback
                            if (!badgeBg) badgeBg = "#97c793";
                            if (!badgeText) badgeText = "#ffffff";

                            let badgeStyle = {
                                backgroundColor: badgeBg,
                                color: badgeText,
                            };

                            let isStudy = ev.extendedProps?.type === "STUDY";
                            let round = ev.extendedProps?.round;
                            let sTime = ev.extendedProps?.startTime;
                            let eTime = ev.extendedProps?.endTime;
                            let timePart = sTime && eTime ? `${sTime} ~ ${eTime}` : "";
                            let displayTitle = isStudy
                                ? `${round ? `${round}회차` : "스터디"}${timePart ? ` (${timePart})` : ""}`
                                : ev.title;

                            return (
                                <div
                                    key={ev.id}
                                    className="calItem"
                                    style={{
                                        backgroundColor: ev.backgroundColor || "#f6faf3",
                                        color: "#1f2937",
                                    }}
                                >
                                    <div className="calItemTop">
                                        {/* ✅ 여기 style 추가 */}
                                        <span
                                            className={`calBadge ${ev.extendedProps?.type || "OTHER"}`}
                                            style={badgeStyle}
                                        >
                                            {typeLabel(ev)}
                                        </span>

                                        <div className="calItemRight">
                                            <span className="calDate">
                                                {startYmd ? fmtDate(startYmd) : ""}
                                                {endStr && endStr !== startYmd ? ` ~ ${fmtDate(endStr)}` : ""}
                                                {isStudy && timePart ? ` (${timePart})` : ""}
                                            </span>

                                            {isHost && (
                                                <>
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
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="calItemTitle" title={displayTitle || ev.title}>
                                        {displayTitle}
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

                            <div className="calRow2">
                                <label className="calField">
                                    <span className="calFieldLabel">시작 시간</span>
                                    <input
                                        type="time"
                                        className="calInput"
                                        value={studyForm.startTime}
                                        onChange={(e) => onChangeStudyForm("startTime", e.target.value)}
                                    />
                                </label>

                                <label className="calField">
                                    <span className="calFieldLabel">종료 시간</span>
                                    <input
                                        type="time"
                                        className="calInput"
                                        value={studyForm.endTime}
                                        onChange={(e) => onChangeStudyForm("endTime", e.target.value)}
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