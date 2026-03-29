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

type Tab =
  | "oversikt"
  | "varer"
  | "innkjop"
  | "salg"
  | "kunder"
  | "gjeld"
  | "data";

export default function App() {
  const [tab, setTab] = useState<Tab>("oversikt");

  useEffect(() => {
    ensureSeedData();
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const content = useMemo(() => {
    switch (tab) {
      case "varer": return <Varer />;
      case "innkjop": return <Innkjop />;
      case "salg": return <Salg />;
      case "kunder": return <Kunder />;
      case "gjeld": return <Gjeld />;
      case "data": return <DataPage />;
      default: return <Oversikt />;
    }
  }, [tab]);

  return (
    <div className="app">
      <header className="header">
        <Logo />

        <button className="dataBtn" onClick={() => setTab("data")}>
          ⚙️
        </button>
      </header>

      <nav className="nav">
        {["oversikt","varer","innkjop","salg","kunder","gjeld"].map((t) => (
          <button
            key={t}
            className={tab === t ? "navBtn active" : "navBtn"}
            onClick={() => setTab(t as Tab)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="content">{content}</main>
    </div>
  );
}
