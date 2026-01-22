import "./SampleRecruitModal.css";
import { useEffect, useState } from "react";

const formatDate = (value, fallback) => value ?? fallback ?? "-";

const SampleRecruitModal = ({ open, onClose, study }) => {
  const [step, setStep] = useState(1); // 1: 상세, 2: 신청서
  const [intro, setIntro] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setIntro("");
    }
  }, [open]);

  if (!open || !study) return null;

  // ✅ 기존 데이터 구조 그대로 대응 (없으면 대체값)
  const studyName = study.studyName ?? study.title ?? "스터디";
  const certName = study.cert ?? "자격증";
  const leaderName = study.leader ?? study.author ?? "user1";
  const deadline = formatDate(study.deadline, "2026.01.31 (일)");
  const startDate = formatDate(study.startDate, "2026.02.01 (월)");
  const description =
    study.description ??
    "매주 2회 스터디 진행합니다. 꾸준히 참여 가능하신 분 환영합니다.";

  const handleGoStep2 = () => setStep(2);

  const handleSubmit = () => {
    if (!intro.trim()) {
      alert("신청 목적 및 간단한 자기소개를 입력해 주세요.");
      return;
    }

    console.log("신청 데이터:", {
      studyId: study.id,
      studyName,
      certName,
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
              {/* 왼쪽 일러스트 */}
              <div className="sr2-illust" aria-hidden="true">
                {/* SVG로 가볍게(외부 이미지 필요 없음) */}
                <svg width="150" height="150" viewBox="0 0 160 160">
                  <rect x="26" y="98" width="108" height="34" rx="10" fill="#EAF6EE" />
                  <rect x="34" y="106" width="92" height="18" rx="8" fill="#D7ECD9" />
                  <circle cx="72" cy="60" r="20" fill="#97C793" opacity="0.45" />
                  <circle cx="92" cy="58" r="18" fill="#97C793" opacity="0.25" />
                  <rect x="52" y="72" width="56" height="14" rx="7" fill="#97C793" opacity="0.5" />
                  <path d="M58 46c6-10 14-14 24-14s18 4 24 14" stroke="#2F6A43" strokeWidth="3" fill="none"/>
                  <path d="M52 62c6 8 14 12 24 12s18-4 24-12" stroke="#2F6A43" strokeWidth="3" fill="none"/>
                  <circle cx="70" cy="54" r="2.6" fill="#2F6A43"/>
                  <circle cx="90" cy="54" r="2.6" fill="#2F6A43"/>
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
                  <div className="sr2-k">자격증명</div>
                  <div className="sr2-v">{certName}</div>
                </div>

                <div className="sr2-row">
                  <div className="sr2-k">모집마감일</div>
                  <div className="sr2-v">{deadline}</div>
                </div>

                <div className="sr2-row">
                  <div className="sr2-k">스터디 시작일</div>
                  <div className="sr2-v">{startDate}</div>
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
              <div className="sr2-form-label">신청 목적 및 간단한 자기소개</div>
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

export default SampleRecruitModal;
