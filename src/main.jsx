import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SnapshotProvider } from "./context/SnapshotContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SnapshotProvider>
        <App />
      </SnapshotProvider>
    </BrowserRouter>
  </React.StrictMode>
);
