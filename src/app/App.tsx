import { useEffect, useMemo, useState } from "react";
import { ensureSeedData } from "./storage";
import Logo from "./Logo";

import Oversikt from "../pages/Oversikt";
import Varer from "../pages/Varer";
import Innkjop from "../pages/Innkjop";
import Salg from "../pages/Salg";
import Kunder from "../pages/Kunder";
import Gjeld from "../pages/Gjeld";
import DataPage from "../pages/Data";

type TabKey =
  | "oversikt"
  | "varer"
  | "innkjop"
  | "salg"
  | "kunder"
  | "gjeld"
  | "data";

const NAV_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "oversikt", label: "Oversikt" },
  { key: "varer", label: "Varer" },
  { key: "innkjop", label: "Innkjøp" },
  { key: "salg", label: "Salg" },
  { key: "kunder", label: "Kunder" },
  { key: "gjeld", label: "Gjeld" },
];

export function App() {
  const [tab, setTab] = useState<TabKey>("oversikt");

  useEffect(() => {
    ensureSeedData();
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const content = useMemo(() => {
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "innkjop") return <Innkjop />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    if (tab === "gjeld") return <Gjeld />;
    return <DataPage />;
  }, [tab]);

  return (
    <div className="appShell">
      <div className="bgGlow bgGlowBlue" />
      <div className="bgGlow bgGlowGold" />

      <header className="topbar">
        <div className="topbarRow">
          <Logo />

          <button className="utilityBtn" type="button" onClick={() => setTab("data")}>
            <span aria-hidden="true">⚙️</span>
            <span>Data</span>
          </button>
        </div>

        <nav className="navPills" aria-label="Hovednavigasjon">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={tab === item.key ? "navPill active" : "navPill"}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="pageWrap">{content}</main>
    </div>
  );
}

export default App;
