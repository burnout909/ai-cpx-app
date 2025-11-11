export default function getKSTTimestamp() {
  // Asia/Seoul 기준 포맷 → 2025-11-12_14-05-22
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
  // "2025. 11. 12. 14:05:22" → "2025-11-12_14-05-22"
  return fmt
    .replace(/\.\s/g, '-')     // "2025. 11. 12. " → "2025-11-12-"
    .replace(/\./g, '')        // 혹시 남은 점 제거
    .replace(' ', '')          // 불필요 공백 제거
    .replace(' ', '')          // 여분 공백 한 번 더
    .replace(/:/g, '-')        // 콜론 → 하이픈
    .replace(/-$/, '_');       // 마지막 하이픈을 언더바로
}
