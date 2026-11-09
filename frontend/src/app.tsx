import { useRoute } from "./router";
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

function Placeholder({ name }: { name: string }) {
  return (
    <div className="page">
      <h1>{name}</h1>
      <p className="muted">準備中</p>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const today = useToday();
  const head = route.parts[0] ?? "";
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
    case "admin":
      return (
        <div className="app">
          <AdminPage />
          <Toasts />
        </div>
      );
    default:
      page = <Placeholder name={head} />;
  }
  return (
    <div className="app">
      {page}
      <TabBar active={tab} letterBadge={!!today.data?.letter_ready} />
      <Toasts />
    </div>
  );
}
