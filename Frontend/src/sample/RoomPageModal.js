import "./RoomPageModal.css";
import { useEffect, useState } from "react";

const RoomPageModal = ({ open, onClose, study }) => {
  const [step, setStep] = useState(1);
  const [intro, setIntro] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setIntro("");
    }
  }, [open]);

  if (!open || !study) return null;

  const studyName = study.title;
  const description = study.description;

  const deadline = study.deadline ?? "백엔드 추가 예정"; // 모집 마감일 (미정)

  const maxPeople = study.maxPeople
      ? `${study.maxPeople}명`
      : "백엔드 추가 예정";

  const genderMap = {
    ALL: "전체",
    FEMALE: "여자",
    MALE: "남자",
  };

  const gender = study.gender;

  const leaderName = study.nickname;

  const category =
      study.subCategoryName ??
      study.midCategoryName;

  /* 아직 없는 값 */
  const examDate = "백엔드 추가 예정" // 시험
  const startDate = "백엔드 추가 예정" //스터디 시작일
  const endDate = "백엔드 추가 예정"; //스터디 종료일


  const handleGoStep2 = () => setStep(2);

  const handleSubmit = () => {
    if (!intro.trim()) {
      alert("신청 목적 및 간단한 자기소개를 입력해 주세요.");
      return;
    }

    console.log("신청 데이터:", {
      roomId: study.roomId,
      intro,
    });

    alert("신청이 완료되었습니다!");
    onClose();
  };


  return (
      <div className="sr2-backdrop" onClick={onClose}>
        <div className="sr2-modal" onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="sr2-header">
            <div className="sr2-title">
              {step === 1 ? "스터디 가입하기" : "스터디 신청하기"}
            </div>
            <div className="sr2-subtitle">
              {step === 1
                  ? "같은 목표를 가진 사람들과 함께 더 꾸준한 공부를 시작해 보세요."
                  : "신청 목적과 간단한 자기소개를 작성해 주세요."}
            </div>
          </div>

          {/* 본문 */}
          <div className="sr2-body">
            {step === 1 ? (
                <div className="sr2-content">
                  {/* 왼쪽 일러스트 (이 부분 스터디 등록할 때 올린 파일로 바꿀 예정 아마도*/}
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

                  {/* 오른쪽 정보 */}
                  <div className="sr2-info">
                    <div className="sr2-row">
                      <div className="sr2-k">스터디명</div>
                      <div className="sr2-v">{studyName}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">카테고리</div>
                      <div className="sr2-v">{category}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">모집 마감일</div>
                      <div className="sr2-v sr2-soon">{deadline}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">시험일자</div>
                      <div className="sr2-v sr2-soon">{examDate}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">스터디 시작일</div>
                      <div className="sr2-v sr2-soon">{startDate}</div>
                    </div>
                    <div className="sr2-row">
                      <div className="sr2-k">스터디 종료일</div>
                      <div className="sr2-v sr2-soon">{endDate}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">최대 인원</div>
                      <div className="sr2-v">{maxPeople}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">성별 제한</div>
                      <div className="sr2-v">{gender}</div>
                    </div>

                    <div className="sr2-row">
                      <div className="sr2-k">스터디장</div>
                      <div className="sr2-v">{leaderName}</div>
                    </div>

                    <div className="sr2-row sr2-row-desc">
                      <div className="sr2-k">설명</div>
                      <div className="sr2-v sr2-desc">{description}</div>
                    </div>
                  </div>
                </div>
            ) : (
                <div className="sr2-form">
                  <div className="sr2-form-label">
                    신청 목적 및 간단한 자기소개
                  </div>
                  <textarea
                      className="sr2-textarea"
                      placeholder="예) 토익 800 목표입니다. 매주 2회 이상 참여 가능합니다..."
                      value={intro}
                      maxLength={300}
                      onChange={(e) => setIntro(e.target.value)}
                  />
                  <div className="sr2-count">{intro.length}/300</div>
                </div>
            )}
          </div>

          {/* 하단 버튼 */}
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
