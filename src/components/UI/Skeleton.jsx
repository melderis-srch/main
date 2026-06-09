export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style
    }} />
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12, padding: '12px 0',
          borderBottom: '1px solid #F3F4F6'
        }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={16} borderRadius={3} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 10, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <Skeleton width={100} height={13} />
      <Skeleton width={160} height={28} />
      <Skeleton width={80} height={12} />
    </div>
  );
}
