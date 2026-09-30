export type SchoolId = string;
export type PatternId = "fast" | "normal";
export type LicenseType = "AT" | "MT";
export type Attribute = "general" | "student";

// キャンペーン・学割の適用先。「最短プラン」「一般プラン」「安心パック利用時」を
// それぞれ独立に ON/OFF できる。安心パックは最短・一般どちらにも付けられる横断オプションなので、
// 「ベースプランが一致」しているかどうかと「安心パックの有無」の両方をこのフラグで判定する。
export interface ApplicabilityFlags {
  fast: boolean;
  normal: boolean;
  safetyPack: boolean;
}

export function isApplicable(
  flags: ApplicabilityFlags,
  pattern: PatternId,
  safetyPackEnabled: boolean
): boolean {
  const matchesBasePlan = pattern === "fast" ? flags.fast : flags.normal;
  if (!matchesBasePlan) return false;
  if (safetyPackEnabled && !flags.safetyPack) return false;
  return true;
}

export function defaultApplicability(): ApplicabilityFlags {
  // 既定では「一般プラン・安心パックなし」の時だけ適用される（最短・安心パックには効かない）。
  return { fast: false, normal: true, safetyPack: false };
}

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
  studentDiscountApplicability: ApplicabilityFlags;
}

export interface SchoolCampaign {
  id: string;
  enabled: boolean;
  label: string;
  freeCouponCount: number;
  freeRetestCount: number;
  extraDiscount: number;
  applicability: ApplicabilityFlags;
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
  // 安心パックの「技能教習 追加時限数」は生徒が選べる。0〜この上限までの選択肢を出す。
  overLessonChoiceMax: number;
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
      studentDiscountApplicability: defaultApplicability(),
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
    applicability: defaultApplicability(),
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

export interface SafetyPackChoice {
  enabled: boolean;
  overLessonCount: number;
}

export function calcSchoolPrice(
  school: School,
  pattern: PatternId,
  license: LicenseType,
  attribute: Attribute,
  night: boolean,
  safetyPack: SafetyPackChoice,
  scenario: AnxietyScenario
): PatternResult {
  const p = school.pricing;
  const safetyOn = safetyPack.enabled;
  const activeCampaigns = school.campaigns.filter(
    (c) => c.enabled && isApplicable(c.applicability, pattern, safetyOn)
  );
  const couponCount = activeCampaigns.reduce((sum, c) => sum + c.freeCouponCount, 0);
  const retestCount = activeCampaigns.reduce((sum, c) => sum + c.freeRetestCount, 0);
  const breakdown: BreakdownItem[] = [];

  const base = license === "AT" ? p.baseAT : p.baseMT;
  breakdown.push({ label: "基本料金", amount: base });

  if (pattern === "fast" && p.shortTermSurcharge) {
    breakdown.push({ label: "短期集中コース加算", amount: p.shortTermSurcharge });
  }

  if (safetyOn) {
    if (p.safeCourseSurcharge) {
      breakdown.push({ label: "安心パック加算", amount: p.safeCourseSurcharge });
    }

    const freeOver = p.freeOverLessonCount + couponCount;
    const overNeeded = Math.max(0, safetyPack.overLessonCount - freeOver);
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

  if (
    attribute === "student" &&
    p.studentDiscount &&
    isApplicable(p.studentDiscountApplicability, pattern, safetyOn)
  ) {
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
  normal: { title: "一般的に通いたい人", subtitle: "順調に進んだ場合の標準的な通い方" },
};
