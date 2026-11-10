export type SchoolId = string;
export type PatternId = "fast" | "normal";
export type LicenseType = "AT" | "MT";
export type Attribute = "general" | "student";

// キャンペーン・学割の適用先。「スピードコースあり」「スピードコースなし」「安心保証コース利用時」を
// それぞれ独立に ON/OFF できる。安心保証コースはスピードコースの有無どちらにも付けられる横断オプションなので、
// 「ベースプランが一致」しているかどうかと「安心保証コースの有無」の両方をこのフラグで判定する。
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
  // 既定では「スピードコースなし・安心保証コースなし」の時だけ適用される（スピードコース・安心保証コースには効かない）。
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
  // 高校生・リストにない学校の学生に使う学生割引。リストの大学・専門学校を選んだ場合は学校別の割引額に置き換わる。
  studentDiscount: number;
  studentDiscountApplicability: ApplicabilityFlags;
  // 学生は夜間料金を免除（サービス）するか。
  studentNightFree: boolean;
  // 「基本料金」ブロック全体に対する注釈（例：表示価格は税込です、など）。
  pricingNote: string;
  // 「割引額」ブロック（学生割引＋紹介割引）全体に対する注釈。
  discountNote: string;
}

export interface SchoolCampaign {
  id: string;
  enabled: boolean;
  label: string;
  freeCouponCount: number;
  freeRetestCount: number;
  extraDiscount: number;
  applicability: ApplicabilityFlags;
  note: string;
}

// 紹介の種類（例：家族からの紹介）。全校共通の選択肢で、割引額は教習所ごとに設定する。
export interface ReferralType {
  id: string;
  name: string;
}

export function defaultReferralTypes(): ReferralType[] {
  return [
    { id: "referral-family", name: "家族からの紹介" },
    { id: "referral-alumni", name: "卒業生からの紹介" },
    { id: "referral-club", name: "部活・サークルからの紹介" },
  ];
}

// 生徒が在学している大学・専門学校。管理画面で追加し、教習所ごとに割引額を設定する。
export interface StudentSchool {
  id: string;
  name: string;
}

export interface School {
  id: SchoolId;
  name: string;
  isTarget: boolean;
  isPlaceholder: boolean;
  hideName: boolean;
  pricing: SchoolPricing;
  campaigns: SchoolCampaign[];
  // 紹介の種類ごとの割引額（ReferralType.id -> 円）。未設定は0円扱い。
  referralTypeDiscounts: Record<string, number>;
  // 大学・専門学校ごとの学生割引額（StudentSchool.id -> 円）。未設定は0円扱い。
  studentSchoolDiscounts: Record<string, number>;
}

// 当校（あたご）の安心保証コース。年齢区分ごとに料金が変わる。
// 追加技能教習・修了検定・卒業検定は受け放題。仮免学科試験受験料・自由教習・当日キャンセル料は対象外。
export interface GuaranteeTier {
  id: string;
  label: string;
  price: number;
  // AT（オートマ）限定の区分。MTでこの区分を選んだ場合は保証コースをつけない扱いにする。
  atOnly: boolean;
}

export function defaultGuaranteeTiers(): GuaranteeTier[] {
  return [
    { id: "age-25", label: "25歳以下", price: 27500, atOnly: false },
    { id: "age-35", label: "26〜35歳", price: 33000, atOnly: false },
    { id: "age-45", label: "36〜45歳", price: 44000, atOnly: false },
    { id: "age-70", label: "46〜70歳", price: 55000, atOnly: true },
  ];
}

export const GUARANTEE_COVERAGE = {
  covered: ["追加の技能教習が受け放題", "修了検定・卒業検定が何回でも受けられる"],
  notCovered: ["仮免学科試験の受験料", "自由教習（自由練習）", "当日キャンセル料"],
};

// 近隣校で「安心保証コースをつける」を選んだときに見込む追加費用の想定回数。
export interface AnxietyScenario {
  // 旧仕様（生徒が追加時限数を選ぶ）の名残り。今は使っていない。
  overLessonChoiceMax: number;
  assumedOverLessonCount: number;
  assumedSkillRetestCount: number;
  assumedGraduationRetestCount: number;
  assumedProvisionalWrittenRetestCount: number;
}

export interface PriceData {
  schools: School[];
  studentSchools: StudentSchool[];
  referralTypes: ReferralType[];
  guaranteeTiers: GuaranteeTier[];
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
      studentNightFree: false,
      pricingNote: "",
      discountNote: "",
    },
    campaigns: [],
    referralTypeDiscounts: {},
    studentSchoolDiscounts: {},
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
    note: "",
  };
}

export interface BreakdownItem {
  label: string;
  amount: number;
  // 料金がかからない「サービス」項目（例：学生の夜間料金）。金額は0円で、表示だけ「サービス」にする。
  free?: boolean;
}

// 学生の詳細。大学・専門学校をリストから選んだ場合だけ schoolId が入る（高校生・その他の学校は null）。
export interface StudentInfo {
  schoolId: string | null;
  schoolName: string | null;
}

export function isStudentNightFree(school: School, attribute: Attribute): boolean {
  return attribute === "student" && school.pricing.studentNightFree && school.pricing.nightSurcharge > 0;
}

export interface PatternResult {
  license: LicenseType;
  total: number;
  breakdown: BreakdownItem[];
  notes: string[];
}

export interface SafetyPackChoice {
  enabled: boolean;
  // 当校の安心保証コースの年齢区分。当校はこの料金で計算し、近隣校は想定の追加費用で計算する。
  tier: GuaranteeTier | null;
}

// MTでAT限定の年齢区分を選んだ場合は、保証コースをつけない扱いになる。
export function isGuaranteeBlocked(safetyPack: SafetyPackChoice, license: LicenseType): boolean {
  return safetyPack.enabled && !!safetyPack.tier?.atOnly && license === "MT";
}

export function calcSchoolPrice(
  school: School,
  pattern: PatternId,
  license: LicenseType,
  attribute: Attribute,
  night: boolean,
  safetyPack: SafetyPackChoice,
  scenario: AnxietyScenario,
  referral: ReferralType | null,
  student: StudentInfo = { schoolId: null, schoolName: null }
): PatternResult {
  const p = school.pricing;
  const blocked = isGuaranteeBlocked(safetyPack, license);
  const safetyOn = safetyPack.enabled && !blocked;
  const activeCampaigns = school.campaigns.filter(
    (c) => c.enabled && isApplicable(c.applicability, pattern, safetyOn)
  );
  const couponCount = activeCampaigns.reduce((sum, c) => sum + c.freeCouponCount, 0);
  const retestCount = activeCampaigns.reduce((sum, c) => sum + c.freeRetestCount, 0);
  const breakdown: BreakdownItem[] = [];

  const base = license === "AT" ? p.baseAT : p.baseMT;
  breakdown.push({ label: "基本料金", amount: base });

  if (pattern === "fast" && p.shortTermSurcharge) {
    breakdown.push({ label: "スピードコース加算", amount: p.shortTermSurcharge });
  }

  const guaranteeTier = safetyOn && school.isTarget ? safetyPack.tier : null;

  if (guaranteeTier) {
    // 当校の安心保証コース：追加技能教習・修了検定・卒業検定は受け放題なので、料金は年齢区分の定額のみ。
    breakdown.push({ label: `安心保証コース（${guaranteeTier.label}）`, amount: guaranteeTier.price });

    // 仮免学科試験の受験料は保証対象外なので、想定回数分を見込む。
    const writtenNeeded = Math.max(
      0,
      scenario.assumedProvisionalWrittenRetestCount - p.freeProvisionalWrittenRetestCount
    );
    if (writtenNeeded > 0) {
      breakdown.push({ label: `仮免学科再受験 ${writtenNeeded}回分（保証対象外）`, amount: writtenNeeded * p.provisionalWrittenRetestFee });
    }
  } else if (safetyOn) {
    // 近隣校：保証コースの加算額＋想定の追加教習・再検定費用で見込む。
    if (p.safeCourseSurcharge) {
      breakdown.push({ label: "保証コース加算", amount: p.safeCourseSurcharge });
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
    if (isStudentNightFree(school, attribute)) {
      breakdown.push({ label: "夜間料金（学生はサービス）", amount: 0, free: true });
    } else {
      breakdown.push({ label: "夜間料金加算", amount: p.nightSurcharge });
    }
  }

  if (attribute === "student" && isApplicable(p.studentDiscountApplicability, pattern, safetyOn)) {
    // リストの大学・専門学校を選んだ場合は、学校別の割引額に置き換える。
    const amount = student.schoolId ? school.studentSchoolDiscounts[student.schoolId] ?? 0 : p.studentDiscount;
    if (amount) {
      const label = student.schoolId ? `学生割引（${student.schoolName ?? ""}）` : "学生割引";
      breakdown.push({ label, amount: -amount });
    }
  }

  for (const c of activeCampaigns) {
    if (c.extraDiscount) {
      breakdown.push({ label: c.label || "キャンペーン割引", amount: -c.extraDiscount });
    }
  }

  if (referral) {
    const amount = school.referralTypeDiscounts[referral.id] ?? 0;
    if (amount) {
      breakdown.push({ label: `紹介割引（${referral.name || "名称未設定"}）`, amount: -amount });
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  // 今の選択で実際に料金へ反映されているブロックの注釈だけを集める。
  const notes: string[] = [];
  if (blocked && school.isTarget) {
    notes.push(`MT（マニュアル）は${safetyPack.tier?.label ?? ""}の安心保証コースをつけられないため、保証なしで計算しています。`);
  }
  if (guaranteeTier) {
    notes.push(`安心保証コースの対象外：${GUARANTEE_COVERAGE.notCovered.join("、")}`);
  }
  if (p.pricingNote) notes.push(p.pricingNote);
  if (p.discountNote) notes.push(p.discountNote);
  for (const c of activeCampaigns) {
    if (c.note) notes.push(c.note);
  }

  return { license, total, breakdown, notes };
}

// スピードコース：優先的に予約が取れるため、最短3週間程度での卒業が見込める。
export const SPEED_COURSE_DESCRIPTION = "スピードコースは優先的に予約が取れるため、最短3週間程度での卒業が見込めます。";

export const PATTERN_LABELS: Record<PatternId, { title: string; subtitle: string }> = {
  fast: { title: "つける", subtitle: "優先的に予約が取れ、最短3週間程度で卒業が見込めます" },
  normal: { title: "つけない", subtitle: "通常の予約で、自分のペースで通います" },
};
