import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import "./MyApplications.css";

const MyApplications = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      alert("로그인이 필요한 페이지입니다.");
      navigate("/auth");
    }
  }, [navigate]);

  const [tab, setTab] = useState("sent");
  const [list, setList] = useState([]);
  const [openApplicationId, setOpenApplicationId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchApplications = async (signal) => {
    try {
      setLoading(true);
      setList([]);
      setOpenApplicationId(null);

      const url =
          tab === "sent"
              ? "/applications/sent"
              : "/applications/received";

      const res = await api.get(url, { signal });
      setList(res.data);
    } catch (e) {
      if (e.code === "ERR_CANCELED") return;
      console.error("신청 목록 조회 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchApplications(controller.signal);

    return () => controller.abort();
  }, [tab]);

  const toggleDetail = (joinId, requestedAt) => {
    setOpenApplicationId((prev) => (prev === joinId ? null : joinId));

    sessionStorage.setItem("lastCheckedAt", requestedAt);
  };

  const handleApprove = async (joinId) => {
    try {
      await api.post(`/applications/${joinId}/approve`);
      alert("승인 되었습니다.");
      fetchApplications();
      setOpenApplicationId(null);
    } catch (e) {
      alert(e.response?.data?.message || "승인 실패");
    }
  };

  const handleReject = async (joinId) => {
    try {
      await api.post(`/applications/${joinId}/reject`);
      alert("거절 되었습니다.");
      fetchApplications();
      setOpenApplicationId(null);
    } catch (e) {
      alert("거절 실패");
    }
  };

  const isReceived = tab === "received";

  const columns = useMemo(() => {
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
                disabled={loading}
            >
              내가 신청한 스터디
            </button>

            <button
                className={`tab-chip ${tab === "received" ? "active" : ""}`}
                onClick={() => setTab("received")}
                disabled={loading}
            >
              신청 받은 스터디
            </button>
          </div>
        </div>

        <div className="apply-table">
          <div
              className="apply-thead"
              style={{ gridTemplateColumns: columns.join(" ") }}
          >
            <div>스터디명</div>
            <div>{isReceived ? "신청자" : "스터디장"}</div>
            <div>{isReceived ? "관리" : "상태"}</div>
          </div>

          {loading ? (
              <div className="apply-empty">불러오는 중...</div>
          ) : list.length === 0 ? (
              <div className="apply-empty">신청 내역이 없습니다.</div>
          ) : (
              list.map((item) => {
                const opened =
                    isReceived && openApplicationId === item.joinId;

                return (
                    <React.Fragment key={item.joinId}>
                      <div
                          className={`apply-row ${
                              isReceived ? "clickable" : ""
                          } ${opened ? "opened" : ""}`}
                          style={{ gridTemplateColumns: columns.join(" ") }}
                          onClick={() =>
                              isReceived &&
                              toggleDetail(item.joinId, item.requestedAt)
                          }
                      >
                        <div className="cell title">
                          <strong className="study-title">
                            {item.studyTitle}
                          </strong>
                        </div>

                        <div className="cell who">
                          {isReceived
                              ? item.applicantNickname
                              : item.ownerNickname}
                        </div>

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

                      {isReceived && opened && (
                          <div className="apply-detail">
                            <div className="detail-card">
                              <div className="detail-grid">
                                <div className="detail-item">
                                  <div className="dk">닉네임</div>
                                  <div className="dv">
                                    {item.applicantNickname}
                                  </div>
                                </div>

                                <div className="detail-item">
                                  <div className="dk">성별</div>
                                  <div className="dv">
                                    {item.gender === "FEMALE"
                                        ? "여성"
                                        : "남성"}
                                  </div>
                                </div>

                                <div className="detail-item">
                                  <div className="dk">나이</div>
                                  <div className="dv">{item.age}세</div>
                                </div>
                              </div>

                              <div className="msg">
                                <div className="msg-title">신청 메시지</div>
                                <textarea
                                    readOnly
                                    value={item.applyMessage || ""}
                                />
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
