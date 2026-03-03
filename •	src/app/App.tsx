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
            <div className="sub">Privat • Lokal lagring • Backup via import/eksport</div>
          </div>
        </div>

        {tab === "oversikt" && <Oversikt />}
        {tab === "salg" && <Salg />}
        {tab === "varer" && <Varer />}
        {tab === "kunder" && <Kunder />}
        {tab === "gjeld" && <Gjeld />}
      </div>

      <nav className="bottomNav">
        <div className="bottomNavInner">
          <button className={`navBtn ${tab === "oversikt" ? "navBtnActive" : ""}`} onClick={() => setTab("oversikt")}>
            Oversikt
          </button>
          <button className={`navBtn ${tab === "salg" ? "navBtnActive" : ""}`} onClick={() => setTab("salg")}>
            Salg
          </button>
          <button className={`navBtn ${tab === "varer" ? "navBtnActive" : ""}`} onClick={() => setTab("varer")}>
            Varer
          </button>
          <button className={`navBtn ${tab === "kunder" ? "navBtnActive" : ""}`} onClick={() => setTab("kunder")}>
            Kunder
          </button>
          <button className={`navBtn ${tab === "gjeld" ? "navBtnActive" : ""}`} onClick={() => setTab("gjeld")}>
            Gjeld
          </button>
        </div>
      </nav>
    </>
  );
}
