import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@radix-ui/themes/styles.css";
import "./i18n";
import { ThemeProvider } from "./ThemeContext";
import { ThemeWrapper } from "./ThemeWrapper";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemeWrapper>
        <App />
      </ThemeWrapper>
    </ThemeProvider>
  </React.StrictMode>,
);
