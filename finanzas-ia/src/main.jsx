import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import FinanzasIA from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FinanzasIA />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
