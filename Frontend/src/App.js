import { BrowserRouter, Routes, Route } from "react-router-dom";
import RoomPage from "./roomcategorypage/RoomPage";
import Auth from "./auth/Auth";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/roompage" element={<RoomPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
