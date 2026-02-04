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
                    <span className="title">
                        {roomLoading ? "로딩 중..." : roomTitle || "undefined"}
                    </span>
                    <p>{loading ? "로딩 중..." : displayName ? `${displayName}님 환영합니다!` : "사용자님 환영합니다!"}</p>
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
