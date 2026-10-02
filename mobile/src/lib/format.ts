/** The prototype's GU.fmt helpers. */

/** "Juan Dela Cruz" -> "JD" (titles like "Prof." are skipped). */
export function initials(name: string | null | undefined): string {
  return String(name || '?')
    .replace(/^(Prof\.|Dr\.|Mr\.|Ms\.)\s*/, '')
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** 1234 -> "1,234" */
export function num(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('en-PH');
}

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago" */
export function ago(iso: string | null): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

/** "Good morning" / "Good afternoon" / "Good evening" by the device clock. */
export function greeting(date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** A #RRGGBB color with a hex alpha suffix, as the prototype's `${color}1f`. */
export function tint(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color + alpha : color;
}
