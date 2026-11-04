import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./SettingsApp";
import { Recover } from "../Recover";
import { reportUncaught } from "../errors";
import "../styles/tokens.css";
import "./settings.css";

reportUncaught("settings");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Recover where="settings">
      <SettingsApp />
    </Recover>
  </React.StrictMode>,
);
