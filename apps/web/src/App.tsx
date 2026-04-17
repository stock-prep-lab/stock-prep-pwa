import { APP_NAME } from "@stock-prep/shared";

export function App() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-6 py-10 text-zinc-950">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm font-medium text-teal-700">Stock Prep Lab</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{APP_NAME}</h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700">
            翌営業日の候補を、引け後に落ち着いて準備するための PWA。
          </p>
        </div>
      </section>
    </main>
  );
}
