import { useEffect, useState } from "react";
import { navigate, useRoute } from "./router";
import { TabBar } from "./components/tabbar";
import { Toasts } from "./components/ui";
import { TodayPage, useToday } from "./pages/Today";
import { SettingsPage } from "./pages/Settings";
import { ExplorePage, PlacePage, PlanPage } from "./pages/Explore";
import { ShopPage } from "./pages/Shop";
import { WalletPage } from "./pages/Wallet";
import { CameraPage } from "./pages/Camera";
import { PhotoPage, PrintPage } from "./pages/Photo";
import { MemoriesPage } from "./pages/Memories";
import { AdminPage } from "./pages/Admin";
import { PresentPage } from "./pages/Present";

function NotFound() {
  return (
    <div className="page">
      <h1>ページが見つかりません</h1>
      <button className="btn" onClick={() => navigate("/")}>きょうへ</button>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const today = useToday();
  const [epoch, setEpoch] = useState(0);

  // present（親）からの合図: 画面を切り替えて読み直す。同一オリジンだけ受け付ける。
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
  if (head === "present") {
    return (
      <div className="app">
        <PresentPage />
        <Toasts />
      </div>
    );
  }
  if (head === "admin") {
    return (
      <div className="app">
        <AdminPage />
        <Toasts />
      </div>
    );
  }
  let page: JSX.Element;
  let tab = "today";
  switch (head) {
    case "":
      page = <TodayPage data={today.data} reload={today.reload} />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    case "explore":
      tab = "explore";
      page = <ExplorePage />;
      break;
    case "place":
      tab = "explore";
      page = <PlacePage kind={route.parts[1]} id={Number(route.parts[2])} />;
      break;
    case "plan":
      tab = "explore";
      page = <PlanPage />;
      break;
    case "shop":
      page = <ShopPage id={Number(route.parts[1])} onChanged={today.reload} />;
      break;
    case "camera":
      page = <CameraPage kind={route.parts[1]} id={Number(route.parts[2])} />;
      break;
    case "photo":
      tab = "memories";
      page = <PhotoPage id={Number(route.parts[1])} />;
      break;
    case "print":
      tab = "memories";
      page = <PrintPage id={Number(route.parts[1])} />;
      break;
    case "memories":
      tab = "memories";
      page = <MemoriesPage sub={route.parts[1] ?? "letters"} day={route.parts[2]} onChanged={today.reload} />;
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
    </div>
  );
}
