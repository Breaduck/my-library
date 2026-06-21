export default function BookProgress({ currentPage, pages }: { currentPage: number; pages: number }) {
  const pct = Math.min(Math.round((currentPage / pages) * 100), 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-[#6E6E73]">
        <span>p.{currentPage} / {pages}쪽</span>
        <span className="font-semibold text-indigo-600">{pct}%</span>
      </div>
      <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
      </div>
    </div>
  );
}
