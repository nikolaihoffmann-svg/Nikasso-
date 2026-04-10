import { useEffect, useState } from "react";
import "./styles.css";
import {
  ensureSeedData,
  hasAppPassword,
  verifyAppPassword,
} from "./storage";
import Logo from "./Logo";
import LockScreen from "../components/LockScreen";
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

const navItems: Array<{ key: Tab; label: string }> = [
  { key: "oversikt", label: "Oversikt" },
  { key: "varer", label: "Varer" },
  { key: "innkjop", label: "Innkjøp" },
  { key: "salg", label: "Salg" },
  { key: "kunder", label: "Kunder" },
  { key: "gjeld", label: "Gjeld" },
];

const SESSION_UNLOCK_KEY = "nikasso_unlocked_session_v1";

export default function App() {
  const [tab, setTab] = useState<Tab>("oversikt");
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    ensureSeedData();
    document.documentElement.setAttribute("data-theme", "dark");

    const splashTimer = window.setTimeout(() => {
      const needsPassword = hasAppPassword();
      const alreadyUnlocked = sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";

      if (needsPassword && !alreadyUnlocked) {
        setLocked(true);
      } else {
        setLocked(false);
      }

      setBooting(false);
    }, 1100);

    return () => window.clearTimeout(splashTimer);
  }, []);

  function handleUnlock(pin: string): boolean {
    const ok = verifyAppPassword(pin);
    if (!ok) return false;

    sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
    setLocked(false);
    return true;
  }

  let content;

  switch (tab) {
    case "oversikt":
      content = <Oversikt />;
      break;
    case "varer":
      content = <Varer />;
      break;
    case "innkjop":
      content = <Innkjop />;
      break;
    case "salg":
      content = <Salg />;
      break;
    case "kunder":
      content = <Kunder />;
      break;
    case "gjeld":
      content = <Gjeld />;
      break;
    case "data":
    default:
      content = <DataPage />;
      break;
  }

  if (booting) {
    return (
      <div className="splashScreen">
        <div className="splashGlow splashGlowBlue" />
        <div className="splashGlow splashGlowGold" />

        <div className="splashInner">
          <div className="splashLogoShell">
            <div className="splashLogoBadge">
              <span className="splashLogoN">N</span>
              <span className="splashLogoPlus">+</span>
            </div>
          </div>

          <div className="splashTitleWrap">
            <div className="splashTitle">Nikasso+</div>
            <div className="splashSub">Laster appen…</div>
          </div>

          <div className="splashLoader">
            <div className="splashLoaderBar" />
          </div>
        </div>
      </div>
    );
  }

  if (locked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="app">
      <div className="bgGlow bgGlowBlue" />
      <div className="bgGlow bgGlowGold" />

      <header className="header">
        <div className="headerTop">
          <Logo />

          <button
            className="iconBtn"
            type="button"
            onClick={() => setTab("data")}
            aria-label="Data"
            title="Data"
          >
            ⚙️
          </button>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "navBtn active" : "navBtn"}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">{content}</main>
    </div>
  );
}
