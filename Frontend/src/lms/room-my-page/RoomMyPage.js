import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./RoomMyPage.css";

async function requestJson(url, options) {
    let opts = options || {};
    let headers = Object.assign({}, opts.headers || {});

    let token =
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        "";

    if (token) {
        headers.Authorization = token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`;
    }

    if (opts.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    let res = await fetch(url, {
        method: opts.method || "GET",
        headers,
        body: opts.body,
        credentials: "include",
    });

    if (res.status === 204) return null;

    let text = await res.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = text;
    }

    if (!res.ok) {
        let message =
            data && data.message ? data.message : `요청 실패 (${res.status})`;
        let err = new Error(message);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}

async function fetchMyRooms() {
    let data = await requestJson("/api/me/rooms", { method: "GET" });

    let list = Array.isArray(data) ? data : [];

    // UI에서 roomName을 쓰고 있으니 title -> roomName으로 맞춰줌
    let mapped = list
        .filter((x) => x && x.roomId)
        .map((x) => ({
            roomId: x.roomId,
            roomName: x.title || "제목 없음",
            isHost: !!(x.isHost ?? x.host),
        }));

    return mapped;
}

async function fetchRoomMyPage(roomId) {
    let data = await requestJson(`/api/rooms/${roomId}/me/mypage`, {
        method: "GET",
    });

    return {
        nickname: data?.roomNickname || "",
        profileImageUrl: data?.profileImg || "",

        postCount: data?.postCount ?? 0,
        commentCount: data?.commentCount ?? 0,

        recentPosts: Array.isArray(data?.recentPosts) ? data.recentPosts : [],
        recentComments: Array.isArray(data?.recentComments) ? data.recentComments : [],
    };
}

async function fetchRoomInfo(roomId) {
    let data = await requestJson(`/api/rooms/${roomId}`, { method: "GET" });

    return {
        midCategoryName: data?.midCategoryName || "",
        // 혹시 다른 키로 올 수도 있으니 방어
        categoryName:
            data?.midCategoryName ||
            data?.categoryName ||
            data?.category ||
            "",
    };
}

async function updateRoomNickname(roomId, roomNickname) {
    let data = await requestJson(`/api/rooms/${roomId}/me/nickname`, {
        method: "PATCH",
        body: JSON.stringify({ roomNickname }),
    });

    return {
        nickname: data && data.roomNickname ? data.roomNickname : roomNickname,
        profileImageUrl: data && data.profileImg ? data.profileImg : "",
    };
}

export default function RoomMyPage() {
    let navigate = useNavigate();
    let params = useParams();

    // 실제 roomId는 URL param 또는 sessionStorage(lms.activeRoomId)에서 가져옴
    let currentRoomIdFromRoute =
        params && (params.roomId || params.subjectId)
            ? params.roomId || params.subjectId
            : "";

    let currentRoomIdFromStorage = sessionStorage.getItem("lms.activeRoomId") || "";
    let currentRoomId = currentRoomIdFromRoute || currentRoomIdFromStorage || "";

    let [rooms, setRooms] = useState([]);
    let [selectedRoomId, setSelectedRoomId] = useState("");

    let [loading, setLoading] = useState(false);
    let [saving, setSaving] = useState(false);

    // server state
    let [nickname, setNickname] = useState("");
    let [profileImageUrl, setProfileImageUrl] = useState("");

    // edit UI state
    let [isNicknameEditing, setIsNicknameEditing] = useState(false);
    let [nicknameDraft, setNicknameDraft] = useState("");

    // messages
    let [errorMsg, setErrorMsg] = useState("");
    let [successMsg, setSuccessMsg] = useState("");

    let [postCount, setPostCount] = useState(0);
    let [commentCount, setCommentCount] = useState(0);

    let [recentPosts, setRecentPosts] = useState([]);
    let [recentComments, setRecentComments] = useState([]);

    let [categoryName, setCategoryName] = useState("");

    let selectedRoom = useMemo(() => {
        let found = rooms.find((r) => r.roomId === selectedRoomId);
        return found || null;
    }, [rooms, selectedRoomId]);

    let myRoleText = selectedRoom
        ? (selectedRoom.isHost ? "방장" : "스터디원")
        : "-";

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                setLoading(true);
                setErrorMsg("");
                setSuccessMsg("");

                // ✅ 더미 대신 실 API
                let list = await fetchMyRooms();
                if (!mounted) return;

                let nextList = Array.isArray(list) ? list.slice() : [];

                // 혹시 activeRoomId가 있는데 목록에서 못 찾으면, 일단 화면에서 선택은 가능하게 추가
                if (currentRoomId) {
                    let exists = nextList.some((r) => r.roomId === currentRoomId);
                    if (!exists) {
                        nextList.unshift({ roomId: currentRoomId, roomName: "현재 방" });
                    }
                }

                setRooms(nextList);

                if (currentRoomId) {
                    setSelectedRoomId(currentRoomId);
                } else if (nextList.length > 0) {
                    setSelectedRoomId(nextList[0].roomId);
                }
            } catch (e) {
                if (!mounted) return;
                setErrorMsg(e && e.message ? e.message : "방 목록을 불러오지 못했습니다.");
            } finally {
                if (!mounted) return;
                setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedRoomId) return;

        let mounted = true;

        (async () => {
            try {
                setLoading(true);
                setErrorMsg("");
                setSuccessMsg("");

                let data = await fetchRoomMyPage(selectedRoomId);
                if (!mounted) return;

                setNickname(data.nickname || "");
                setProfileImageUrl(data.profileImageUrl || "");
                setPostCount(data.postCount || 0);
                setCommentCount(data.commentCount || 0);
                setRecentPosts(data.recentPosts || []);
                setRecentComments(data.recentComments || []);
                setIsNicknameEditing(false);
                setNicknameDraft(data.nickname || "");
                let info = await fetchRoomInfo(selectedRoomId);
                if (!mounted) return;
                setCategoryName(info.categoryName || "");
            } catch (e) {
                if (!mounted) return;
                setErrorMsg(e && e.message ? e.message : "프로필 정보를 불러오지 못했습니다.");
            } finally {
                if (!mounted) return;
                setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [selectedRoomId]);

    function clearMessages() {
        setErrorMsg("");
        setSuccessMsg("");
    }

    function onChangeRoom(e) {
        clearMessages();
        let nextId = e.target.value;

        if (!nextId) return;

        // 1) 선택 저장
        sessionStorage.setItem("lms.activeRoomId", nextId);

        // 2) (선택) UI state도 맞춰두기
        setSelectedRoomId(nextId);

        // 3) 실제 이동: 너희 라우팅 규칙에 맞게 경로만 맞추면 됨
        navigate(`/lms/${nextId}/dashboard`);
    }

    function startEditNickname() {
        clearMessages();
        setIsNicknameEditing(true);
        setNicknameDraft(nickname);
    }

    function cancelEditNickname() {
        clearMessages();
        setIsNicknameEditing(false);
        setNicknameDraft(nickname);
    }

    async function saveNickname() {
        clearMessages();

        let next = (nicknameDraft || "").trim();
        if (next.length < 2) {
            setErrorMsg("닉네임은 2자 이상으로 입력해줘.");
            return;
        }
        if (next.length > 20) {
            setErrorMsg("닉네임은 20자 이하로 입력해줘.");
            return;
        }

        try {
            setSaving(true);

            let updated = await updateRoomNickname(selectedRoomId, next);

            setNickname(updated.nickname || next);
            if (typeof updated.profileImageUrl === "string") {
                setProfileImageUrl(updated.profileImageUrl);
            }

            setIsNicknameEditing(false);
            setSuccessMsg("닉네임이 수정되었습니다.");

            // ✅ LMS 헤더/화상채팅 쪽에 즉시 반영 (roomNickname 우선 사용)
            try {
                window.dispatchEvent(
                    new CustomEvent("lms:room-nickname-updated", {
                        detail: { roomId: selectedRoomId, roomNickname: updated.nickname || next },
                    })
                );
            } catch (e) {
            }
        } catch (e) {
            setErrorMsg(e && e.message ? e.message : "닉네임 수정에 실패하였습니다.");
        } finally {
            setSaving(false);
        }
    }

    let displayAvatar = profileImageUrl
        ? profileImageUrl
        : "https://dummyimage.com/160x160/eeeeee/666666&text=ON-SIL";

    return (
        <div className="rmp-wrap">
            <div className="rmp-header">
                <div className="rmp-titleBox">
                    <h1 className="rmp-title">마이페이지</h1>
                </div>

                <div className="rmp-roomSelect">
                    <label className="rmp-label">현재 방</label>
                    <select
                        className="rmp-select"
                        value={selectedRoomId}
                        onChange={onChangeRoom}
                        disabled={loading || rooms.length === 0}
                    >
                        {rooms.map((r) => (
                            <option key={r.roomId} value={r.roomId}>
                                {r.roomName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {(errorMsg || successMsg) && (
                <div className={`rmp-msg ${errorMsg ? "is-error" : "is-success"}`}>
                    {errorMsg || successMsg}
                </div>
            )}

            <div className="rmp-grid">
                {/* 왼쪽: 프로필 카드 */}
                <section className="rmp-card">
                    <div className="rmp-cardHead">
                        <h2 className="rmp-cardTitle">방 프로필</h2>
                        <span className="rmp-chip">
                            {selectedRoom ? selectedRoom.roomName : "선택된 방 없음"}
                        </span>
                    </div>

                    <div className="rmp-profile">
                        <div className="rmp-avatarBox">
                            <img className="rmp-avatar" src={displayAvatar} alt="room profile" />
                        </div>

                        <div className="rmp-profileInfo">
                            <div className="rmp-row">
                                <div className="rmp-rowLabel">닉네임</div>

                                {!isNicknameEditing ? (
                                    <div className="rmp-rowValue rmp-rowInline">
                                        <span className="rmp-nickname">{nickname || "-"}</span>
                                        <button
                                            className="rmp-btn rmp-btnGhost"
                                            onClick={startEditNickname}
                                            disabled={loading || saving}
                                            type="button">
                                            수정
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rmp-rowValue rmp-rowInline">
                                        <input
                                            className="rmp-input"
                                            value={nicknameDraft}
                                            onChange={(e) => setNicknameDraft(e.target.value)}
                                            placeholder="닉네임 입력 (2~20자)"
                                            maxLength={20}
                                            disabled={saving}/>
                                        <button
                                            className="rmp-btn"
                                            onClick={saveNickname}
                                            disabled={saving}
                                            type="button">
                                            저장
                                        </button>
                                        <button
                                            className="rmp-btn rmp-btnGhost"
                                            onClick={cancelEditNickname}
                                            disabled={saving}
                                            type="button">
                                            취소
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="rmp-row">
                                <div className="rmp-rowLabel">내 역할</div>
                                <div className="rmp-rowValue">
                                    {myRoleText}
                                </div>
                            </div>

                            <div className="rmp-row">
                                <div className="rmp-rowLabel">카테고리</div>
                                <div className="rmp-rowValue">
                                    {categoryName || "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 오른쪽: 내 활동 */}
                <section className="rmp-card">
                    <div className="rmp-cardHead">
                        <h2 className="rmp-cardTitle">내 활동</h2>
                    </div>

                    <div className="rmp-stats">
                        <div className="rmp-stat">
                            <div className="rmp-statLabel">내 게시글</div>
                            <div className="rmp-statValue">{postCount}</div>
                        </div>
                        <div className="rmp-stat">
                            <div className="rmp-statLabel">내 댓글</div>
                            <div className="rmp-statValue">{commentCount}</div>
                        </div>
                    </div>

                    <div className="rmp-divider" />

                    <div className="rmp-listBox">
                        <h3 className="rmp-subTitle">최근 활동</h3>

                        <div className="rmp-list">
                            <div className="rmp-listItem">
                                <div className="rmp-listTitle">최근 작성 게시글</div>
                                <div className="rmp-listDesc">
                                    {recentPosts.length === 0
                                        ? "-"
                                        : recentPosts.map((p) => (
                                            <div key={p.postId}>{p.title}</div>
                                        ))}
                                </div>
                            </div>

                            <div className="rmp-listItem">
                                <div className="rmp-listTitle">최근 작성 댓글</div>
                                <div className="rmp-listDesc">
                                    {recentComments.length === 0
                                        ? "-"
                                        : recentComments.map((c) => (
                                            <div key={c.commentId}>
                                                <strong>{c.postTitle}</strong> - {c.content}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {(loading || saving) && (
                <div className="rmp-footerHint">{loading ? "불러오는 중..." : "저장 중..."}</div>
            )}
        </div>
    );
}
