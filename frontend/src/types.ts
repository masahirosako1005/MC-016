export type Forecast = { status: "open" | "closing_soon" | "not_yet" | "closed_now" | "closed_today"; label: string; reason: string; hours: string };
export type Relationship = { days: number; stage: "none" | "first" | "again" | "regular"; label: string };
export type Seed = {
  id: number; season: string; season_label: string; title: string; note: string; given_on: string;
  state: "bud" | "flower"; can_fulfill: boolean; hint: string;
};
export type PersonItem = {
  person: { id: number; name: string; intro: string; svg_key: string };
  shop: { id: number; name: string; area: string; category: string; spot_id: number; svg_key: string };
  forecast: Forecast;
  event: { id: number; title: string; note: string; label: string } | null;
  met_today: boolean;
  relationship: Relationship;
  seed: Seed | null;
  in_plan: boolean;
};
export type SpotItem = { id: number; name: string; area: string; svg_key: string; checked_in_today: boolean; in_plan: boolean };
export type UnmannedShop = { id: number; name: string; area: string; category: string; svg_key: string; forecast: Forecast; in_plan: boolean };
export type TodayView = {
  now: string; date: string; weekday: string; season: string; season_label: string; plan_today: boolean;
  people: PersonItem[]; spots: SpotItem[]; unmanned_shops: UnmannedShop[]; activity_today: boolean; letter_ready: boolean;
};
