import "./LMSHeader.css";
import { Bell, MessageCircle, User } from "lucide-react";

export default function Header() {
    return (
        <header className="header">
            <div className="header-left">
                <div className="logo-box" />

                <div className="header-text">
                    <span className="title">정보처리기사 스터디룸</span>
                    <p>000님 환영합니다!</p>
                </div>
            </div>


            <div className="header-right">
                <MessageCircle size={18} />
                <Bell size={18} />
                <div className="profile">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
