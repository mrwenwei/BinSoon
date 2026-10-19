import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../src/styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
