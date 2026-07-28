export default function SkeletonTable() {
  return (
    <div className="rounded-xl bg-[#161c24] border border-white/5 p-4">
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-white/10 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
