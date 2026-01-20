import { useState } from "react";
import LMSHeader from "./LMSHeader";
import LMSSidebar from "./LMSSidebar";
import Dashboard from "./dashboard/Dashboard";
import Attendance from "./attendance/Attendance";
import Assignment from "./assignment/Assignment";
import Board from "./board/Board";
import Calender from "./calendar/Calendar"


import "./LMSSubject.css";

const LMSSubject = () => {
    const [activeMenu, setActiveMenu] = useState("dashboard");

    return (
        <>
            <LMSHeader />

            <div className="lms-subject-layout">
                <LMSSidebar
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
                />

                <main className="subject-content">
                    {activeMenu === "dashboard" && <Dashboard setActiveMenu={setActiveMenu} />}
                    {activeMenu === "attendance" && <Attendance setActiveMenu={setActiveMenu} />}
                    {activeMenu === "assignment" && <Assignment setActiveMenu={setActiveMenu} />}
                    {activeMenu === "board" && <Board setActiveMenu={setActiveMenu} />}
                    {activeMenu === "calender" && <Calender setActiveMenu={setActiveMenu} />}
                </main>
            </div>
        </>
    );
};

export default LMSSubject;
