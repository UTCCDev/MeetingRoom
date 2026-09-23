/** Placeholder cards shown while a list is loading. */
export function SkeletonCards({ count = 3, className = "space-y-4" }: { count?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
