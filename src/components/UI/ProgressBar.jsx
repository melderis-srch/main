export function ProgressBar({ value, max = 100, color = '#E8622A', height = 8 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{
      width: '100%', height,
      background: '#F3F4F6',
      borderRadius: height / 2, overflow: 'hidden'
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color,
        borderRadius: height / 2,
        transition: 'width 0.4s ease'
      }} />
    </div>
  );
}
