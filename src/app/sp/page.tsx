import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import { getData } from "@/lib/store";
import MobileSimulator from "@/components/MobileSimulator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "あたご自動車学校 料金シミュレーター（スマホ版）",
};

// スマホ版だけで使う丸みのある和文フォント。日本語のサブセットは無いため preload はしない。
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  preload: false,
});

const ANONYMOUS_LABELS = ["A", "B", "C", "D", "E"];

// 生徒用ページ（/student）と同じデータ・同じ匿名化ルールを使う。管理画面の変更はこちらにもそのまま反映される。
export default async function MobilePage() {
  const data = await getData();

  let counter = 0;
  const schools = data.schools.map((school) =>
    school.hideName
      ? { ...school, name: `近隣${ANONYMOUS_LABELS[counter++] ?? counter}校` }
      : school
  );

  return (
    <div className={`${zenKaku.className} flex flex-1 flex-col`}>
      <MobileSimulator data={{ ...data, schools }} />
    </div>
  );
}
