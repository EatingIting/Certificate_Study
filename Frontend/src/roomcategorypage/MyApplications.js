import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import "./MyApplications.css";

const MyApplications = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      alert("로그인이 필요한 페이지입니다.");
      navigate("/auth");
    }
  }, [navigate]);

  const [tab, setTab] = useState("sent"); // sent | received
  const [list, setList] = useState([]);
  const [openApplicationId, setOpenApplicationId] = useState(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const url = tab === "sent" ? "/applications/sent" : "/applications/received";
        const res = await api.get(url);
        setList(res.data);
        setOpenApplicationId(null);
      } catch (e) {
        console.error("신청 목록 조회 실패", e);
      }
    };
    fetchApplications();
  }, [tab]);

  const toggleDetail = (joinId) => {
    setOpenApplicationId((prev) => (prev === joinId ? null : joinId));
  };

  const handleApprove = async (joinId) => {
    try {
      await api.post(`/applications/${joinId}/approve`);
      setList((prev) => prev.filter((item) => item.joinId !== joinId));
      setOpenApplicationId(null);
    } catch (e) {
      console.error("승인 실패", e);
    }
  };

  const handleReject = async (joinId) => {
    try {
      await api.post(`/applications/${joinId}/reject`);
      setList((prev) => prev.filter((item) => item.joinId !== joinId));
      setOpenApplicationId(null);
    } catch (e) {
      console.error("거절 실패", e);
    }
  };

  const isReceived = tab === "received";

  const columns = useMemo(() => {
    // RoomPage처럼 고정 컬럼 폭 느낌
    // sent: 스터디명 / 스터디장 / 상태
    // received: 스터디명 / 신청자 / 관리
    return isReceived
      ? ["1fr", "160px", "180px"]
      : ["1fr", "160px", "140px"];
  }, [isReceived]);

  return (
    <div className="apply-wrap">
      <div className="apply-head">
        <h2 className="apply-title">스터디 신청 현황</h2>

        <div className="apply-tabs">
          <button
            className={`tab-chip ${tab === "sent" ? "active" : ""}`}
            onClick={() => setTab("sent")}
          >
            내가 신청한 스터디
          </button>
          <button
            className={`tab-chip ${tab === "received" ? "active" : ""}`}
            onClick={() => setTab("received")}
          >
            신청 받은 스터디
          </button>
        </div>
      </div>

      <div className="apply-table">
        {/* 헤더 */}
        <div
          className="apply-thead"
          style={{ gridTemplateColumns: columns.join(" ") }}
        >
          <div>스터디명</div>
          <div>{isReceived ? "신청자" : "스터디장"}</div>
          <div>{isReceived ? "관리" : "상태"}</div>
        </div>

        {/* 바디 */}
        {list.length === 0 ? (
          <div className="apply-empty">신청 내역이 없습니다.</div>
        ) : (
          list.map((item) => {
            const opened = isReceived && openApplicationId === item.joinId;

            return (
              <React.Fragment key={item.joinId}>
                <div
                  className={`apply-row ${isReceived ? "clickable" : ""} ${opened ? "opened" : ""}`}
                  style={{ gridTemplateColumns: columns.join(" ") }}
                  onClick={() => isReceived && toggleDetail(item.joinId)}
                  role={isReceived ? "button" : undefined}
                  tabIndex={isReceived ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!isReceived) return;
                    if (e.key === "Enter") toggleDetail(item.joinId);
                  }}
                >
                  <div className="cell title">
                    <strong className="study-title">{item.studyTitle}</strong>
                    {/* optional: 태그 느낌으로 쓰고 싶으면 */}
                    {/* <span className="tag">스터디</span> */}
                  </div>

                  <div className="cell who">
                    {isReceived ? item.applicantNickname : item.ownerNickname}
                  </div>

                  {/* 상태 / 관리 */}
                  {!isReceived ? (
                    <div className={`cell status-pill ${item.status}`}>
                      {item.status}
                    </div>
                  ) : (
                    <div className="cell actions">
                      <button
                        className="btn-approve"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(item.joinId);
                        }}
                      >
                        승인
                      </button>
                      <button
                        className="btn-reject"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(item.joinId);
                        }}
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>

                {/* 상세 */}
                {isReceived && opened && (
                  <div className="apply-detail">
                    <div className="detail-card">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <div className="dk">닉네임</div>
                          <div className="dv">{item.applicantNickname}</div>
                        </div>
                        <div className="detail-item">
                          <div className="dk">성별</div>
                          <div className="dv">
                            {item.gender === "FEMALE" ? "여성" : "남성"}
                          </div>
                        </div>
                        <div className="detail-item">
                          <div className="dk">나이</div>
                          <div className="dv">{item.age}세</div>
                        </div>
                      </div>

                      <div className="msg">
                        <div className="msg-title">신청 메시지</div>
                        <textarea readOnly value={item.applyMessage || ""} />
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MyApplications;