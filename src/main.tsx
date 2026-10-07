import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { setTransport } from "@/api/client";
import { httpTransport } from "@/api/transport";
import { API_MODE } from "@/config";
import { getMockServer } from "@/mock/instance";

import { App } from "./App";
import "./index.css";

// The only place that decides where requests go. Everything else calls `api.*` and cannot tell the difference.
setTransport(API_MODE === "mock" ? getMockServer().transport : httpTransport);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
