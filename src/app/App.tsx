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
    if (tab === "oversikt") return <Oversikt />;
    if (tab === "varer") return <Varer />;
    if (tab === "innkjop") return <Innkjop />;
    if (tab === "salg") return <Salg />;
    if (tab === "kunder") return <Kunder />;
    if (tab === "gjeld") return <Gjeld />;
    return <DataPage />;
  }, [tab]);

  return (
    <div className="app">
      <div className="bgGlow bgGlowBlue" />
      <div className="bgGlow bgGlowGold" />

      <header className="header">
        <div className="headerTop">
          <Logo />

          <button className="dataBtn" type="button" onClick={() => setTab("data")}>
            ⚙️
          </button>
        </div>

        <nav className="nav">
          <button className={tab === "oversikt" ? "navBtn active" : "navBtn"} onClick={() => setTab("oversikt")} type="button">
            Oversikt
          </button>
          <button className={tab === "varer" ? "navBtn active" : "navBtn"} onClick={() => setTab("varer")} type="button">
            Varer
          </button>
          <button className={tab === "innkjop" ? "navBtn active" : "navBtn"} onClick={() => setTab("innkjop")} type="button">
            Innkjøp
          </button>
          <button className={tab === "salg" ? "navBtn active" : "navBtn"} onClick={() => setTab("salg")} type="button">
            Salg
          </button>
          <button className={tab === "kunder" ? "navBtn active" : "navBtn"} onClick={() => setTab("kunder")} type="button">
            Kunder
          </button>
          <button className={tab === "gjeld" ? "navBtn active" : "navBtn"} onClick={() => setTab("gjeld")} type="button">
            Gjeld
          </button>
        </nav>
      </header>

      <main className="content">{content}</main>
    </div>
  );
}
