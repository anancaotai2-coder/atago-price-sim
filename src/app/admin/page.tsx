"use client";

import { useEffect, useState } from "react";
import {
  AnxietyScenario,
  ApplicabilityFlags,
  GuaranteeTier,
  PriceData,
  School,
  SchoolCampaign,
  SchoolPricing,
  createBlankCampaign,
  createBlankSchool,
} from "@/lib/pricing";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// 「名前＋教習所ごとの割引額」で管理する一覧（大学・専門学校、紹介の種類）。
type NamedListKey = "studentSchools" | "referralTypes";
const DISCOUNT_FIELD = {
  studentSchools: "studentSchoolDiscounts",
  referralTypes: "referralTypeDiscounts",
} as const;

// Date.now() だけだと同一ミリ秒内の連続操作でIDが衝突することがあるため、乱数を混ぜる。
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminPage() {
  const [data, setData] = useState<PriceData | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    fetch("/api/admin/data")
      .then((res) => res.json())
      .then((json: PriceData) => setData(json));
  }, []);

  if (!data) {
    return <p className="p-8 text-slate-500">読み込み中…</p>;
  }

  function updateSchool(id: string, patch: Partial<School>) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            schools: prev.schools.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          }
        : prev
    );
  }

  function updatePricing(id: string, patch: Partial<SchoolPricing>) {
    const school = data!.schools.find((s) => s.id === id)!;
    updateSchool(id, { pricing: { ...school.pricing, ...patch } });
  }

  function updateCampaign(schoolId: string, campaignId: string, patch: Partial<SchoolCampaign>) {
    const school = data!.schools.find((s) => s.id === schoolId)!;
    updateSchool(schoolId, {
      campaigns: school.campaigns.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)),
    });
  }

  function addCampaign(schoolId: string) {
    const school = data!.schools.find((s) => s.id === schoolId)!;
    updateSchool(schoolId, {
      campaigns: [...school.campaigns, createBlankCampaign(uid("campaign"))],
    });
  }

  function removeCampaign(schoolId: string, campaignId: string) {
    const school = data!.schools.find((s) => s.id === schoolId)!;
    updateSchool(schoolId, { campaigns: school.campaigns.filter((c) => c.id !== campaignId) });
  }

  function updateScenario(patch: Partial<AnxietyScenario>) {
    setData((prev) => (prev ? { ...prev, anxietyScenario: { ...prev.anxietyScenario, ...patch } } : prev));
  }

  function updateGuaranteeTier(id: string, patch: Partial<GuaranteeTier>) {
    setData((prev) =>
      prev ? { ...prev, guaranteeTiers: prev.guaranteeTiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : prev
    );
  }

  function addNamedItem(key: NamedListKey) {
    setData((prev) => (prev ? { ...prev, [key]: [...prev[key], { id: uid(key), name: "" }] } : prev));
  }

  function renameNamedItem(key: NamedListKey, id: string, name: string) {
    setData((prev) => (prev ? { ...prev, [key]: prev[key].map((x) => (x.id === id ? { ...x, name } : x)) } : prev));
  }

  // 項目を消したら、各教習所に設定していたその項目の割引額も一緒に消す。
  function removeNamedItem(key: NamedListKey, id: string) {
    const field = DISCOUNT_FIELD[key];
    setData((prev) =>
      prev
        ? {
            ...prev,
            [key]: prev[key].filter((x) => x.id !== id),
            schools: prev.schools.map((school) => {
              const rest = { ...school[field] };
              delete rest[id];
              return { ...school, [field]: rest };
            }),
          }
        : prev
    );
  }

  function updateNamedDiscount(key: NamedListKey, schoolId: string, id: string, amount: number) {
    const field = DISCOUNT_FIELD[key];
    const school = data!.schools.find((s) => s.id === schoolId)!;
    updateSchool(schoolId, { [field]: { ...school[field], [id]: amount } });
  }

  // 当校を先頭にして、割引額の入力欄を並べる。
  const orderedSchools = [...data.schools].sort((a, b) => Number(b.isTarget) - Number(a.isTarget));

  function addSchool() {
    setData((prev) => {
      if (!prev) return prev;
      const id = uid("school");
      return { ...prev, schools: [...prev.schools, createBlankSchool(id)] };
    });
  }

  function removeSchool(id: string) {
    setData((prev) => (prev ? { ...prev, schools: prev.schools.filter((s) => s.id !== id) } : prev));
  }

  async function handleSave() {
    if (!data) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-emerald-700">ADMIN</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">料金・キャンペーン管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          ここでの変更は保存すると、生徒用ページにすぐ反映されます。
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-bold text-slate-900">安心保証コース（当校）</h2>
        <p className="mt-1 text-xs text-slate-500">
          生徒が「安心保証コースをつける」を選び、年齢を答えたときの当校の料金です。高校生・71歳以上には出ません。
          「AT限定」の区分をMTの生徒が選んだ場合は、保証なしで計算します。
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {data.guaranteeTiers.map((tier) => (
            <div key={tier.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <TextField label="年齢区分" value={tier.label} onChange={(v) => updateGuaranteeTier(tier.id, { label: v })} />
              <NumberField label="料金" unit="円" value={tier.price} onChange={(v) => updateGuaranteeTier(tier.id, { price: v })} />
              <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={tier.atOnly}
                  onChange={(e) => updateGuaranteeTier(tier.id, { atOnly: e.target.checked })}
                  className="h-3.5 w-3.5 accent-emerald-700"
                />
                AT限定
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-bold text-slate-900">近隣校の追加費用の見込み（全校共通）</h2>
        <p className="mt-1 text-xs text-slate-500">
          生徒が「安心保証コースをつける」を選んだとき、近隣校の料金は「保証コース加算＋下の想定回数分の追加費用」で計算します。
          当校は仮免学科再受験（保証対象外）の想定回数だけを使います。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            label="想定：技能オーバー"
            unit="時限"
            value={data.anxietyScenario.assumedOverLessonCount}
            onChange={(v) => updateScenario({ assumedOverLessonCount: v })}
          />
          <NumberField
            label="想定：修了検定再受験"
            unit="回"
            value={data.anxietyScenario.assumedSkillRetestCount}
            onChange={(v) => updateScenario({ assumedSkillRetestCount: v })}
          />
          <NumberField
            label="想定：卒業検定再受験"
            unit="回"
            value={data.anxietyScenario.assumedGraduationRetestCount}
            onChange={(v) => updateScenario({ assumedGraduationRetestCount: v })}
          />
          <NumberField
            label="想定：仮免学科再受験"
            unit="回"
            value={data.anxietyScenario.assumedProvisionalWrittenRetestCount}
            onChange={(v) => updateScenario({ assumedProvisionalWrittenRetestCount: v })}
          />
        </div>
      </section>

      <NamedDiscountList
        title="学生の通っている学校（大学・専門学校）"
        description="生徒が「学生 → 大学生・専門学生」を選んだときに出る学校の一覧です。最後に「その他の学校」が自動で付きます。学校を選んだ人には、各教習所の「学生割引額」の代わりにここの割引額を使います。登録が0件の間は、学校を選ぶ質問は出ません。"
        nameLabel="学校名（例：長崎大学）"
        addLabel="＋ 学校を追加する"
        items={data.studentSchools}
        schools={orderedSchools}
        discountOf={(school, id) => school.studentSchoolDiscounts[id] ?? 0}
        onAdd={() => addNamedItem("studentSchools")}
        onRename={(id, name) => renameNamedItem("studentSchools", id, name)}
        onRemove={(id) => removeNamedItem("studentSchools", id)}
        onDiscount={(schoolId, id, v) => updateNamedDiscount("studentSchools", schoolId, id, v)}
      />

      <NamedDiscountList
        title="紹介の種類"
        description="生徒が「紹介者がいる」を選んだときに出る選択肢です。割引額は教習所ごとに入力してください（0円なら割引なし）。登録が0件の間は、紹介者の質問は出ません。"
        nameLabel="紹介の種類（例：家族からの紹介）"
        addLabel="＋ 紹介の種類を追加する"
        items={data.referralTypes}
        schools={orderedSchools}
        discountOf={(school, id) => school.referralTypeDiscounts[id] ?? 0}
        onAdd={() => addNamedItem("referralTypes")}
        onRename={(id, name) => renameNamedItem("referralTypes", id, name)}
        onRemove={(id) => removeNamedItem("referralTypes", id)}
        onDiscount={(schoolId, id, v) => updateNamedDiscount("referralTypes", schoolId, id, v)}
      />

      {data.schools.map((school) => (
        <details
          key={school.id}
          open={school.isTarget}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center gap-2">
              {school.isTarget && (
                <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">
                  当校
                </span>
              )}
              <span className="font-bold text-slate-900">{school.name || "（校名未設定）"}</span>
              {school.isPlaceholder && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  仮データ
                </span>
              )}
              {school.hideName && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  校名を伏せる
                </span>
              )}
              <CampaignCountBadge count={school.campaigns.filter((c) => c.enabled).length} />
              {!school.isTarget && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm(`「${school.name || "この学校"}」を削除しますか？`)) {
                      removeSchool(school.id);
                    }
                  }}
                  className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  この学校を削除
                </button>
              )}
            </div>
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="学校名（管理用）"
                value={school.name}
                onChange={(v) => updateSchool(school.id, { name: v })}
              />
              <div className="flex flex-col justify-end gap-2 pb-2 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={school.isPlaceholder}
                    onChange={(e) => updateSchool(school.id, { isPlaceholder: e.target.checked })}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  「仮データ」バッジを表示する
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={school.hideName}
                    onChange={(e) => updateSchool(school.id, { hideName: e.target.checked })}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  生徒画面で校名を伏せる（近隣○校と匿名表示）
                </label>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">基本料金</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="通常料金 AT" unit="円" value={school.pricing.baseAT} onChange={(v) => updatePricing(school.id, { baseAT: v })} />
                <NumberField label="通常料金 MT" unit="円" value={school.pricing.baseMT} onChange={(v) => updatePricing(school.id, { baseMT: v })} />
                <NumberField label="夜間料金加算" unit="円" value={school.pricing.nightSurcharge} onChange={(v) => updatePricing(school.id, { nightSurcharge: v })} />
                <NumberField label="短期集中コース加算" unit="円" value={school.pricing.shortTermSurcharge} onChange={(v) => updatePricing(school.id, { shortTermSurcharge: v })} />
                {!school.isTarget && (
                  <NumberField label="保証コース加算（比較用）" unit="円" value={school.pricing.safeCourseSurcharge ?? 0} onChange={(v) => updatePricing(school.id, { safeCourseSurcharge: v })} />
                )}
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={school.pricing.studentNightFree}
                  onChange={(e) => updatePricing(school.id, { studentNightFree: e.target.checked })}
                  className="h-4 w-4 accent-emerald-700"
                />
                学生は夜間料金を免除する（生徒画面に「サービスで付きます」と表示）
              </label>
              <div className="mt-2">
                <TextField
                  label="注釈（任意・生徒画面のカード下にまとめて表示されます）"
                  value={school.pricing.pricingNote}
                  onChange={(v) => updatePricing(school.id, { pricingNote: v })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-sky-50 p-4 ring-1 ring-sky-100">
              <p className="text-sm font-semibold text-sky-800">割引額</p>

              <div>
                <NumberField
                  label="学生割引額（高校生・一覧にない学校）"
                  unit="円"
                  value={school.pricing.studentDiscount}
                  onChange={(v) => updatePricing(school.id, { studentDiscount: v })}
                />
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium text-slate-500">学生割引を適用する条件（学校別の割引にも使います）</p>
                  <ApplicabilityEditor
                    value={school.pricing.studentDiscountApplicability}
                    onChange={(v) => updatePricing(school.id, { studentDiscountApplicability: v })}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                大学・専門学校ごとの学生割引と紹介割引の金額は、上の「学生の通っている学校」「紹介の種類」の一覧で入力します。
              </p>

              <TextField
                label="注釈（任意・学生割引・紹介割引まとめて1つ、生徒画面のカード下に表示されます）"
                value={school.pricing.discountNote}
                onChange={(v) => updatePricing(school.id, { discountNote: v })}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">追加費用の単価</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField label="技能オーバー1回" unit="円" value={school.pricing.overLessonFee} onChange={(v) => updatePricing(school.id, { overLessonFee: v })} />
                <NumberField label="修了検定再受験" unit="円" value={school.pricing.skillRetestFee} onChange={(v) => updatePricing(school.id, { skillRetestFee: v })} />
                <NumberField label="卒業検定再受験" unit="円" value={school.pricing.graduationRetestFee} onChange={(v) => updatePricing(school.id, { graduationRetestFee: v })} />
                <NumberField label="仮免学科再受験" unit="円" value={school.pricing.provisionalWrittenRetestFee} onChange={(v) => updatePricing(school.id, { provisionalWrittenRetestFee: v })} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                標準で含まれる無料回数（安心保証コースをつけた場合の見込みに使用）
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField label="技能オーバー無料" unit="回" value={school.pricing.freeOverLessonCount} onChange={(v) => updatePricing(school.id, { freeOverLessonCount: v })} />
                <NumberField label="修了検定再受験無料" unit="回" value={school.pricing.freeSkillRetestCount} onChange={(v) => updatePricing(school.id, { freeSkillRetestCount: v })} />
                <NumberField label="卒業検定再受験無料" unit="回" value={school.pricing.freeGraduationRetestCount} onChange={(v) => updatePricing(school.id, { freeGraduationRetestCount: v })} />
                <NumberField label="仮免学科再受験無料" unit="回" value={school.pricing.freeProvisionalWrittenRetestCount} onChange={(v) => updatePricing(school.id, { freeProvisionalWrittenRetestCount: v })} />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <div>
                <p className="text-sm font-semibold text-emerald-800">キャンペーン</p>
                <p className="mt-1 text-xs text-emerald-700">
                  複数登録できます。ONのキャンペーンだけが料金に反映され、無料クーポン・再検定プレゼント・割引額は合算されます。
                </p>
              </div>

              {school.campaigns.length === 0 && (
                <p className="text-xs text-slate-500">キャンペーンはまだありません。</p>
              )}

              {school.campaigns.map((campaign, index) => (
                <div
                  key={campaign.id}
                  className={`rounded-lg border-l-4 bg-white p-3 ring-1 transition ${
                    campaign.enabled
                      ? "border-emerald-500 ring-emerald-200"
                      : "border-slate-300 bg-slate-50 ring-slate-200"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={campaign.enabled}
                        onChange={(e) => updateCampaign(school.id, campaign.id, { enabled: e.target.checked })}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      キャンペーン {index + 1}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          campaign.enabled ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"
                        }`}
                      >
                        {campaign.enabled ? "● 適用中" : "○ 停止中"}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`「${campaign.label || `キャンペーン ${index + 1}`}」を削除しますか？`)) {
                          removeCampaign(school.id, campaign.id);
                        }
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField label="キャンペーン名（例：夏の入校応援キャンペーン）" value={campaign.label} onChange={(v) => updateCampaign(school.id, campaign.id, { label: v })} />
                    <NumberField label="無料クーポン（技能オーバー分）" unit="枚" value={campaign.freeCouponCount} onChange={(v) => updateCampaign(school.id, campaign.id, { freeCouponCount: v })} />
                    <NumberField label="再検定プレゼント" unit="回" value={campaign.freeRetestCount} onChange={(v) => updateCampaign(school.id, campaign.id, { freeRetestCount: v })} />
                    <NumberField label="その他の割引額" unit="円" value={campaign.extraDiscount} onChange={(v) => updateCampaign(school.id, campaign.id, { extraDiscount: v })} />
                  </div>
                  <div className="mt-2">
                    <TextField
                      label="注釈（任意・生徒画面のカード下に表示されます）"
                      value={campaign.note}
                      onChange={(v) => updateCampaign(school.id, campaign.id, { note: v })}
                    />
                  </div>
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-slate-500">適用する条件</p>
                    <ApplicabilityEditor
                      value={campaign.applicability}
                      onChange={(v) => updateCampaign(school.id, campaign.id, { applicability: v })}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addCampaign(school.id)}
                className="rounded-lg border border-dashed border-emerald-400 bg-white py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                ＋ キャンペーンを追加する
              </button>
            </div>
          </div>
        </details>
      ))}

      <button
        type="button"
        onClick={addSchool}
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-semibold text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700"
      >
        ＋ 比較する学校を追加する
      </button>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl bg-white/90 p-4 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        {status === "saved" && <span className="text-sm font-medium text-emerald-700">保存しました</span>}
        {status === "error" && <span className="text-sm font-medium text-red-600">保存に失敗しました</span>}
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
        >
          {status === "saving" ? "保存中…" : "保存する"}
        </button>
      </div>
    </main>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
        />
        <span className="text-slate-400">{unit}</span>
      </div>
    </label>
  );
}

function CampaignCountBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
      ● キャンペーン{count}件 適用中
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
      キャンペーンなし
    </span>
  );
}

function ApplicabilityEditor({
  value,
  onChange,
}: {
  value: ApplicabilityFlags;
  onChange: (v: ApplicabilityFlags) => void;
}) {
  const options: { key: keyof ApplicabilityFlags; label: string }[] = [
    { key: "fast", label: "最短プラン" },
    { key: "normal", label: "一般プラン" },
    { key: "safetyPack", label: "安心保証コース利用時" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="h-3.5 w-3.5 accent-emerald-700"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
      />
    </label>
  );
}

function NamedDiscountList({
  title,
  description,
  nameLabel,
  addLabel,
  items,
  schools,
  discountOf,
  onAdd,
  onRename,
  onRemove,
  onDiscount,
}: {
  title: string;
  description: string;
  nameLabel: string;
  addLabel: string;
  items: { id: string; name: string }[];
  schools: School[];
  discountOf: (school: School, id: string) => number;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onDiscount: (schoolId: string, id: string, amount: number) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {items.length === 0 && <p className="mt-3 text-xs text-slate-500">まだ登録されていません。</p>}
      <div className="mt-3 flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="flex items-end gap-2">
              <TextField label={nameLabel} value={item.name} onChange={(v) => onRename(item.id, v)} />
              <button
                type="button"
                onClick={() => {
                  if (confirm(`「${item.name || "この項目"}」を削除しますか？各教習所の割引額も消えます。`)) {
                    onRemove(item.id);
                  }
                }}
                className="rounded-lg px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {schools.map((school) => (
                <NumberField
                  key={school.id}
                  label={`割引額：${school.name || "（校名未設定）"}`}
                  unit="円"
                  value={discountOf(school, item.id)}
                  onChange={(v) => onDiscount(school.id, item.id, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 w-full rounded-lg border border-dashed border-slate-300 bg-white py-2 text-sm font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
      >
        {addLabel}
      </button>
    </section>
  );
}
