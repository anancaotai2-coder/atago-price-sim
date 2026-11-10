"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  GUARANTEE_COVERAGE,
  PATTERN_LABELS,
  SPEED_COURSE_DESCRIPTION,
  PatternId,
  PriceData,
  SafetyPackChoice,
  StudentInfo,
  calcSchoolPrice,
  isStudentNightFree,
} from "@/lib/pricing";

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

const PATTERN_ORDER: PatternId[] = ["fast", "normal"];

export default function StudentSimulator({ data }: { data: PriceData }) {
  const [pattern, setPattern] = useState<PatternId>("normal");
  const [attribute, setAttribute] = useState<Attribute>("general");
  const [studentCategory, setStudentCategory] = useState<"university" | "highschool">("university");
  // 空文字は「その他の学校」（通常の学生割引を使う）。
  const [studentSchoolId, setStudentSchoolId] = useState("");
  const [night, setNight] = useState(false);
  const [safetyPackEnabled, setSafetyPackEnabled] = useState(false);
  // 安心保証コースの年齢区分（GuaranteeTier.id）。空文字は未選択、"over-70" は71歳以上（対象外）。
  const [guaranteeAge, setGuaranteeAge] = useState("");
  // 紹介の種類（ReferralType.id）。null は紹介者なし。
  const [referralTypeId, setReferralTypeId] = useState<string | null>(null);

  // 高校生は安心保証コースの対象外。
  const isHighSchool = attribute === "student" && studentCategory === "highschool";
  const safetyPack: SafetyPackChoice = useMemo(() => {
    const tier = data.guaranteeTiers.find((t) => t.id === guaranteeAge) ?? null;
    return { enabled: safetyPackEnabled && !isHighSchool && !!tier, tier };
  }, [data, safetyPackEnabled, isHighSchool, guaranteeAge]);

  const student: StudentInfo = useMemo(() => {
    const found =
      attribute === "student" && studentCategory === "university"
        ? data.studentSchools.find((s) => s.id === studentSchoolId)
        : undefined;
    return found ? { schoolId: found.id, schoolName: found.name } : { schoolId: null, schoolName: null };
  }, [data, attribute, studentCategory, studentSchoolId]);

  const target = data.schools.find((s) => s.isTarget);
  const nightFree = !!target && attribute === "student" && isStudentNightFree(target, "student");

  const rows = useMemo(() => {
    const results = data.schools.map((school) => {
      const referral = data.referralTypes.find((r) => r.id === referralTypeId) ?? null;
      return {
        school,
        at: calcSchoolPrice(school, pattern, "AT", attribute, night, safetyPack, data.anxietyScenario, referral, student),
        mt: calcSchoolPrice(school, pattern, "MT", attribute, night, safetyPack, data.anxietyScenario, referral, student),
      };
    });

    const minAt = Math.min(...results.map((r) => r.at.total));
    const minMt = Math.min(...results.map((r) => r.mt.total));

    return results
      .map((r) => ({ ...r, isCheapestAt: r.at.total === minAt, isCheapestMt: r.mt.total === minMt }))
      .sort((a, b) => Number(b.school.isTarget) - Number(a.school.isTarget));
  }, [data, pattern, attribute, night, safetyPack, referralTypeId, student]);

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
        <p className="mb-3 text-sm font-semibold text-slate-700">1. スピードコースをつけますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">{SPEED_COURSE_DESCRIPTION}</p>
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

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">2. 安心保証コースをつけますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          技能教習が延びたり、検定に落ちてしまっても追加料金がかからないコースです。料金は年齢によって変わります（高校生は対象外です）。
        </p>
        <div className="mb-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-100">
            <span className="font-semibold">保証の対象：</span>
            {GUARANTEE_COVERAGE.covered.join("、")}
          </p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 ring-1 ring-slate-200">
            <span className="font-semibold">保証の対象外：</span>
            {GUARANTEE_COVERAGE.notCovered.join("、")}
          </p>
        </div>
        {isHighSchool ? (
          <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
            高校生の方は安心保証コースの対象外のため、保証なしで計算しています。
          </p>
        ) : (
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
                入校時の年齢
                <select
                  value={guaranteeAge}
                  onChange={(e) => setGuaranteeAge(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="" disabled hidden>
                    選択してください
                  </option>
                  {data.guaranteeTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}：{formatYen(t.price)}
                      {t.atOnly ? "（AT限定）" : ""}
                    </option>
                  ))}
                  <option value="over-70">71歳以上（対象外）</option>
                </select>
              </label>
            )}
          </div>
        )}
        {!isHighSchool && safetyPackEnabled && guaranteeAge === "over-70" && (
          <p className="mt-2 text-xs text-slate-500">71歳以上の方は安心保証コースの対象外のため、保証なしで計算しています。</p>
        )}

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

        {attribute === "student" && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {(
                [
                  ["university", "大学生・専門学生"],
                  ["highschool", "高校生"],
                ] as ["university" | "highschool", string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStudentCategory(value)}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    studentCategory === value ? "bg-emerald-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {studentCategory === "university" && data.studentSchools.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                通っている学校
                <select
                  value={studentSchoolId}
                  onChange={(e) => setStudentSchoolId(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="" disabled hidden>
                    選択してください
                  </option>
                  {data.studentSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || "（名称未設定）"}
                    </option>
                  ))}
                  <option value="other">その他の学校</option>
                </select>
              </label>
            )}
          </div>
        )}

        {nightFree && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
            🌙 学生の方は、夜間料金（{formatYen(target!.pricing.nightSurcharge)}）がサービスで付きます！
          </p>
        )}

        {data.referralTypes.length > 0 && (
          <>
            <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">4. 紹介者はいますか？</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: null, name: "いない" }, ...data.referralTypes].map((r) => (
                <button
                  key={r.id ?? "none"}
                  onClick={() => setReferralTypeId(r.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    referralTypeId === r.id
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                  }`}
                >
                  {r.name || "（名称未設定）"}
                </button>
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

            {(() => {
              const notes = [...new Set([...at.notes, ...mt.notes])];
              return notes.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  {notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : null;
            })()}
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
  breakdown: { label: string; amount: number; free?: boolean }[];
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
              <span className={item.free ? "font-semibold text-emerald-700" : ""}>
                {item.free ? "サービス" : `${item.amount < 0 ? "" : "+"}${formatYen(item.amount)}`}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
