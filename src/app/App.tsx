import React, { useMemo, useState } from "react";

import { Oversikt } from "../pages/Oversikt";
import { Salg } from "../pages/Salg";
import { Varer } from "../pages/Varer";
import { Kunder } from "../pages/Kunder";
import { Gjeld } from "../pages/Gjeld";

type Tab = "oversikt" | "salg" | "varer" | "kunder" | "gjeld";

export function App() {
  const [tab, setTab] = useState<Tab>("oversikt");

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

  return (
    <>
      <div className="container">
        <div className="header">
          <div>
            <div className="h1">{title}</div>
            <div className="sub">Privat • Lokal lagring i nettleseren</div>
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
