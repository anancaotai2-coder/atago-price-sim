import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide text-emerald-700">
          あたご自動車学校
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          料金シミュレーター
        </h1>
        <p className="mt-3 text-slate-600">
          通い方パターンごとに近隣校との料金を比較できます。
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/student"
          className="rounded-xl bg-emerald-700 px-8 py-4 text-center font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          生徒用ページへ
        </Link>
        <Link
          href="/admin"
          className="rounded-xl border border-slate-300 bg-white px-8 py-4 text-center font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          管理者用ページへ
        </Link>
      </div>
    </main>
  );
}
