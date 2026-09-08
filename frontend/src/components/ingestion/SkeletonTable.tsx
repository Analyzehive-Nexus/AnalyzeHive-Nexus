export default function SkeletonTable() {
  return (
    <div className="rounded-xl bg-elevated border border-line p-4">
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-sunken rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
