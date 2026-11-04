import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Recover } from "./Recover";
import { reportUncaught } from "./errors";
import "./styles/tokens.css";

reportUncaught("island");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Recover where="island">
      <App />
    </Recover>
  </React.StrictMode>,
);
