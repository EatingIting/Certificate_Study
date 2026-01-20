import { BrowserRouter, Routes, Route } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import Auth from "./auth/Auth";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/room/test" replace />} />
        <Route path="/room/:roomId" element={<MeetingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/roompage" element={<RoomPage />}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;