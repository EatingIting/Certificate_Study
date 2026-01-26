import { createPortal } from "react-dom";
import { useMemo } from "react";
import MeetingPage from "./MeetingPage";
import { useMeeting } from "./MeetingContext";

const MeetingPortal = () => {
  const { roomId } = useMeeting();
  const meetingRoot = useMemo(() => document.getElementById("meeting-root"), []);
  
  // sessionStorage에서 roomId 복구
  const savedRoomId = roomId || sessionStorage.getItem("pip.roomId");
  
  if (!meetingRoot) {
    console.warn("[MeetingPortal] #meeting-root가 없습니다. index.html 확인하세요.");
    return null;
  }
  
  if (!savedRoomId) {
    console.warn("[MeetingPortal] roomId가 없습니다.");
    return null;
  }
  
  return createPortal(<MeetingPage portalRoomId={savedRoomId} />, meetingRoot);
};

export default MeetingPortal;