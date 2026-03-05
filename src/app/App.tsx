import React, { useEffect, useMemo, useState } from "react";

import { Oversikt } from "../pages/Oversikt";
import { Salg } from "../pages/Salg";
import { Varer } from "../pages/Varer";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type Tab = "oversikt" | "salg" | "varer" | "kunder" | "gjeld";
type Theme = "dark" | "light";

const THEME_KEY = "theme";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;

  // default: dark (kan endres om du vil)
  return "dark";
}

export function App() {
  const [tab, setTab] = useState<Tab>("oversikt");
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);

    // Diskré og robust: sett data-attributt på <html>
    // CSS kan da styre farger via [data-theme="dark"] / [data-theme="light"]
    document.documentElement.setAttribute("data-theme", theme);
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
          <div>
            <div className="h1">{title}</div>

            <div
              className="sub"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <span>Privat • Lokal lagring i nettleseren</span>

              <button
                type="button"
                onClick={toggleTheme}
                className="tab"
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  fontSize: 14,
                  lineHeight: 1,
                }}
                aria-label={
                  theme === "dark"
                    ? "Bytt til lys modus"
                    : "Bytt til mørk modus"
                }
                title={
                  theme === "dark"
                    ? "Bytt til lys modus"
                    : "Bytt til mørk modus"
                }
              >
                {theme === "dark" ? "☀️ Lys" : "🌙 Mørk"}
              </button>
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
