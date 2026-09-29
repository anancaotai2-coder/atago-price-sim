"use client";

import { useEffect, useState } from "react";
import {
  AnxietyScenario,
  PriceData,
  School,
  SchoolCampaign,
  SchoolPricing,
  createBlankCampaign,
  createBlankSchool,
} from "@/lib/pricing";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
      campaigns: [...school.campaigns, createBlankCampaign(`campaign-${Date.now()}`)],
    });
  }

  function removeCampaign(schoolId: string, campaignId: string) {
    const school = data!.schools.find((s) => s.id === schoolId)!;
    updateSchool(schoolId, { campaigns: school.campaigns.filter((c) => c.id !== campaignId) });
  }

  function updateScenario(patch: Partial<AnxietyScenario>) {
    setData((prev) => (prev ? { ...prev, anxietyScenario: { ...prev.anxietyScenario, ...patch } } : prev));
  }

  function addSchool() {
    setData((prev) => {
      if (!prev) return prev;
      const id = `school-${Date.now()}`;
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
        <h2 className="font-bold text-slate-900">安心コースの想定シナリオ（全校共通）</h2>
        <p className="mt-1 text-xs text-slate-500">
          「安心して通いたい人」向けの料金は、ここで設定した回数分トラブルがあった前提で計算します。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            label="想定：技能オーバー"
            unit="回"
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
                <NumberField label="安心コース加算" unit="円" value={school.pricing.safeCourseSurcharge ?? 0} onChange={(v) => updatePricing(school.id, { safeCourseSurcharge: v })} />
                <NumberField label="学生割引額" unit="円" value={school.pricing.studentDiscount} onChange={(v) => updatePricing(school.id, { studentDiscount: v })} />
              </div>
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
                標準で含まれる無料回数（安心コースの計算に使用）
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
                  className={`rounded-lg bg-white p-3 ring-1 ${campaign.enabled ? "ring-emerald-200" : "opacity-60 ring-slate-200"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={campaign.enabled}
                        onChange={(e) => updateCampaign(school.id, campaign.id, { enabled: e.target.checked })}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      キャンペーン {index + 1}（{campaign.enabled ? "適用中" : "停止中"}）
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
