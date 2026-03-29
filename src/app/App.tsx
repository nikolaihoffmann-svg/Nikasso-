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
      <div className="appBgGlow appBgGlow1" />
      <div className="appBgGlow appBgGlow2" />

      <header className="appHeader">
        <div className="appHeaderTop appHeaderTopTight">
          <Logo />

          <div className="headerActions">
            <button className="btn dataBtn" type="button" onClick={() => setTab("data")}>
              ⚙️ Data
            </button>
          </div>
        </div>

        <nav className="tabs tabsCompact">
          <button className={tab === "oversikt" ? "tab active" : "tab"} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={tab === "varer" ? "tab active" : "tab"} onClick={() => setTab("varer")} type="button">
            Varer
          </button>
          <button className={tab === "innkjop" ? "tab active" : "tab"} onClick={() => setTab("innkjop")} type="button">
            Innkjøp
          </button>
          <button className={tab === "salg" ? "tab active" : "tab"} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={tab === "kunder" ? "tab active" : "tab"} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
          <button className={tab === "gjeld" ? "tab active" : "tab"} onClick={() => setTab("gjeld")} type="button">
            Gjeld
          </button>
        </nav>
      </header>

      <main className="pageWrap">{content}</main>
    </div>
  );
}

export default App;
