import { promises as fs } from "fs";
import path from "path";
import { ApplicabilityFlags, PriceData, School, SchoolCampaign, defaultApplicability } from "./pricing";

type LegacyCampaign = Omit<SchoolCampaign, "id" | "enabled" | "applicability">;

const DATA_FILE = path.join(process.cwd(), "data", "schools.json");
const BLOB_PATHNAME = "schools.json";
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const SEED_DATA: PriceData = {
  schools: [
    {
      id: "atago",
      name: "あたご自動車学校",
      isTarget: true,
      isPlaceholder: false,
      hideName: false,
      pricing: {
        baseAT: 335855,
        baseMT: 353675,
        nightSurcharge: 27500,
        shortTermSurcharge: 22000,
        safeCourseSurcharge: 0,
        overLessonFee: 5940,
        skillRetestFee: 5500,
        graduationRetestFee: 5500,
        provisionalWrittenRetestFee: 1800,
        freeOverLessonCount: 0,
        freeSkillRetestCount: 0,
        freeGraduationRetestCount: 0,
        freeProvisionalWrittenRetestCount: 0,
        studentDiscount: 0,
        studentDiscountApplicability: defaultApplicability(),
      },
      campaigns: [],
    },
    {
      id: "school-a",
      name: "近隣A自動車学校",
      isTarget: false,
      isPlaceholder: true,
      hideName: true,
      pricing: {
        baseAT: 340000,
        baseMT: 358000,
        nightSurcharge: 25000,
        shortTermSurcharge: 20000,
        safeCourseSurcharge: 0,
        overLessonFee: 6000,
        skillRetestFee: 6000,
        graduationRetestFee: 6000,
        provisionalWrittenRetestFee: 2000,
        freeOverLessonCount: 3,
        freeSkillRetestCount: 1,
        freeGraduationRetestCount: 1,
        freeProvisionalWrittenRetestCount: 1,
        studentDiscount: 10000,
        studentDiscountApplicability: defaultApplicability(),
      },
      campaigns: [],
    },
    {
      id: "school-b",
      name: "近隣B自動車学校",
      isTarget: false,
      isPlaceholder: true,
      hideName: true,
      pricing: {
        baseAT: 330000,
        baseMT: 348000,
        nightSurcharge: 26000,
        shortTermSurcharge: 25000,
        safeCourseSurcharge: 0,
        overLessonFee: 5500,
        skillRetestFee: 5000,
        graduationRetestFee: 5000,
        provisionalWrittenRetestFee: 1500,
        freeOverLessonCount: 0,
        freeSkillRetestCount: 0,
        freeGraduationRetestCount: 0,
        freeProvisionalWrittenRetestCount: 0,
        studentDiscount: 8000,
        studentDiscountApplicability: defaultApplicability(),
      },
      campaigns: [],
    },
  ],
  anxietyScenario: {
    overLessonChoiceMax: 10,
    assumedOverLessonCount: 3,
    assumedSkillRetestCount: 1,
    assumedGraduationRetestCount: 1,
    assumedProvisionalWrittenRetestCount: 1,
  },
  updatedAt: new Date().toISOString(),
};

async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(SEED_DATA, null, 2), "utf-8");
  }
}

async function getDataFromFile(): Promise<PriceData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as PriceData;
}

async function saveDataToFile(data: PriceData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Vercelのサーバーレス環境ではファイルシステムへの書き込みが永続化されないため、
// BLOB_READ_WRITE_TOKEN が設定されている本番環境では Vercel Blob を使う。
async function getDataFromBlob(): Promise<PriceData> {
  const { head, BlobNotFoundError } = await import("@vercel/blob");
  try {
    const info = await head(BLOB_PATHNAME);
    const res = await fetch(info.url, { cache: "no-store" });
    return (await res.json()) as PriceData;
  } catch (e) {
    // 未保存の初回のみ初期値を返す。それ以外の一時的な失敗で既存データを初期値で上書きしないよう、書き込みはしない。
    if (e instanceof BlobNotFoundError) return SEED_DATA;
    throw e;
  }
}

async function saveDataToBlob(data: PriceData): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATHNAME, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// 古い保存データに新しいフィールドが無い場合の後方互換用の補完。
// キャンペーン・学割の適用先が未設定の場合は defaultApplicability()（一般プランのみ）になる。
// これは「最短・安心パックには適用しない」という仕様変更の意図どおりの挙動。
function normalize(data: PriceData): PriceData {
  return {
    ...data,
    anxietyScenario: {
      ...data.anxietyScenario,
      overLessonChoiceMax: Math.max(
        data.anxietyScenario.overLessonChoiceMax ?? 10,
        data.anxietyScenario.assumedOverLessonCount
      ),
    },
    schools: data.schools.map((saved) => {
      // 旧形式（1校1キャンペーン）の `campaign` を `campaigns` 配列へ移行する。
      const { campaign: legacy, ...school } = saved as School & { campaign?: LegacyCampaign };
      const campaigns: SchoolCampaign[] = (
        school.campaigns ??
        (legacy && (legacy.label || legacy.freeCouponCount || legacy.freeRetestCount || legacy.extraDiscount)
          ? [{ id: `${school.id}-campaign-1`, enabled: true, ...legacy, applicability: defaultApplicability() }]
          : [])
      ).map((c) => ({ ...c, applicability: normalizeApplicability(c.applicability) }));
      return {
        ...school,
        campaigns,
        hideName: school.hideName ?? !school.isTarget,
        pricing: {
          ...school.pricing,
          safeCourseSurcharge: school.pricing.safeCourseSurcharge ?? 0,
          studentDiscountApplicability: normalizeApplicability(school.pricing.studentDiscountApplicability),
        },
      };
    }),
  };
}

function normalizeApplicability(flags?: Partial<ApplicabilityFlags>): ApplicabilityFlags {
  return flags ? { ...defaultApplicability(), ...flags } : defaultApplicability();
}

export async function getData(): Promise<PriceData> {
  const data = useBlob ? await getDataFromBlob() : await getDataFromFile();
  return normalize(data);
}

export async function saveData(data: PriceData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  return useBlob ? saveDataToBlob(data) : saveDataToFile(data);
}
