export default function Home() {
  return (
    <main className="min-h-screen p-6 space-y-4">
      <h1 className="font-display text-3xl text-forest">ألبان وأجبان القصر</h1>
      <p className="text-muted">Palette + RTL smoke test.</p>
      <div className="flex gap-2">
        <div className="w-12 h-12 rounded-lg bg-primary"></div>
        <div className="w-12 h-12 rounded-lg bg-primary-dk"></div>
        <div className="w-12 h-12 rounded-lg bg-warn"></div>
        <div className="w-12 h-12 rounded-lg bg-gold"></div>
      </div>
    </main>
  );
}
