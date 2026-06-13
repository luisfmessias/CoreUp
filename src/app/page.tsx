export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-[430px] rounded-[32px] bg-[#f8f7f2] px-6 py-10 text-center shadow-2xl shadow-stone-300/50">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">CoreUp</p>
        <h1 className="mt-3 text-3xl font-black text-stone-950">Sua rotina de treino</h1>
        <p className="mt-3 text-sm font-medium text-stone-500">
          Monte treinos, acompanhe a evolucao e organize sua semana de academia.
        </p>
      </div>
    </main>
  );
}
