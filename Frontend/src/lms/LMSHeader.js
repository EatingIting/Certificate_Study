import "./LMSHeader.css";
import { Bell, MessageCircle, User } from "lucide-react";

export default function Header() {
    return (
        <header className="header">
            <div className="header-left">
                <div className="logo-box" />
                <span className="title">스터디룸</span>
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
