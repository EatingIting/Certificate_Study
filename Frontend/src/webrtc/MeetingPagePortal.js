import { createPortal } from "react-dom";
import { useMemo } from "react";
import MeetingPage from "./MeetingPage";

const MeetingPortal = () => {
  const meetingRoot = useMemo(() => document.getElementById("meeting-root"), []);
  if (!meetingRoot) {
    console.warn("[MeetingPortal] #meeting-root가 없습니다. index.html 확인하세요.");
    return null;
  }
  return createPortal(<MeetingPage />, meetingRoot);
};

export default MeetingPortal;