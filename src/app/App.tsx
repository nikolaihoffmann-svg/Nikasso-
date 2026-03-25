import React, { useMemo, useState } from "react";

import Oversikt from "../pages/Oversikt";
import Varer from "../pages/Varer";
import Innkjop from "../pages/Innkjop";
import Salg from "../pages/Salg";
import Kunder from "../pages/Kunder";
import Gjeld from "../pages/Gjeld";
import Backup from "../pages/Backup";

type TabKey =
  | "oversikt"
  | "varer"
  | "innkjop"
  | "salg"
  | "kunder"
  | "gjeld"
  | "backup";

export function App() {
  const [tab, setTab] = useState<TabKey>("oversikt");

  const content = useMemo(() => {
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "innkjop") return <Innkjop />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    if (tab === "gjeld") return <Gjeld />;
    return <Backup />;
  }, [tab]);

  return (
    <div className="container">
      <header className="header">
        <div className="headerTop">
          <div className="h1">NIKASSO</div>

          <div className="btnRow">
            <button className="btn" onClick={() => setTab("backup")} type="button">
              ⚙️ Data
            </button>
          </div>
        </div>

        <nav className="tabs">
          <button className={tab === "oversikt" ? "active tab" : "tab"} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={tab === "varer" ? "active tab" : "tab"} onClick={() => setTab("varer")} type="button">
            Varer
          </button>
          <button className={tab === "innkjop" ? "active tab" : "tab"} onClick={() => setTab("innkjop")} type="button">
            Innkjøp
          </button>
          <button className={tab === "salg" ? "active tab" : "tab"} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={tab === "kunder" ? "active tab" : "tab"} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
          <button className={tab === "gjeld" ? "active tab" : "tab"} onClick={() => setTab("gjeld")} type="button">
            Gjeld
          </button>
        </nav>
      </header>

      {content}
    </div>
  );
}

export default App;
