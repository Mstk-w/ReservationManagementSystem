function adminEmail_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || Session.getActiveUser().getEmail();
}

function sendReservationMail_(p) {
  // p: { reserve_no, customer:{name,email}, pickup:{date,time}, items:[{name,qty,unit_price}], total, payment_method }
  const subject = `【予約確定】${p.reserve_no}`;
  const lines = (p.items || []).map(i => `・${i.name} ×${i.qty} = ${i.unit_price * i.qty}円`);
  const body = `${p.customer.name} 様

ご予約ありがとうございます。以下の内容で承りました。

予約番号: ${p.reserve_no}
受取日時: ${p.pickup.date} ${p.pickup.time}
お支払い: ${p.payment_method === 'paypay' ? 'PayPay' : '現金'}

ご注文内容:
${lines.join('\n')}

合計: ${p.total} 円

当日お気をつけてお越しください。`;

  GmailApp.sendEmail(p.customer.email, subject, body, { bcc: adminEmail_() });
  return json_({ ok:true });
}
