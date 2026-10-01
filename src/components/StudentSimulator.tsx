"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  PATTERN_LABELS,
  PatternId,
  PriceData,
  SafetyPackChoice,
  calcSchoolPrice,
} from "@/lib/pricing";

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

const PATTERN_ORDER: PatternId[] = ["fast", "normal"];

export default function StudentSimulator({ data }: { data: PriceData }) {
  const [pattern, setPattern] = useState<PatternId>("normal");
  const [attribute, setAttribute] = useState<Attribute>("general");
  const [night, setNight] = useState(false);
  const [safetyPackEnabled, setSafetyPackEnabled] = useState(false);
  const [overLessonCount, setOverLessonCount] = useState(data.anxietyScenario.assumedOverLessonCount);
  // 紹介割引は学校ごとに内容が違うので、選択も学校ごとに独立して持つ（school.id -> 選んだ紹介割引のid）。
  const [referralChoices, setReferralChoices] = useState<Record<string, string | null>>({});

  const safetyPack: SafetyPackChoice = useMemo(
    () => ({ enabled: safetyPackEnabled, overLessonCount }),
    [safetyPackEnabled, overLessonCount]
  );

  const rows = useMemo(() => {
    const results = data.schools.map((school) => {
      const referralId = referralChoices[school.id] ?? null;
      return {
        school,
        at: calcSchoolPrice(school, pattern, "AT", attribute, night, safetyPack, data.anxietyScenario, referralId),
        mt: calcSchoolPrice(school, pattern, "MT", attribute, night, safetyPack, data.anxietyScenario, referralId),
      };
    });

    const minAt = Math.min(...results.map((r) => r.at.total));
    const minMt = Math.min(...results.map((r) => r.mt.total));

    return results
      .map((r) => ({ ...r, isCheapestAt: r.at.total === minAt, isCheapestMt: r.mt.total === minMt }))
      .sort((a, b) => Number(b.school.isTarget) - Number(a.school.isTarget));
  }, [data, pattern, attribute, night, safetyPack, referralChoices]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl bg-emerald-900 px-6 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-emerald-300">
          {data.schools.find((s) => s.isTarget)?.name ?? ""}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">料金シミュレーター</h1>
        <p className="mt-2 text-sm text-emerald-100">
          あなたの通い方に合わせて、近隣校との料金を比較できます。
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-semibold text-slate-700">1. 通い方を選ぶ</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PATTERN_ORDER.map((id) => {
            const label = PATTERN_LABELS[id];
            const active = pattern === id;
            return (
              <button
                key={id}
                onClick={() => setPattern(id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                <p className="font-semibold text-slate-900">{label.title}</p>
                <p className="mt-1 text-xs text-slate-500">{label.subtitle}</p>
              </button>
            );
          })}
        </div>

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">2. 安心パックをつけますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          技能教習が延びたり、検定に落ちてしまった場合の追加費用も見込んだ金額で比較したいときに選んでください。
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(
              [
                [false, "つけない"],
                [true, "つける"],
              ] as [boolean, string][]
            ).map(([value, label]) => (
              <button
                key={String(value)}
                onClick={() => setSafetyPackEnabled(value)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  safetyPackEnabled === value
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {safetyPackEnabled && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              技能教習は何時限まで追加を見込みますか？
              <select
                value={overLessonCount}
                onChange={(e) => setOverLessonCount(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {Array.from({ length: data.anxietyScenario.overLessonChoiceMax + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n}時限
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">3. あなたについて教えてください</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(
              [
                ["general", "一般"],
                ["student", "学生"],
              ] as [Attribute, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setAttribute(value)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  attribute === value
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={night}
              onChange={(e) => setNight(e.target.checked)}
              className="h-4 w-4 accent-emerald-700"
            />
            夜間コースを希望する
          </label>
        </div>

        {data.schools.some((s) => s.referralDiscounts.length > 0) && (
          <>
            <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">4. 紹介者はいますか？</p>
            <div className="flex flex-col gap-3">
              {data.schools
                .filter((s) => s.referralDiscounts.length > 0)
                .map((school) => (
                  <div key={school.id}>
                    <p className="mb-1 text-xs font-semibold text-slate-500">{school.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setReferralChoices((prev) => ({ ...prev, [school.id]: null }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          !referralChoices[school.id]
                            ? "border-slate-500 bg-slate-100 text-slate-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        利用しない
                      </button>
                      {school.referralDiscounts.map((referral) => (
                        <button
                          key={referral.id}
                          onClick={() => setReferralChoices((prev) => ({ ...prev, [school.id]: referral.id }))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            referralChoices[school.id] === referral.id
                              ? "border-emerald-700 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                          }`}
                        >
                          {referral.name || "（名称未設定）"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {rows.map(({ school, at, mt, isCheapestAt, isCheapestMt }) => (
          <article
            key={school.id}
            className={`rounded-2xl p-5 shadow-sm ring-1 transition ${
              school.isTarget
                ? "bg-emerald-50 ring-2 ring-emerald-700"
                : "bg-white ring-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {school.isTarget && (
                <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
                  当校
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900">{school.name}</h2>
              {school.isPlaceholder && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  仮データ
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PriceBlock label="AT（オートマ）" total={at.total} isCheapest={isCheapestAt} breakdown={at.breakdown} />
              <PriceBlock label="MT（マニュアル）" total={mt.total} isCheapest={isCheapestMt} breakdown={mt.breakdown} />
            </div>
          </article>
        ))}
      </section>

      <p className="text-center text-xs text-slate-400">
        最終更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}
      </p>
    </main>
  );
}

function PriceBlock({
  label,
  total,
  isCheapest,
  breakdown,
}: {
  label: string;
  total: number;
  isCheapest: boolean;
  breakdown: { label: string; amount: number }[];
}) {
  return (
    <div className="rounded-xl bg-white/70 p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {isCheapest && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
            最安
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{formatYen(total)}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-emerald-700">内訳を見る</summary>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {breakdown.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.label}</span>
              <span>{item.amount < 0 ? "" : "+"}{formatYen(item.amount)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
