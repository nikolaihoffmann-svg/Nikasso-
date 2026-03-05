// src/app/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { applyThemeToDom, getTheme, setTheme, Theme } from "./storage";
// ...andre imports

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? "Mørk" : "Lys";
  const themeIcon = theme === "dark" ? "🌙" : "☀️";

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Oversikt</h1>

        <div className="topbar">
          <div className="subtitle">Privat • Lokal lagring i nettleseren</div>

          <button
            type="button"
            className="themeBtn"
            onClick={toggleTheme}
            aria-label={`Bytt tema (nå: ${themeLabel})`}
            title="Bytt tema"
          >
            <span className="themeIcon">{themeIcon}</span>
            <span className="themeText">{themeLabel}</span>
          </button>
        </div>

        {/* tabs under */}
        {/* <Tabs .../> */}
      </header>

      {/* resten */}
    </div>
  );
}
