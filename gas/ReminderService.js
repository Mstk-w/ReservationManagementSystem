// 予約時にキューへ積む（pickup.date 単位で管理）
function addReminder_(p) {
  // p: { reserve_no, customer:{name,email}, pickup:{date,time} }
  const sp = PropertiesService.getScriptProperties();
  const key = `REMIND_${p.pickup.date}`;
  const arr = JSON.parse(sp.getProperty(key) || '[]');
  // reserve_no 重複を除外
  const map = Object.fromEntries(arr.map(x => [x.reserve_no, x]));
  map[p.reserve_no] = p;
  const next = Object.values(map);
  sp.setProperty(key, JSON.stringify(next));
  ensureDailyTrigger_();
  return json_({ ok:true, count: next.length });
}

// 毎日 08:00 JST に実行されるトリガーを保証
function ensureDailyTrigger_() {
  const exist = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sendReminderDaily_');
  if (!exist) {
    ScriptApp.newTrigger('sendReminderDaily_').timeBased().atHour(8).everyDays(1).create();
  }
}

// 当日分のキューを送信して削除
function sendReminderDaily_() {
  const tz = 'Asia/Tokyo';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const sp = PropertiesService.getScriptProperties();
  const key = `REMIND_${today}`;
  const arr = JSON.parse(sp.getProperty(key) || '[]');
  if (!arr.length) return;
  arr.forEach(p => {
    const subject = `【本日受取】予約番号 ${p.reserve_no}`;
    const body = `${p.customer.name} 様

本日 ${p.pickup.date} ${p.pickup.time} に受取予定です。
お気をつけてご来店ください。`;
    GmailApp.sendEmail(p.customer.email, subject, body);
  });
  sp.deleteProperty(key);
}
