"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  LicenseType,
  PATTERN_LABELS,
  PatternId,
  PriceData,
  School,
  GUARANTEE_COVERAGE,
  SafetyPackChoice,
  StudentInfo,
  calcSchoolPrice,
  isStudentNightFree,
} from "@/lib/pricing";

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

// 未回答は null。回答済みかどうかで「次に出す質問」を決める。
interface Answers {
  license: LicenseType | null;
  attribute: Attribute | null;
  studentCategory: StudentCategory | null;
  studentSchoolId: string | null;
  hasReferral: boolean | null;
  referralName: string | null;
  pattern: PatternId | null;
  night: boolean | null;
  safetyPack: boolean | null;
  guaranteeAge: string | null;
}

const EMPTY_ANSWERS: Answers = {
  license: null,
  attribute: null,
  studentCategory: null,
  studentSchoolId: null,
  hasReferral: null,
  referralName: null,
  pattern: null,
  night: null,
  safetyPack: null,
  guaranteeAge: null,
};

type AnswerKey = keyof Answers;

type StudentCategory = "university" | "highschool";

// 大学・専門学校の選択肢の最後に付ける「リストにない学校」。通常の学生割引を使う。
const OTHER_SCHOOL = "other";

// 安心保証コースの年齢の選択肢の最後に付ける「71歳以上（対象外）」。
const OVER_AGE = "over-70";

// 高校生は安心保証コースの対象外なので、つける／つけないの質問自体を出さない。
function canChooseGuarantee(a: Answers): boolean {
  return !(a.attribute === "student" && a.studentCategory === "highschool");
}

// 実際に計算へ使う安心保証コースの選択。対象外の人や71歳以上は「つけない」扱い。
function safetyPackOf(a: Answers, data: PriceData): SafetyPackChoice {
  const tier = data.guaranteeTiers.find((t) => t.id === a.guaranteeAge) ?? null;
  return { enabled: canChooseGuarantee(a) && a.safetyPack === true && !!tier, tier };
}

// リストの大学・専門学校を選んだときだけ学校別の割引を使う。高校生・その他の学校・一般は null。
function studentInfoOf(a: Answers, data: PriceData): StudentInfo {
  if (a.attribute !== "student" || a.studentCategory !== "university" || !a.studentSchoolId) {
    return { schoolId: null, schoolName: null };
  }
  const found = data.studentSchools.find((s) => s.id === a.studentSchoolId);
  return found ? { schoolId: found.id, schoolName: found.name } : { schoolId: null, schoolName: null };
}

interface QuestionOption {
  value: string | number | boolean;
  label: string;
  sub?: string;
}

interface Question {
  key: AnswerKey;
  title: string;
  description?: string;
  // 結果画面の「回答内容」に出す短い見出し。
  summaryLabel: string;
  options: QuestionOption[];
  // 前の回答によって出す・出さないが変わる質問。
  when?: (a: Answers) => boolean;
  // 前の回答によって出す、目立たせたいお知らせ（例：学生は夜間料金がサービス）。
  callout?: (a: Answers) => string | null;
  // 選択肢の上に出す補足（例：安心保証コースの保証内容）。
  extra?: React.ReactNode;
}

// 紹介割引は学校ごとに自由に名前を付けて登録する仕組みなので、全校の紹介名を重複なしで集めて選択肢にする。
// 生徒が選んだ名前と同じ名前の紹介割引を持つ学校だけに割引が付く。
function collectReferralNames(schools: School[]): string[] {
  const names = schools.flatMap((s) => s.referralDiscounts.map((r) => r.name.trim()).filter(Boolean));
  return [...new Set(names)];
}

function findReferralId(school: School, name: string | null): string | null {
  if (!name) return null;
  return school.referralDiscounts.find((r) => r.name.trim() === name)?.id ?? null;
}

function buildQuestions(data: PriceData): Question[] {
  const referralNames = collectReferralNames(data.schools);
  const hasReferralChoices = referralNames.length > 0;
  const target = data.schools.find((s) => s.isTarget);
  return [
    {
      key: "license",
      title: "取りたい免許はどちらですか？",
      summaryLabel: "免許",
      options: [
        { value: "AT", label: "AT（オートマ）", sub: "多くの方はこちら" },
        { value: "MT", label: "MT（マニュアル）" },
      ],
    },
    {
      key: "attribute",
      title: "あなたにあてはまるものは？",
      description: "入校時点で高校・大学・専門学校などに在学中の方は「学生」を選んでください。",
      summaryLabel: "区分",
      options: [
        { value: "student", label: "学生", sub: "高校生・大学生・専門学生など" },
        { value: "general", label: "一般", sub: "社会人・その他" },
      ],
    },
    {
      key: "studentCategory",
      title: "どちらにあてはまりますか？",
      summaryLabel: "学生区分",
      when: (a) => a.attribute === "student",
      options: [
        { value: "university", label: "大学生・専門学生", sub: "短大・大学院なども含みます" },
        { value: "highschool", label: "高校生" },
      ],
    },
    {
      key: "studentSchoolId",
      title: "通っている学校を選んでください",
      description: "学校によって割引額が変わります。一覧にない場合は「その他の学校」を選んでください。",
      summaryLabel: "学校",
      // 管理画面で学校が1つも登録されていなければ聞かない。
      when: (a) => a.attribute === "student" && a.studentCategory === "university" && data.studentSchools.length > 0,
      options: [
        ...data.studentSchools.map((s) => ({ value: s.id, label: s.name || "（名称未設定）" })),
        { value: OTHER_SCHOOL, label: "その他の学校" },
      ],
    },
    {
      key: "hasReferral",
      title: "紹介者はいらっしゃいますか？",
      summaryLabel: "紹介",
      // 紹介割引がどの学校にも登録されていなければ聞かない。
      when: () => hasReferralChoices,
      options: [
        { value: true, label: "はい" },
        { value: false, label: "いいえ" },
      ],
    },
    {
      key: "referralName",
      title: "どなたからの紹介ですか？",
      summaryLabel: "紹介の種類",
      when: (a) => hasReferralChoices && a.hasReferral === true,
      options: referralNames.map((name) => ({ value: name, label: name })),
    },
    {
      key: "pattern",
      title: "どのように通いたいですか？",
      summaryLabel: "通い方",
      options: (["fast", "normal"] as PatternId[]).map((id) => ({
        value: id,
        label: PATTERN_LABELS[id].title,
        sub: PATTERN_LABELS[id].subtitle,
      })),
    },
    {
      key: "night",
      title: "夜間に教習を受けたいですか？",
      summaryLabel: "夜間教習",
      callout: (a) =>
        target && a.attribute === "student" && isStudentNightFree(target, "student")
          ? `学生の方は、夜間料金（${formatYen(target.pricing.nightSurcharge)}）がサービスで付きます！`
          : null,
      options: [
        { value: true, label: "夜間も通いたい" },
        { value: false, label: "日中だけでOK" },
      ],
    },
    {
      key: "safetyPack",
      title: "安心保証コースをつけますか？",
      description: "技能教習が延びたり、検定に落ちてしまっても追加料金がかからないコースです。料金は年齢によって変わります。",
      summaryLabel: "安心保証コース",
      when: canChooseGuarantee,
      extra: <GuaranteeCoverage />,
      options: [
        { value: true, label: "つける", sub: "次の質問で年齢を選びます" },
        { value: false, label: "つけない" },
      ],
    },
    {
      key: "guaranteeAge",
      title: "入校時の年齢を教えてください",
      description: "安心保証コースの料金は年齢によって変わります。",
      summaryLabel: "年齢",
      when: (a) => canChooseGuarantee(a) && a.safetyPack === true,
      callout: (a) => {
        const atOnly = data.guaranteeTiers.filter((t) => t.atOnly).map((t) => t.label);
        return a.license === "MT" && atOnly.length > 0
          ? `MT（マニュアル）の方は、${atOnly.join("・")}は安心保証コースをつけられません。`
          : null;
      },
      options: [
        ...data.guaranteeTiers.map((t) => ({
          value: t.id,
          label: t.label,
          sub: `${formatYen(t.price)}${t.atOnly ? "（AT限定）" : ""}`,
        })),
        { value: OVER_AGE, label: "71歳以上", sub: "安心保証コースの対象外です" },
      ],
    },
  ];
}

function optionLabel(q: Question, value: Answers[AnswerKey]): string {
  return q.options.find((o) => o.value === value)?.label ?? "";
}

type Screen = { kind: "intro" } | { kind: "question"; key: AnswerKey } | { kind: "result" };

export default function MobileSimulator({ data }: { data: PriceData }) {
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [screen, setScreen] = useState<Screen>({ kind: "intro" });

  const questions = useMemo(() => buildQuestions(data), [data]);
  const visible = questions.filter((q) => !q.when || q.when(answers));
  const targetName = data.schools.find((s) => s.isTarget)?.name ?? "";

  // 回答後は「まだ答えていない次の質問」へ進む。戻って答え直した場合も、答え済みの質問は飛ばして元の位置へ戻る。
  const nextScreen = (a: Answers, fromIndex: number): Screen => {
    const list = questions.filter((q) => !q.when || q.when(a));
    const next = list.slice(fromIndex + 1).find((q) => a[q.key] === null);
    return next ? { kind: "question", key: next.key } : { kind: "result" };
  };

  const answer = (q: Question, value: QuestionOption["value"]) => {
    const updated = { ...answers, [q.key]: value };
    setAnswers(updated);
    const index = questions.filter((x) => !x.when || x.when(updated)).findIndex((x) => x.key === q.key);
    setScreen(nextScreen(updated, index));
  };

  const restart = () => {
    setAnswers(EMPTY_ANSWERS);
    setScreen({ kind: "intro" });
  };

  if (screen.kind === "intro") {
    return <Intro targetName={targetName} questionCount={visible.length} onStart={() => setScreen(nextScreen(answers, -1))} />;
  }

  if (screen.kind === "result") {
    return (
      <Result
        data={data}
        answers={answers}
        questions={visible}
        targetName={targetName}
        onEdit={(key) => setScreen({ kind: "question", key })}
        onRestart={restart}
      />
    );
  }

  const index = visible.findIndex((q) => q.key === screen.key);
  const q = visible[index];
  const goBack = () => (index === 0 ? setScreen({ kind: "intro" }) : setScreen({ kind: "question", key: visible[index - 1].key }));

  return (
    <Shell targetName={targetName}>
      <div className="mt-2 flex items-baseline justify-between">
        <SectionLabel>QUESTION {String(index + 1).padStart(2, "0")}</SectionLabel>
        <span className="text-xs font-bold text-slate-400">
          <span className="text-emerald-600">{index + 1}</span> / {visible.length}
        </span>
      </div>
      <RoadProgress ratio={index / visible.length} />

      <section key={q.key} className="animate-question-in mt-7 flex flex-col">
        <h1 className="text-[22px] font-black leading-snug text-slate-900">{q.title}</h1>
        {q.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{q.description}</p>}
        {q.callout?.(answers) && (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
            {q.key === "night" ? "🌙 " : "⚠️ "}
            {q.callout(answers)}
          </p>
        )}
        {q.extra}

        <div className="mt-6 flex flex-col gap-3">
          {q.options.map((o) => {
            const selected = answers[q.key] === o.value;
            const tone = selected
              ? "border-emerald-600 bg-emerald-50 shadow-emerald-100"
              : "border-slate-200 bg-white active:border-emerald-300 active:bg-emerald-50";
            return (
              <button
                key={String(o.value)}
                onClick={() => answer(q, o.value)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left shadow-sm transition active:scale-[0.98] ${tone}`}
              >
                <span className="flex-1">
                  <span className="block text-base font-bold text-slate-900">{o.label}</span>
                  {o.sub && <span className="mt-0.5 block text-xs text-slate-500">{o.sub}</span>}
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${
                    selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {/* 戻るは選択肢のすぐ下に置き、親指で押しやすくする。 */}
        <button
          onClick={goBack}
          className="mx-auto mt-6 rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-500 shadow-sm transition active:bg-slate-100"
        >
          ‹ 戻る
        </button>
      </section>
    </Shell>
  );
}

// あたご自動車学校の公式サイト（ds-atago.com）のヘッダーロゴ。校名入りなので画像だけを表示する。
function Logo({ targetName, small = false }: { targetName: string; small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/atago-logo.jpg" alt={targetName} className={small ? "h-6 w-auto" : "h-9 w-auto"} />
  );
}

// 全画面共通の外枠。白ベースに、淡い緑のぼかしを背景の飾りとして置く。
function Shell({ targetName, children }: { targetName: string; children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col overflow-hidden bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />
      </div>
      <header className="relative z-10 flex items-center justify-between border-b border-slate-100 bg-white/70 px-4 py-3 backdrop-blur">
        <Logo targetName={targetName} />
      </header>
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-10 pt-5">{children}</div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold tracking-[0.25em] text-emerald-600">{children}</p>;
}

// 蛍光ペンで線を引いたような強調。
function Marker({ children }: { children: React.ReactNode }) {
  return <span className="bg-[linear-gradient(transparent_62%,#a7f3d0_62%)] px-0.5">{children}</span>;
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 22" className={className} aria-hidden>
      <path
        d="M5 15v-3.5C5 10.1 6.1 9 7.5 9H13l5-5.2C18.6 3.3 19.4 3 20.2 3H31c.8 0 1.6.3 2.2.9L38.5 9h3C43 9 44 10.1 44 11.5V15c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1z"
        fill="#059669"
      />
      <path d="M15.5 9l4-4.2h5.3V9zM27 4.8h3.8L35.2 9H27z" fill="#fff" opacity=".9" />
      <circle cx="13.5" cy="16" r="3.6" fill="#1e293b" />
      <circle cx="13.5" cy="16" r="1.4" fill="#fff" />
      <circle cx="35.5" cy="16" r="3.6" fill="#1e293b" />
      <circle cx="35.5" cy="16" r="1.4" fill="#fff" />
    </svg>
  );
}

// 進み具合を「道路を走る車」で見せる。
function RoadProgress({ ratio }: { ratio: number }) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className="relative mt-3 h-8">
      <div className="absolute inset-x-0 bottom-1 h-2 rounded-full bg-slate-100" />
      <div
        className="absolute bottom-1 left-0 h-2 rounded-full bg-emerald-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
      <div className="absolute inset-x-1 bottom-[11px] border-t-2 border-dashed border-white/80" />
      <div className="absolute bottom-2 -ml-5 transition-all duration-500" style={{ left: `${percent}%` }}>
        <CarIcon className="h-5 w-10 drop-shadow-sm" />
      </div>
      <span className="absolute -top-0.5 right-0 text-sm" aria-hidden>
        🏁
      </span>
    </div>
  );
}

function Intro({ targetName, questionCount, onStart }: { targetName: string; questionCount: number; onStart: () => void }) {
  const features = [
    `全${questionCount}問前後・約1分で完了`,
    "タップするだけでかんたん回答",
    "学割・紹介割引なども自動で反映",
  ];
  return (
    <Shell targetName={targetName}>
      <div className="mt-8">
        <span className="inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white">
          質問に答えるだけ、約1分でわかる
        </span>
      </div>
      <h1 className="mt-5 text-[34px] font-black leading-[1.3] tracking-tight text-slate-900">
        <Marker>教習料金</Marker>
        <br />
        シミュレーター
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        あなたの通い方に合わせた料金と、
        <br />
        近隣の自動車学校との比較がわかります。
      </p>

      <ul className="mt-7 space-y-2.5">
        {features.map((text, i) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
          >
            <span className="text-xs font-black text-emerald-600">{String(i + 1).padStart(2, "0")}</span>
            {text}
          </li>
        ))}
      </ul>

      <div className="relative mt-10 h-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 bottom-2 border-t-2 border-dashed border-slate-200" />
        <div className="animate-car-drive absolute bottom-2.5">
          <CarIcon className="h-6 w-12" />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-4 text-lg font-black text-white shadow-lg shadow-emerald-200 transition active:scale-[0.98] active:bg-emerald-700"
        >
          スタート
          <span aria-hidden>→</span>
        </button>
      </div>
    </Shell>
  );
}

function Result({
  data,
  answers,
  questions,
  targetName,
  onEdit,
  onRestart,
}: {
  data: PriceData;
  answers: Answers;
  questions: Question[];
  targetName: string;
  onEdit: (key: AnswerKey) => void;
  onRestart: () => void;
}) {
  const license = answers.license ?? "AT";

  const rows = useMemo(() => {
    const safetyPack = safetyPackOf(answers, data);
    const referralName = answers.hasReferral ? answers.referralName : null;
    const student = studentInfoOf(answers, data);
    return data.schools
      .map((school) => ({
        school,
        result: calcSchoolPrice(
          school,
          answers.pattern ?? "normal",
          license,
          answers.attribute ?? "general",
          answers.night ?? false,
          safetyPack,
          data.anxietyScenario,
          findReferralId(school, referralName),
          student
        ),
      }))
      .sort((a, b) => a.result.total - b.result.total || Number(b.school.isTarget) - Number(a.school.isTarget));
  }, [data, answers, license]);

  const target = rows.find((r) => r.school.isTarget) ?? rows[0];
  const others = rows.filter((r) => r !== target);
  const maxSaving = Math.max(0, ...others.map((r) => r.result.total - target.result.total));
  const isCheapest = others.every((r) => r.result.total >= target.result.total);
  const discounts = target.result.breakdown.filter((item) => item.amount < 0);
  const charges = target.result.breakdown.filter((item) => item.amount >= 0);
  const discountTotal = -discounts.reduce((sum, item) => sum + item.amount, 0);
  const nightFree = answers.attribute === "student" && isStudentNightFree(target.school, "student");

  return (
    <Shell targetName={targetName}>
      <div className="animate-question-in flex flex-col gap-6">
        <div className="mt-3">
          <SectionLabel>RESULT</SectionLabel>
          <h1 className="mt-2 text-[26px] font-black leading-snug text-slate-900">
            あなたの<Marker>教習料金</Marker>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {license === "AT" ? "AT（オートマ）" : "MT（マニュアル）"}・回答内容にもとづく試算です
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-emerald-100 ring-1 ring-emerald-200">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">当校</span>
              <p className="text-sm font-bold text-slate-700">{target.school.name}</p>
            </div>
            <p className="mt-3 text-[44px] font-black leading-none tracking-tight text-slate-900">
              {target.result.total.toLocaleString("ja-JP")}
              <span className="ml-1 text-lg font-bold">円</span>
            </p>
            {isCheapest && maxSaving > 0 && (
              <p className="mt-4 inline-block rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-black text-white">
                近隣校より最大 {formatYen(maxSaving)} お得！
              </p>
            )}
            {isCheapest && maxSaving === 0 && others.length > 0 && (
              <p className="mt-4 inline-block rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-black text-white">
                近隣校と同額で最安
              </p>
            )}

            {discounts.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 px-4 py-3">
                <div className="flex justify-between text-sm font-bold text-emerald-700">
                  <span>適用される割引</span>
                  <span>−{formatYen(discountTotal)}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                  {discounts.map((item, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="whitespace-nowrap">−{formatYen(-item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {nightFree && (
              <p className="mt-3 rounded-2xl bg-emerald-50/70 px-4 py-3 text-xs font-bold leading-relaxed text-emerald-700 ring-1 ring-emerald-200">
                🌙 学生の方は夜間料金（{formatYen(target.school.pricing.nightSurcharge)}）がサービスで付きます。
                {answers.night ? "" : "夜間に通うことになっても追加料金はかかりません。"}
              </p>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer py-1 text-sm font-bold text-emerald-700">料金の内訳を見る</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {charges.map((item, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="whitespace-nowrap">{item.free ? "サービス" : `+${formatYen(item.amount)}`}</span>
                  </li>
                ))}
              </ul>
            </details>

            <Notes notes={target.result.notes} />
          </div>
        </section>

        {others.length > 0 && (
          <section>
            <SectionLabel>COMPARE</SectionLabel>
            <h2 className="mb-3 mt-1 text-lg font-black text-slate-900">近隣校との比較（安い順）</h2>
            <ol className="flex flex-col gap-2.5">
              {rows.map(({ school, result }, i) => {
                const diff = result.total - target.result.total;
                const isTarget = school.id === target.school.id;
                return (
                  <li
                    key={school.id}
                    className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${
                      isTarget ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-white ring-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          i === 0 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {school.name}
                          {isTarget && <span className="ml-1 text-xs text-emerald-700">（当校）</span>}
                        </p>
                        {!isTarget && diff !== 0 && (
                          <p className="text-xs text-slate-500">
                            当校より{formatYen(Math.abs(diff))}
                            {diff > 0 ? "高い" : "安い"}
                          </p>
                        )}
                        {!isTarget && diff === 0 && <p className="text-xs text-slate-500">当校と同額</p>}
                      </div>
                      <p className="whitespace-nowrap text-base font-black text-slate-900">{formatYen(result.total)}</p>
                    </div>
                    {!isTarget && (
                      <details className="mt-1 pl-10">
                        <summary className="cursor-pointer text-xs font-bold text-emerald-700">内訳を見る</summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                          {result.breakdown.map((item, j) => (
                            <li key={j} className={`flex justify-between gap-2 ${item.amount < 0 || item.free ? "text-emerald-700" : ""}`}>
                              <span>{item.label}</span>
                              <span className="whitespace-nowrap">
                                {item.free ? "サービス" : item.amount < 0 ? `−${formatYen(-item.amount)}` : `+${formatYen(item.amount)}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Notes notes={result.notes} />
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-black text-slate-800">回答内容</h2>
          <p className="mt-0.5 text-xs text-slate-400">タップすると回答を変更できます</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {questions.map((q) => (
              <li key={q.key}>
                <button onClick={() => onEdit(q.key)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm">
                  <span className="text-slate-500">{q.summaryLabel}</span>
                  <span className="font-bold text-slate-900">
                    {optionLabel(q, answers[q.key])} <span className="text-emerald-600">›</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button
          onClick={onRestart}
          className="w-full rounded-full border-2 border-emerald-600 bg-white py-3.5 font-black text-emerald-700 transition active:bg-emerald-50"
        >
          最初からやり直す
        </button>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Logo targetName={targetName} small />
          <p className="text-xs text-slate-400">最終更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}</p>
        </div>
      </div>
    </Shell>
  );
}

function Notes({ notes }: { notes: string[] }) {
  const unique = [...new Set(notes)];
  if (unique.length === 0) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-500">
      {unique.map((note, i) => (
        <li key={i}>{note}</li>
      ))}
    </ul>
  );
}

function GuaranteeCoverage() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-xs leading-relaxed">
      <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
        <p className="font-black text-emerald-700">保証の対象</p>
        <ul className="mt-1 space-y-0.5 text-emerald-800">
          {GUARANTEE_COVERAGE.covered.map((t) => (
            <li key={t}>◯ {t}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
        <p className="font-black text-slate-600">保証の対象外</p>
        <ul className="mt-1 space-y-0.5 text-slate-600">
          {GUARANTEE_COVERAGE.notCovered.map((t) => (
            <li key={t}>✕ {t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
