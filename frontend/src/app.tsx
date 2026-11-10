import { useEffect, useState } from "react";
import { navigate, useRoute } from "./router";
import { TabBar } from "./components/tabbar";
import { Toasts } from "./components/ui";
import { FirstGuide } from "./components/parts";
import { MapPage, useToday } from "./pages/Map";
import { PlanPage } from "./pages/Plan";
import { PersonPage, PlacePage } from "./pages/Place";
import { SettingsPage } from "./pages/Settings";
import { ShopPage } from "./pages/Shop";
import { WalletPage } from "./pages/Wallet";
import { CameraPage } from "./pages/Camera";
import { ReceiptPage } from "./pages/Receipt";
import { GiftsPage, SurveyPage } from "./pages/Survey";
import { PhotoPage, PrintPage } from "./pages/Photo";
import { MemoriesPage } from "./pages/Memories";
import { BookPage } from "./pages/Book";
import { AdminPage } from "./pages/Admin";
import { PresentPage } from "./pages/Present";

function NotFound() {
  return (
    <div className="page">
      <h1>ページが見つかりません</h1>
      <button className="btn" onClick={() => navigate("/")}>マップへ</button>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const today = useToday();
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; path?: string };
      if (d?.type !== "hitomeguri") return;
      if (d.path) navigate(d.path);
      today.reload();
      setEpoch((n) => n + 1);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [today]);

  const head = route.parts[0] ?? "";
  if (head === "present") return <div className="app"><PresentPage /><Toasts /></div>;
  if (head === "admin") return <div className="app"><AdminPage /><Toasts /></div>;

  let page: JSX.Element;
  let tab = "map";
  switch (head) {
    case "":
      page = <MapPage data={today.data} reload={today.reload} />;
      break;
    case "plan":
      tab = "plan";
      page = <PlanPage onChanged={today.reload} />;
      break;
    case "place":
      page = <PlacePage id={Number(route.parts[1])} onChanged={today.reload} />;
      break;
    case "people":
      tab = "book";
      page = <PersonPage id={Number(route.parts[1])} onChanged={today.reload} />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    case "shop":
      tab = "wallet";
      page = <ShopPage id={Number(route.parts[1])} onChanged={today.reload} />;
      break;
    case "receipt":
      page = <ReceiptPage placeId={Number(route.parts[1])} onChanged={today.reload} />;
      break;
    case "camera":
      page = <CameraPage kind={route.parts[1]} id={Number(route.parts[2])} />;
      break;
    case "photo":
      page = <PhotoPage id={Number(route.parts[1])} />;
      break;
    case "print":
      page = <PrintPage id={Number(route.parts[1])} />;
      break;
    case "memories":
      tab = "memories";
      page = <MemoriesPage sub={route.parts[1] ?? ""} day={route.parts[2]} onChanged={today.reload} />;
      break;
    case "survey":
      tab = "memories";
      page = <SurveyPage />;
      break;
    case "gifts":
      tab = "memories";
      page = <GiftsPage />;
      break;
    case "book":
      tab = "book";
      page = <BookPage />;
      break;
    case "wallet":
      tab = "wallet";
      page = <WalletPage onChanged={today.reload} />;
      break;
    default:
      page = <NotFound />;
  }
  return (
    <div className="app">
      <div key={epoch}>{page}</div>
      <TabBar active={tab} letterBadge={!!today.data?.letter_ready} />
      <Toasts />
      <FirstGuide />
    </div>
  );
}
