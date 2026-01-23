import "./RoomPageModal.css";
import React, { useEffect, useState } from "react";
import api from "../../api/api";

const formatKoreanDate = (value) => {
  if (!value) return "미정";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}년 ${month}월 ${day}일`;
};

const RoomPageModal = ({ open, onClose, study }) => {
  const [step, setStep] = useState(1);
  const [requestUserNickname, setRequestUserNickname] = useState("");
  const [applyMessage, setApplyMessage] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setRequestUserNickname("");
      setApplyMessage("");
    }
  }, [open]);

  if (!open || !study) return null;

  const handleGoStep2 = () => setStep(2);

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

      alert("신청이 완료되었습니다.");
      onClose();
    } catch (e) {
      console.error("신청 실패", e);
      alert(e.response?.data?.message || "신청 중 오류가 발생했습니다.");
    }
  };

  const maxPeople = study.maxPeople ? `${study.maxPeople}명` : "미정";

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
                  {/* ===== 왼쪽 일러스트 ===== */}
                  <div className="sr2-illust" aria-hidden="true">
                    <svg width="150" height="150" viewBox="0 0 160 160">
                      <rect x="26" y="98" width="108" height="34" rx="10" fill="#EAF6EE" />
                      <rect x="34" y="106" width="92" height="18" rx="8" fill="#D7ECD9" />
                      <circle cx="72" cy="60" r="20" fill="#97C793" opacity="0.45" />
                      <circle cx="92" cy="58" r="18" fill="#97C793" opacity="0.25" />
                      <rect x="52" y="72" width="56" height="14" rx="7" fill="#97C793" opacity="0.5" />
                      <path d="M58 46c6-10 14-14 24-14s18 4 24 14" stroke="#2F6A43" strokeWidth="3" fill="none" />
                      <path d="M52 62c6 8 14 12 24 12s18-4 24-12" stroke="#2F6A43" strokeWidth="3" fill="none" />
                      <circle cx="70" cy="54" r="2.6" fill="#2F6A43" />
                      <circle cx="90" cy="54" r="2.6" fill="#2F6A43" />
                      <path d="M115 52l18-12" stroke="#97C793" strokeWidth="3" />
                      <path d="M133 40l-4 14 14-4z" fill="#97C793" />
                    </svg>
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
                      <div className="sr2-v">{formatKoreanDate(study.deadline)}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">시험일자</div>
                      <div className="sr2-v">{formatKoreanDate(study.examDate)}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">스터디 기간</div>
                      <div className="sr2-v">
                        {formatKoreanDate(study.startDate)} ~{" "}
                        {formatKoreanDate(study.endDate)}
                      </div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">최대 인원</div>
                      <div className="sr2-v">{maxPeople}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">성별 제한</div>
                      <div className="sr2-v">{genderMap[study.gender]}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">스터디장</div>
                      <div className="sr2-v">{study.nickname}</div>
                    </div>

                    <div className="sr2-row sr2-row-desc">
                      <div className="sr2-k">설명</div>
                      <div className="sr2-v sr2-desc">{study.content}</div>
                    </div>
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
                  <button className="sr2-primary" onClick={handleGoStep2}>
                    가입하기
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
