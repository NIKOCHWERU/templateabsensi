import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.js";
import App from "./App.js";
import "./index.css";

// Dynamic Theme Injection from environment variables (.env)
const injectTheme = () => {
  const root = document.documentElement;

  const primary = import.meta.env.VITE_THEME_PRIMARY_HSL;
  const secondary = import.meta.env.VITE_THEME_SECONDARY_HSL;
  const accent = import.meta.env.VITE_THEME_ACCENT_HSL;
  const background = import.meta.env.VITE_THEME_BACKGROUND_HSL;
  const sidebarAccent = import.meta.env.VITE_THEME_SIDEBAR_ACCENT_HSL;

  if (primary) root.style.setProperty("--primary", primary);
  if (secondary) root.style.setProperty("--secondary", secondary);
  if (accent) root.style.setProperty("--accent", accent);
  if (background) root.style.setProperty("--background", background);
  if (sidebarAccent) root.style.setProperty("--sidebar-accent", sidebarAccent);
  
  // Set matching ring focus color
  if (primary) root.style.setProperty("--ring", primary);
};

injectTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
