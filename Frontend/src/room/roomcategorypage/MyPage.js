import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import "./MyPage.css";

const MyPage = () => {
  const [profile, setProfile] = useState(null);

  const [editOpen, setEditOpen] = useState(false);

  const [certInput, setCertInput] = useState("");
  const [certs, setCerts] = useState(["정보처리기사", "토익", "SQLD"]);

  const joinedStudies = useMemo(
      () => [
        {
          id: 1,
          title: "정보처리기사 스터디",
          status: "진행중",
        },
        { id: 2, title: "토익 준비반", status: "진행중" },
      ],
      []
  );

  const completedStudies = useMemo(
      () => [
        { id: 101, title: "SQLD 자격증 따기", meta: "2024.03.15" },
        { id: 102, title: "NCS 공부", meta: "2024.02.20" },
      ],
      []
  );

  const [draft, setDraft] = useState(null);

  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");

      const res = await axios.get("/api/mypage/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProfile(res.data);
    } catch (err) {
      console.error("마이페이지 조회 실패", err);
    }
  };

  const openEdit = () => {
    setDraft(profile);
    setPreviewImage(profile.profileImg || "/profile.jpeg");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      const token = localStorage.getItem("accessToken");

      const formData = new FormData();
      formData.append("name", draft.name);
      formData.append("nickname", draft.nickname);
      formData.append("birthDate", draft.birthDate);
      formData.append("introduction", draft.introduction);

      if (draft.profileImg instanceof File) {
        formData.append("profileImage", draft.profileImg);
      }

      await axios.put("/api/mypage/me", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      alert("수정되었습니다");

      await fetchProfile();
      setEditOpen(false);
    } catch (err) {
      console.error("수정 실패", err);
    }
  };

  const addCert = () => {
    const v = certInput.trim();
    if (!v) return;
    if (certs.includes(v)) {
      setCertInput("");
      return;
    }
    setCerts((prev) => [v, ...prev]);
    setCertInput("");
  };

  const removeCert = (name) => {
    setCerts((prev) => prev.filter((c) => c !== name));
  };

  const withdraw = async () => {
    const ok = window.confirm("정말 회원탈퇴 하시겠어요? (되돌릴 수 없음)");
    if (!ok) return;

    try {
      const token = localStorage.getItem("accessToken");

      await axios.delete("/api/mypage/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert("탈퇴 되었습니다");

      localStorage.clear();
      window.location.href = "/";
    } catch (err) {
      console.error("회원탈퇴 실패", err);
      alert("탈퇴에 실패했습니다");
    }
  };

  const onSelectImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 선택할 수 있어요.");
      return;
    }

    setPreviewImage(URL.createObjectURL(file));
    setDraft({ ...draft, profileImg: file });
  };

  if (!profile) return <div>로딩중...</div>;

  return (
      <div className="mypage-wrap">
        <h2 className="mypage-title">마이페이지</h2>

        <div className="mypage-card">
          <section className="section">
            <div className="section-head">
              <h3>내 프로필</h3>
              <button className="btn btn-ghost" onClick={openEdit}>
                ✎ 프로필 수정
              </button>
            </div>

            <div className="profile-grid">
              <div className="avatar-box">
                <img
                    className="avatar"
                    src={profile.profileImg || "/profile.jpeg"}
                    alt="profile"
                />
              </div>

              <div className="profile-box">
                <div className="profile-col">
                  <div className="kv">
                    <span className="k">이름</span>
                    <span className="v">{profile.name}</span>
                  </div>
                  <div className="kv">
                    <span className="k">닉네임</span>
                    <span className="v">{profile.nickname}</span>
                  </div>
                  <div className="kv">
                    <span className="k">생년월일</span>
                    <span className="v">{profile.birthDate}</span>
                  </div>
                  <div className="kv">
                    <span className="k">가입일</span>
                    <span className="v">{profile.createdAt?.slice(0, 10)}</span>
                  </div>
                </div>

                <div className="divider" />

                <div className="profile-col">
                  <div className="kv">
                    <span className="k">이메일</span>
                    <span className="v">{profile.email}</span>
                  </div>
                  <div className="kv">
                    <span className="k">성별</span>
                    <span className="v">{profile.gender}</span>
                  </div>
                  <div className="kv kv-bio">
                    <span className="k">자기소개</span>
                    <span className="v">{profile.introduction}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h3>관심 자격증</h3>
              <div className="cert-actions">
                <div className="cert-input">
                  <input
                      value={certInput}
                      onChange={(e) => setCertInput(e.target.value)}
                      placeholder="자격증명 입력 (예: 정보처리기사)"
                      onKeyDown={(e) => e.key === "Enter" && addCert()}
                  />
                  <button className="btn btn-soft" onClick={addCert}>
                    + 추가
                  </button>
                </div>
              </div>
            </div>

            <div className="chip-row">
              {certs.length === 0 ? (
                  <div className="empty">등록된 관심 자격증이 없어요.</div>
              ) : (
                  certs.map((c) => (
                      <span className="chip" key={c}>
                  {c}
                        <button
                            className="chip-x"
                            onClick={() => removeCert(c)}
                            aria-label="remove"
                        >
                    ×
                  </button>
                </span>
                  ))
              )}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h3>스터디 목록</h3>
            </div>

            <div className="study-grid">
              <div className="study-col">
                <h4 className="sub-title">가입한 스터디</h4>

                {joinedStudies.map((s) => (
                    <div className="study-item" key={s.id}>
                      <div className="study-left">
                        <div className="study-name">{s.title}</div>
                        <div className="study-sub">{s.dateText}</div>
                      </div>

                      <div className="study-right">
                        <span className="badge badge-green">{s.status}</span>
                      </div>
                    </div>
                ))}

                {joinedStudies.length === 0 && (
                    <div className="empty-box">가입한 스터디가 없어요.</div>
                )}
              </div>

              <div className="study-col">
                <h4 className="sub-title">완료된 스터디</h4>

                {completedStudies.map((s) => (
                    <div className="study-item" key={s.id}>
                      <div className="study-left">
                        <div className="study-name">{s.title}</div>
                        <div className="study-sub">종료일: {s.meta}</div>
                      </div>

                      <div className="study-right">
                        <span className="badge badge-gray">종료</span>
                      </div>
                    </div>
                ))}

                {completedStudies.length === 0 && (
                    <div className="empty-box">완료된 스터디가 없어요.</div>
                )}
              </div>
            </div>

            <div className="withdraw-row">
              <button className="btn btn-danger" onClick={withdraw}>
                회원탈퇴
              </button>
            </div>
          </section>
        </div>

        {editOpen && draft && (
            <div className="modal-dim" onMouseDown={() => setEditOpen(false)}>
              <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h3>프로필 수정</h3>
                  <button className="icon-btn" onClick={() => setEditOpen(false)}>
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-grid">
                    <label className="field">
                      <span>이름</span>
                      <input value={draft.name} disabled />
                    </label>

                    <label className="field">
                      <span>닉네임</span>
                      <input
                          value={draft.nickname}
                          onChange={(e) =>
                              setDraft({ ...draft, nickname: e.target.value })
                          }
                      />
                    </label>

                    <label className="field">
                      <span>이메일</span>
                      <input value={draft.email} disabled />
                    </label>

                    <label className="field">
                      <span>생년월일</span>
                      <input value={draft.birthDate} disabled />
                    </label>

                    <label className="field">
                      <span>성별</span>
                      <select value={draft.gender} disabled>
                        <option value="남">남</option>
                        <option value="여">여</option>
                      </select>
                    </label>

                    <label className="field field-full">
                      <span>자기소개</span>
                      <textarea
                          rows={3}
                          value={draft.introduction}
                          onChange={(e) =>
                              setDraft({ ...draft, introduction: e.target.value })
                          }
                      />
                    </label>

                    <label className="field field-full">
                      <span>프로필 이미지</span>

                      <div className="profile-upload">
                        <img
                            src={previewImage}
                            alt="preview"
                            className="preview-img"
                            onError={(e) => {
                              e.currentTarget.src = "/profile.jpeg";
                            }}
                        />

                        <label className="upload-btn">
                          이미지 선택
                          <input
                              type="file"
                              accept="image/*"
                              onChange={onSelectImage}
                              hidden
                          />
                        </label>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="modal-foot">
                  <button
                      className="btn btn-gray"
                      onClick={() => setEditOpen(false)}
                  >
                    취소
                  </button>
                  <button className="btn btn-soft" onClick={saveEdit}>
                    저장
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default MyPage;
