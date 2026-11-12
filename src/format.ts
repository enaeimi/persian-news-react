const dateFmt = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});
const relFmt = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });

export function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '';
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return relFmt.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relFmt.format(hours, 'hour');
  return relFmt.format(Math.round(hours / 24), 'day');
}
