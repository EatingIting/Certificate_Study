import { BrowserRouter, Routes, Route } from "react-router-dom";
import MeetingPage from "./webrtc/MeetingPage";
import LMSMain from "./lms/LMSMain";
import LMSSubject from "./lms/LMSSubject"

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/meeting" element={<MeetingPage />} />
          <Route path="/lmsMain" element={<LMSMain />} />
          <Route path="/lms/:id" element={<LMSSubject/>} />
        </Routes>
      </BrowserRouter>
  );
}
export default App;