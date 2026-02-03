import "./LMSHeader.css";
import {Bell, MessageCircle, User, UserCircle, Users} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Header() {
    const navigate = useNavigate();

    return (
        <header className="lms-header">
            <div className="lms-header-left">
                <div className="logo-box" />

                <div className="lms-header-text">
                    <span className="title">정보처리기사 스터디룸</span>
                    <p>000님 환영합니다!</p>
                </div>
            </div>


            <div className="lms-header-right">
                <Users
                    size={18}
                    className="icon-button"
                    onClick={() => navigate("/room")}
                />
                <MessageCircle size={18} />
                <Bell size={18} />
                <div className="profile">
                    <User size={18} />
                </div>
            </div>
        </header>
    );
}
