// 営業日: 水(3)・土(6)、臨時休業(holidaysSet)対応
export function isBusinessDay(dateStr, holidaysSet) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const wd = d.getDay(); // 0=日..6=土
  if (holidaysSet && holidaysSet.has(dateStr)) return false;
  return wd === 3 || wd === 6;
}

// 11:00〜17:00, 30分刻み（含む）
export function genTimeSlots(open = "11:00", close = "17:00", stepMin = 30) {
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  let start = oh * 60 + om, end = ch * 60 + cm;
  const slots = [];
  for (let m = start; m <= end; m += stepMin) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}
