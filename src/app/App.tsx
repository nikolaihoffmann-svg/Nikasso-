import React, { useEffect, useMemo, useState } from "react";

import { Oversikt } from "../pages/Oversikt";
import { Salg } from "../pages/Salg";
import { Varer } from "../pages/Varer";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type Tab = "oversikt" | "salg" | "varer" | "kunder" | "gjeld";

const THEME_KEY = "nikasso.theme"; // "light" | "dark"

function getSavedTheme(): "light" | "dark" {
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "dark";
}

function applyTheme(theme: "light" | "dark") {
  // Krever at styles.css støtter [data-theme="light"] (og default/dark)
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

export function App() {
  const [tab, setTab] = useState<Tab>("oversikt");
  const [theme, setTheme] = useState<"light" | "dark>(() => getSavedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const title = useMemo(() => {
    switch (tab) {
      case "oversikt":
        return "Oversikt";
      case "salg":
        return "Salg";
      case "varer":
        return "Varer";
      case "kunder":
        return "Kunder";
      case "gjeld":
        return "Gjeld";
    }
  }, [tab]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <>
      <div className="container">
        <div className="header">
          <div className="headerTop">
            <div>
              <div className="h1">{title}</div>

              <div className="subRow">
                <div className="sub">Privat • Lokal lagring i nettleseren</div>

                {/* Diskré theme-toggle */}
                <button
                  type="button"
                  className="themeBtn"
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Bytt til lys modus" : "Bytt til mørk modus"}
                  aria-label="Bytt tema"
                >
                  {theme === "dark" ? "☾" : "☀︎"}
                </button>
              </div>
            </div>
          </div>

          <div className="tabs">
            <button
              className={tab === "oversikt" ? "tab active" : "tab"}
              onClick={() => setTab("oversikt")}
              type="button"
            >
              Oversikt
            </button>

            <button
              className={tab === "salg" ? "tab active" : "tab"}
              onClick={() => setTab("salg")}
              type="button"
            >
              Salg
            </button>

            <button
              className={tab === "varer" ? "tab active" : "tab"}
              onClick={() => setTab("varer")}
              type="button"
            >
              Varer
            </button>

            <button
              className={tab === "kunder" ? "tab active" : "tab"}
              onClick={() => setTab("kunder")}
              type="button"
            >
              Kunder
            </button>

            <button
              className={tab === "gjeld" ? "tab active" : "tab"}
              onClick={() => setTab("gjeld")}
              type="button"
            >
              Gjeld
            </button>
          </div>
        </div>

        {tab === "oversikt" && <Oversikt />}
        {tab === "salg" && <Salg />}
        {tab === "varer" && <Varer />}
        {tab === "kunder" && <Kunder />}
        {tab === "gjeld" && <Gjeld />}
      </div>
    </>
  );
}
