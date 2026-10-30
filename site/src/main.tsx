import React from "react";
import { inject } from "@vercel/analytics";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/urbanist";
import "./demo/island.css";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root") as HTMLElement;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Visits counted by Vercel Web Analytics: no cookies, nothing personal kept.
inject();

// The built page arrives already rendered (scripts/prerender.mjs): take it over.
if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, app);
else ReactDOM.createRoot(root).render(app);
