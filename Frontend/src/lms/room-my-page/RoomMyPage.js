import React, { useEffect, useMemo, useState } from "react";
import "./RoomMyPage.css";

/**
 * LMS 방별 마이페이지 (room별 닉네임/프로필사진 관리)
 * - URL 기반이면: roomId를 react-router useParams로 가져오면 됨
 * - 여기서는 상단 room 선택 드롭다운까지 포함(개발 편의)
 */

function fakeFetchMyRooms() {
    return Promise.resolve([
        { roomId: "room-001", roomName: "자바 스터디 1반" },
        { roomId: "room-002", roomName: "SQLD 스터디" },
        { roomId: "room-003", roomName: "Spring Boot 실습반" },
    ]);
}

function fakeFetchRoomProfile(roomId) {
    // room별로 다른 프로필처럼 보이게 더미 분기
    let map = {
        "room-001": { nickname: "홍길동", profileImageUrl: "" },
        "room-002": { nickname: "홍길동(SQL)", profileImageUrl: "" },
        "room-003": { nickname: "홍길동(스프링)", profileImageUrl: "" },
    };
    return Promise.resolve(map[roomId] || { nickname: "홍길동", profileImageUrl: "" });
}

function fakeUpdateNickname(roomId, nickname) {
    // 실제로는 PATCH /api/rooms/{roomId}/mypage/nickname
    return Promise.resolve({ ok: true, roomId, nickname });
}

function fakeUpdateProfileImageUrl(roomId, profileImageUrl) {
    // 실제로는 PATCH /api/rooms/{roomId}/mypage/profile-image
    return Promise.resolve({ ok: true, roomId, profileImageUrl });
}

export default function RoomMyPage() {
    let [rooms, setRooms] = useState([]);
    let [selectedRoomId, setSelectedRoomId] = useState("");

    let [loading, setLoading] = useState(false);
    let [saving, setSaving] = useState(false);

    // profile (server state)
    let [nickname, setNickname] = useState("");
    let [profileImageUrl, setProfileImageUrl] = useState("");

    // edit UI state
    let [isNicknameEditing, setIsNicknameEditing] = useState(false);
    let [nicknameDraft, setNicknameDraft] = useState("");

    let [imageMode, setImageMode] = useState("url"); // "url" | "preview"
    let [imageUrlDraft, setImageUrlDraft] = useState("");

    // messages
    let [errorMsg, setErrorMsg] = useState("");
    let [successMsg, setSuccessMsg] = useState("");

    let selectedRoom = useMemo(() => {
        let found = rooms.find((r) => r.roomId === selectedRoomId);
        return found || null;
    }, [rooms, selectedRoomId]);

    useEffect(() => {
        let mounted = true;

        (async () => {
        try {
            setLoading(true);
            setErrorMsg("");
            setSuccessMsg("");

            let list = await fakeFetchMyRooms();
            if (!mounted) return;
            setRooms(list);

            // 기본 선택: 첫 방
            if (list.length > 0) {
            setSelectedRoomId(list[0].roomId);
            }
        } catch (e) {
            if (!mounted) return;
            setErrorMsg("방 목록을 불러오지 못했습니다.");
        } finally {
            if (!mounted) return;
            setLoading(false);
        }
        })();

        return () => {
        mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedRoomId) return;

        let mounted = true;

        (async () => {
        try {
            setLoading(true);
            setErrorMsg("");
            setSuccessMsg("");

            let data = await fakeFetchRoomProfile(selectedRoomId);
            if (!mounted) return;

            setNickname(data.nickname || "");
            setProfileImageUrl(data.profileImageUrl || "");

            // draft 초기화
            setIsNicknameEditing(false);
            setNicknameDraft(data.nickname || "");
            setImageUrlDraft(data.profileImageUrl || "");
        } catch (e) {
            if (!mounted) return;
            setErrorMsg("프로필 정보를 불러오지 못했습니다.");
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
        setSelectedRoomId(e.target.value);
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
        await fakeUpdateNickname(selectedRoomId, next);
        setNickname(next);
        setIsNicknameEditing(false);
        setSuccessMsg("닉네임이 저장됐어.");
        } catch (e) {
        setErrorMsg("닉네임 저장에 실패했어.");
        } finally {
        setSaving(false);
        }
    }

    function applyDefaultAvatar() {
        // 기본 아바타(초기값 빈 문자열)
        clearMessages();
        setImageUrlDraft("");
        setProfileImageUrl("");
        setSuccessMsg("기본 이미지로 설정했어. 저장을 누르면 반영돼.");
    }

    async function saveProfileImageUrl() {
        clearMessages();

        let next = (imageUrlDraft || "").trim();

        // 빈 값 허용(기본 이미지)
        if (next && !isProbablyUrl(next)) {
        setErrorMsg("이미지 URL 형식이 아닌 것 같아. (http/https로 시작하는지 확인)");
        return;
        }

        try {
        setSaving(true);
        await fakeUpdateProfileImageUrl(selectedRoomId, next);
        setProfileImageUrl(next);
        setImageUrlDraft(next);
        setSuccessMsg("프로필 사진이 저장됐어.");
        } catch (e) {
        setErrorMsg("프로필 사진 저장에 실패했어.");
        } finally {
        setSaving(false);
        }
    }

    function isProbablyUrl(value) {
        return /^https?:\/\/.+/i.test(value);
    }

    let displayAvatar = profileImageUrl
        ? profileImageUrl
        : "https://dummyimage.com/160x160/eeeeee/666666&text=ON-SIL";

    return (
        <div className="rmp-wrap">
        <div className="rmp-header">
            <div className="rmp-titleBox">
            <h1 className="rmp-title">마이페이지</h1>
            <p className="rmp-sub">방마다 닉네임 / 프로필 사진을 따로 관리해요.</p>
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
                <div className="rmp-avatarHint">
                    현재 방에서만 보이는 프로필이에요.
                </div>
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
                        type="button"
                        >
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
                        disabled={saving}
                        />
                        <button
                        className="rmp-btn"
                        onClick={saveNickname}
                        disabled={saving}
                        type="button"
                        >
                        저장
                        </button>
                        <button
                        className="rmp-btn rmp-btnGhost"
                        onClick={cancelEditNickname}
                        disabled={saving}
                        type="button"
                        >
                        취소
                        </button>
                    </div>
                    )}
                </div>

                <div className="rmp-divider" />

                <div className="rmp-row">
                    <div className="rmp-rowLabel">프로필 사진</div>

                    <div className="rmp-rowValue">
                    <div className="rmp-tabs">
                        <button
                        type="button"
                        className={`rmp-tab ${imageMode === "url" ? "is-active" : ""}`}
                        onClick={() => setImageMode("url")}
                        disabled={saving}
                        >
                        URL로 설정
                        </button>
                        <button
                        type="button"
                        className={`rmp-tab ${imageMode === "preview" ? "is-active" : ""}`}
                        onClick={() => setImageMode("preview")}
                        disabled={saving}
                        >
                        미리보기
                        </button>
                    </div>

                    {imageMode === "url" ? (
                        <div className="rmp-imageEditor">
                        <input
                            className="rmp-input"
                            value={imageUrlDraft}
                            onChange={(e) => setImageUrlDraft(e.target.value)}
                            placeholder="https://... (비우면 기본 이미지)"
                            disabled={saving}
                        />
                        <div className="rmp-actions">
                            <button
                            className="rmp-btn"
                            onClick={saveProfileImageUrl}
                            disabled={saving}
                            type="button"
                            >
                            저장
                            </button>
                            <button
                            className="rmp-btn rmp-btnGhost"
                            onClick={applyDefaultAvatar}
                            disabled={saving}
                            type="button"
                            >
                            기본 이미지
                            </button>
                        </div>
                        <p className="rmp-help">
                            나중에 파일 업로드로 바꾸려면 이 부분만 교체하면 돼요.
                        </p>
                        </div>
                    ) : (
                        <div className="rmp-previewBox">
                        <div className="rmp-preview">
                            <img
                            className="rmp-previewImg"
                            src={imageUrlDraft ? imageUrlDraft : displayAvatar}
                            alt="preview"
                            onError={(e) => {
                                // 이미지 깨질 때 대비
                                e.currentTarget.src =
                                "https://dummyimage.com/320x200/ffeeee/aa0000&text=Image+Error";
                            }}
                            />
                        </div>

                        <div className="rmp-actions">
                            <button
                            className="rmp-btn"
                            onClick={saveProfileImageUrl}
                            disabled={saving}
                            type="button"
                            >
                            저장
                            </button>
                            <button
                            className="rmp-btn rmp-btnGhost"
                            onClick={applyDefaultAvatar}
                            disabled={saving}
                            type="button"
                            >
                            기본 이미지
                            </button>
                        </div>

                        <p className="rmp-help">
                            URL 입력 후 미리보기에서 확인하고 저장하면 좋아요.
                        </p>
                        </div>
                    )}
                    </div>
                </div>

                <div className="rmp-divider" />

                <div className="rmp-miniNote">
                    <strong>개발 메모</strong>
                    <ul>
                    <li>닉네임/이미지는 <code>(user_id, room_id)</code> 조합으로 저장</li>
                    <li>전역 프로필과 방 프로필을 구분해서 UX가 깔끔해짐</li>
                    </ul>
                </div>
                </div>
            </div>
            </section>

            {/* 오른쪽: 내 활동 요약/최근 활동(placeholder) */}
            <section className="rmp-card">
            <div className="rmp-cardHead">
                <h2 className="rmp-cardTitle">내 활동</h2>
                <span className="rmp-muted">UI만 먼저</span>
            </div>

            <div className="rmp-stats">
                <div className="rmp-stat">
                <div className="rmp-statLabel">내 게시글</div>
                <div className="rmp-statValue">-</div>
                </div>
                <div className="rmp-stat">
                <div className="rmp-statLabel">내 댓글</div>
                <div className="rmp-statValue">-</div>
                </div>
                <div className="rmp-stat">
                <div className="rmp-statLabel">내 일정</div>
                <div className="rmp-statValue">-</div>
                </div>
            </div>

            <div className="rmp-divider" />

            <div className="rmp-listBox">
                <h3 className="rmp-subTitle">최근 활동</h3>

                <div className="rmp-list">
                <div className="rmp-listItem">
                    <div className="rmp-listTitle">최근 작성 게시글</div>
                    <div className="rmp-listDesc">API 연결 전 (placeholder)</div>
                </div>
                <div className="rmp-listItem">
                    <div className="rmp-listTitle">최근 작성 댓글</div>
                    <div className="rmp-listDesc">API 연결 전 (placeholder)</div>
                </div>
                <div className="rmp-listItem">
                    <div className="rmp-listTitle">최근 등록 일정</div>
                    <div className="rmp-listDesc">API 연결 전 (placeholder)</div>
                </div>
                </div>

                <p className="rmp-help">
                통계/최근활동은 나중에 <code>/api/rooms/:roomId/mypage</code> 같은 통합 API로 묶어도 좋아.
                </p>
            </div>
            </section>
        </div>

        <div className="rmp-footerHint">
            {loading ? "불러오는 중..." : saving ? "저장 중..." : "준비 완료"}
        </div>
        </div>
    );
}
