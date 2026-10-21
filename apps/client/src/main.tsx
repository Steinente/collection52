import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./styles.css";
import { App } from "./App";
import { UpdatePrompt } from "./UpdatePrompt";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
);
