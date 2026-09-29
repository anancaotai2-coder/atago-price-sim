export type SchoolId = string;
export type PatternId = "fast" | "safe" | "normal";
export type LicenseType = "AT" | "MT";
export type Attribute = "general" | "student";

export interface SchoolPricing {
  baseAT: number;
  baseMT: number;
  nightSurcharge: number;
  shortTermSurcharge: number;
  safeCourseSurcharge: number;
  overLessonFee: number;
  skillRetestFee: number;
  graduationRetestFee: number;
  provisionalWrittenRetestFee: number;
  freeOverLessonCount: number;
  freeSkillRetestCount: number;
  freeGraduationRetestCount: number;
  freeProvisionalWrittenRetestCount: number;
  studentDiscount: number;
}

export interface SchoolCampaign {
  id: string;
  enabled: boolean;
  label: string;
  freeCouponCount: number;
  freeRetestCount: number;
  extraDiscount: number;
}

export interface School {
  id: SchoolId;
  name: string;
  isTarget: boolean;
  isPlaceholder: boolean;
  hideName: boolean;
  pricing: SchoolPricing;
  campaigns: SchoolCampaign[];
}

export interface AnxietyScenario {
  assumedOverLessonCount: number;
  assumedSkillRetestCount: number;
  assumedGraduationRetestCount: number;
  assumedProvisionalWrittenRetestCount: number;
}

export interface PriceData {
  schools: School[];
  anxietyScenario: AnxietyScenario;
  updatedAt: string;
}

export function createBlankSchool(id: string): School {
  return {
    id,
    name: "新しい学校",
    isTarget: false,
    isPlaceholder: true,
    hideName: true,
    pricing: {
      baseAT: 0,
      baseMT: 0,
      nightSurcharge: 0,
      shortTermSurcharge: 0,
      safeCourseSurcharge: 0,
      overLessonFee: 0,
      skillRetestFee: 0,
      graduationRetestFee: 0,
      provisionalWrittenRetestFee: 0,
      freeOverLessonCount: 0,
      freeSkillRetestCount: 0,
      freeGraduationRetestCount: 0,
      freeProvisionalWrittenRetestCount: 0,
      studentDiscount: 0,
    },
    campaigns: [],
  };
}

export function createBlankCampaign(id: string): SchoolCampaign {
  return {
    id,
    enabled: true,
    label: "",
    freeCouponCount: 0,
    freeRetestCount: 0,
    extraDiscount: 0,
  };
}

export interface BreakdownItem {
  label: string;
  amount: number;
}

export interface PatternResult {
  license: LicenseType;
  total: number;
  breakdown: BreakdownItem[];
}

export function calcSchoolPrice(
  school: School,
  pattern: PatternId,
  license: LicenseType,
  attribute: Attribute,
  night: boolean,
  scenario: AnxietyScenario
): PatternResult {
  const p = school.pricing;
  const activeCampaigns = school.campaigns.filter((c) => c.enabled);
  const couponCount = activeCampaigns.reduce((sum, c) => sum + c.freeCouponCount, 0);
  const retestCount = activeCampaigns.reduce((sum, c) => sum + c.freeRetestCount, 0);
  const breakdown: BreakdownItem[] = [];

  const base = license === "AT" ? p.baseAT : p.baseMT;
  breakdown.push({ label: "基本料金", amount: base });

  if (pattern === "fast" && p.shortTermSurcharge) {
    breakdown.push({ label: "短期集中コース加算", amount: p.shortTermSurcharge });
  }

  if (pattern === "safe") {
    if (p.safeCourseSurcharge) {
      breakdown.push({ label: "安心コース加算", amount: p.safeCourseSurcharge });
    }

    const freeOver = p.freeOverLessonCount + couponCount;
    const overNeeded = Math.max(0, scenario.assumedOverLessonCount - freeOver);
    if (overNeeded > 0) {
      breakdown.push({ label: `技能オーバー教習 ${overNeeded}回分`, amount: overNeeded * p.overLessonFee });
    }

    const freeSkill = p.freeSkillRetestCount + retestCount;
    const skillNeeded = Math.max(0, scenario.assumedSkillRetestCount - freeSkill);
    if (skillNeeded > 0) {
      breakdown.push({ label: `修了検定再受験 ${skillNeeded}回分`, amount: skillNeeded * p.skillRetestFee });
    }

    const freeGrad = p.freeGraduationRetestCount + retestCount;
    const gradNeeded = Math.max(0, scenario.assumedGraduationRetestCount - freeGrad);
    if (gradNeeded > 0) {
      breakdown.push({ label: `卒業検定再受験 ${gradNeeded}回分`, amount: gradNeeded * p.graduationRetestFee });
    }

    const freeWritten = p.freeProvisionalWrittenRetestCount;
    const writtenNeeded = Math.max(0, scenario.assumedProvisionalWrittenRetestCount - freeWritten);
    if (writtenNeeded > 0) {
      breakdown.push({ label: `仮免学科再受験 ${writtenNeeded}回分`, amount: writtenNeeded * p.provisionalWrittenRetestFee });
    }
  }

  if (night && p.nightSurcharge) {
    breakdown.push({ label: "夜間料金加算", amount: p.nightSurcharge });
  }

  if (attribute === "student" && p.studentDiscount) {
    breakdown.push({ label: "学生割引", amount: -p.studentDiscount });
  }

  for (const c of activeCampaigns) {
    if (c.extraDiscount) {
      breakdown.push({ label: c.label || "キャンペーン割引", amount: -c.extraDiscount });
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  return { license, total, breakdown };
}

export const PATTERN_LABELS: Record<PatternId, { title: string; subtitle: string }> = {
  fast: { title: "最短で取りたい人", subtitle: "短期集中コースで一気に卒業したいタイプ" },
  safe: { title: "安心して通いたい人", subtitle: "検定に落ちても慌てない、余裕を見込んだ通い方" },
  normal: { title: "一般的に通いたい人", subtitle: "順調に進んだ場合の標準的な通い方" },
};
