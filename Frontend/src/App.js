import { BrowserRouter, Routes, Route } from "react-router-dom";
import MeetingPage from "./webrtc/MeetingPage";
import LMSMain from "./lms/LMSMain";
import ClassRoom from "./lms/ClassRoom"; // 부모 컴포넌트로 관리됌

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LMSMain />} />
          <Route path="/lmsMain" element={<LMSMain />} />
          <Route path="/lms/:id" element={<ClassRoom />} />
          <Route path="/meeting" element={<MeetingPage />} />
        </Routes>
      </BrowserRouter>
  );
}
export default App;