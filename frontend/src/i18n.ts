/** 文言。やさしい日本語は easy 側。足りないキーは標準の文言を使う。 */
import { usePrefs } from "./settings";

const STD = {
  tab_plan: "計画",
  tab_map: "マップ",
  tab_memories: "思い出",
  tab_wallet: "クーポン",
  plan_title: "行きたい場所をえらぶ",
  plan_step1: "行きたい場所をえらぶ",
  plan_step2: "日を決める",
  want_button: "行きたい",
  want_done: "行きたいに入れた",
  people_here: "ここにいる人",
  map_title: "きょうのマップ",
  met_button: "会えた",
  met_done: "会えました",
  ar_photo: "いっしょに AR フォト",
  receipt_button: "レシートを登録",
  seed_bud: "つぼみ",
  seed_flower: "花がさいた",
  fulfill_hint: "1.2 秒長押しで約束を果たす",
  settings: "設定",
  font_size: "文字の大きさ",
  theme: "配色",
  easy_ja: "やさしい日本語",
  standard: "標準",
  contrast: "はっきり",
  voices: "旅人の声",
  promises: "季節の約束",
  memories_letters: "おもいで便",
  memories_book: "ひとめぐり帖",
  wallet_points: "ポイント",
  draw: "抽選する",
  coupons: "クーポン",
  receipts: "レシート",
  back: "もどる",
  loading: "読み込み中…",
  other_places: "ほかの場所",
  going_places: "行く場所",
};

const EASY: Partial<typeof STD> = {
  plan_title: "行きたい ところを えらぶ",
  plan_step1: "行きたい ところを えらぶ",
  plan_step2: "日を きめる",
  want_done: "行きたいに 入れました",
  people_here: "ここに いる 人",
  map_title: "きょうの マップ",
  met_done: "会いました",
  ar_photo: "いっしょに しゃしんを とる",
  receipt_button: "レシートを 入れる",
  seed_flower: "花が さいた",
  fulfill_hint: "ながく おして やくそくを はたす",
  font_size: "字の 大きさ",
  theme: "色",
  easy_ja: "やさしい 日本語",
  voices: "みんなの 声",
  promises: "きせつの やくそく",
  draw: "くじを ひく",
  loading: "よみこみ中…",
  other_places: "ほかの ところ",
  going_places: "行く ところ",
};

export type TKey = keyof typeof STD;

export function useT() {
  const { easy } = usePrefs();
  return (k: TKey): string => (easy && EASY[k]) || STD[k];
}
