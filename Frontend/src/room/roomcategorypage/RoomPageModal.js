import "./RoomPageModal.css";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { getBackendOrigin } from "../../utils/backendUrl";
import sampleImg from "../../mainpage/sample.jpg";

const formatKoreanDate = (value) => {
  if (!value) return "미정";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}년 ${month}월 ${day}일`;
};

const RoomPageModal = ({ open, onClose, study }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [requestUserNickname, setRequestUserNickname] = useState("");
  const [applyMessage, setApplyMessage] = useState("");

  const [myGender, setMyGender] = useState(null);
  const [genderLoading, setGenderLoading] = useState(true);

  const getEmailFromToken = () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return null;

    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));

    return decoded.sub;
  };

    useEffect(() => {
        if (!open) return;

        const token = sessionStorage.getItem("accessToken");

        if (!token) {
            setGenderLoading(false);
            setMyGender(null);
            return;
        }

        setGenderLoading(true);

        api.get("/mypage/me/gender")
            .then((res) => {
                setMyGender(res.data);
            })
            .finally(() => {
                setGenderLoading(false);
            });
    }, [open]);


    if (!open || !study) return null;

  const myEmail = (getEmailFromToken() || "").trim().toLowerCase();
  const isLoggedIn = !!myEmail;

  const hostEmail = String(study.hostUserEmail || study.hostEmail || "").trim().toLowerCase();
  const isMyStudy = !!hostEmail && hostEmail === myEmail;

  const isGenderAllowed =
      study.gender === "ALL" || (myGender && study.gender === myGender);

  const handleGoStep2 = () => setStep(2);

  const getImageUrl = (img) => {
    if (!img) return sampleImg;

    if (img.startsWith("http")) return img;

    return `${getBackendOrigin()}${img}`;
  };

  const handleSubmit = async () => {
    if (!requestUserNickname.trim()) {
      alert("신청자 닉네임을 입력해 주세요.");
      return;
    }

    if (!applyMessage.trim()) {
      alert("신청 목적 및 간단한 자기소개를 입력해 주세요.");
      return;
    }

    try {
      await api.post("/applications", {
        roomId: study.roomId,
        requestUserNickname,
        applyMessage,
      });

      try {
        window.dispatchEvent(new CustomEvent("room:applications-changed"));
      } catch (e) {
        // ignore event dispatch failure
      }

      alert("신청이 완료되었습니다.");
      onClose();
      navigate("/room");
    } catch (e) {
      console.error("신청 실패", e);
      alert(e.response?.data?.message || "신청 중 오류가 발생했습니다.");
    }
  };

  const genderMap = {
    ALL: "전체",
    FEMALE: "여자",
    MALE: "남자",
  };

  return (
      <div className="sr2-backdrop" onClick={onClose}>
        <div className="sr2-modal" onClick={(e) => e.stopPropagation()}>
          {/* ===== 헤더 ===== */}
          <div className="sr2-header">
            <div className="sr2-title">
              {step === 1 ? "스터디 가입하기" : "스터디 신청하기"}
            </div>
            <div className="sr2-subtitle">
              {step === 1
                  ? "스터디 정보를 확인해 주세요."
                  : "신청 목적과 간단한 자기소개를 작성해 주세요."}
            </div>
          </div>

          {/* ===== 본문 ===== */}
          <div className="sr2-body">
            {step === 1 ? (
                <div className="sr2-content">
                  {/* ===== 왼쪽 이미지 ===== */}
                  <div className="sr2-illust">
                    <img
                        src={getImageUrl(study.roomImg)}
                        alt="스터디 사진"
                        className="sr2-study-img"
                        onError={(e) => {
                          e.currentTarget.src = sampleImg;
                        }}
                    />
                  </div>


                  {/* ===== 오른쪽 정보 ===== */}
                  <div className="sr2-info">
                    <div className="sr2-row">
                      <div className="sr2-k">스터디명</div>
                      <div className="sr2-v">{study.title}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">카테고리</div>
                      <div className="sr2-v">
                        {study.subCategoryName ?? study.midCategoryName}
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">모집 마감일</div>
                      <div className="sr2-v">
                        {formatKoreanDate(study.deadline)}
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">시험일자</div>
                      <div className="sr2-v">
                        {formatKoreanDate(study.examDate)}
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">스터디 기간</div>
                      <div className="sr2-v">
                        {formatKoreanDate(study.startDate)} ~{" "}
                        {formatKoreanDate(study.endDate)}
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">참여 인원</div>
                      <div className="sr2-v">
                        {study.currentParticipants}명 / {study.maxParticipants}명
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">성별 제한</div>
                      <div className="sr2-v">{genderMap[study.gender]}</div>
                    </div>

                    {/* ✅ 로그인 되어 있을 때만 성별 제한 */}
                    {isLoggedIn &&
                        !genderLoading &&
                        !isMyStudy &&
                        !isGenderAllowed && (
                            <div
                                style={{
                                  marginTop: "3px",
                                  fontSize: "13px",
                                  color: "red",
                                  fontWeight: "700",
                                }}
                            >
                              ⚠ 성별 제한으로 신청할 수 없습니다.
                            </div>
                        )}

                    <div className="sr2-row">
                      <div className="sr2-k">스터디장</div>
                      <div className="sr2-v">{study.hostUserNickname}</div>
                    </div>

                    <div className="sr2-row sr2-row-desc">
                      <div className="sr2-k">설명</div>
                      <div className="sr2-v sr2-desc">{study.content}</div>
                    </div>
                    {!isLoggedIn && (
                        <div
                            style={{
                              marginTop: "15px",
                              padding: "12px",
                              backgroundColor: "#fff3f3",
                              border: "1px solid red",
                              borderRadius: "8px",
                              fontSize: "15px",
                              fontWeight: "800",
                              color: "red",
                              textAlign: "center",
                            }}
                        >
                          ⚠ 로그인 후 신청할 수 있습니다.
                        </div>
                    )}
                  </div>
                </div>
            ) : (
                <div className="sr2-form">
                  <div className="sr2-form-label">신청자 닉네임</div>
                  <input
                      className="form-input"
                      placeholder="닉네임을 입력해 주세요"
                      value={requestUserNickname}
                      onChange={(e) => setRequestUserNickname(e.target.value)}
                  />

                  <div className="sr2-form-label">
                    신청 목적 및 간단한 자기소개
                  </div>
                  <textarea
                      className="sr2-textarea"
                      placeholder="예) 토익 800 목표입니다. 매주 2회 이상 참여 가능합니다."
                      value={applyMessage}
                      maxLength={300}
                      onChange={(e) => setApplyMessage(e.target.value)}
                  />
                  <div className="sr2-count">{applyMessage.length}/300</div>
                </div>
            )}
          </div>

          {/* ===== 하단 버튼 ===== */}
          <div className="sr2-actions">
            {step === 1 ? (
                <>
                  <button
                      className="sr2-primary"
                      disabled={
                          !isLoggedIn ||
                          (!genderLoading && !isMyStudy && !isGenderAllowed)
                      }
                      onClick={() => {
                        if (!isLoggedIn) {
                          alert("로그인 후 신청할 수 있습니다.");
                          return;
                        }

                        if (!isMyStudy && !isGenderAllowed) return;

                        if (isMyStudy) {
                          api.get(`/rooms/${study.roomId}`).then((res) => {
                            navigate("/room/create", {
                              state: { study: res.data },
                            });
                          });
                        } else {
                          handleGoStep2();
                        }
                      }}
                  >
                    {isMyStudy ? "수정하기" : "신청하기"}
                  </button>

                  <button className="sr2-outline" onClick={onClose}>
                    취소
                  </button>
                </>
            ) : (
                <>
                  <button className="sr2-primary" onClick={handleSubmit}>
                    신청하기
                  </button>
                  <button className="sr2-outline" onClick={onClose}>
                    닫기
                  </button>
                </>
            )}
          </div>
        </div>
      </div>
  );
};

export default RoomPageModal;
