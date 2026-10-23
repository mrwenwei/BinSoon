import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
// 各頁面的 pixel skin（day）與 night 對照：必須在 styles.css 之後、彼此順序固定。
import "./styles/skin-night.css";
import "./styles/skin-citizen.css";
import "./styles/skin-civic.css";
import "./styles/skin-crew.css";
import "./styles/skin-van.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
