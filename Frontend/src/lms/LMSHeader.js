import "./LMSHeader.css";
import { Bell, MessageCircle, User } from "lucide-react";
import { useLMS } from "./LMSContext";

export default function Header() {
    const { displayName, loading, roomTitle, roomLoading } = useLMS();

    return (
        <header className="lms-header">
            <div className="lms-header-left">
                <div className="logo-box" />

                <div className="lms-header-text">
                    <span className="title">
                        {roomLoading ? "로딩 중..." : roomTitle || "정보처리기사 스터디룸"}
                    </span>
                    <p>{loading ? "로딩 중..." : displayName ? `${displayName}님 환영합니다!` : "사용자님 환영합니다!"}</p>
                </div>
            </div>


            <div className="lms-header-right">
                <MessageCircle size={18} />
                <Bell size={18} />
                <div className="profile">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
