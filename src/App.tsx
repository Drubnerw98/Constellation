import { Navigate, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Demo } from "./routes/Demo";
import { Home } from "./routes/Home";
import { Landing } from "./routes/Landing";

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <Home />
            </SignedIn>
            <SignedOut>
              <Landing />
            </SignedOut>
          </>
        }
      />
      <Route path="/demo" element={<Demo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
