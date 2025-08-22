function adminEmail_() {
  var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (adminEmail) {
    return adminEmail;
  }
  return Session.getActiveUser().getEmail();
}

function sendReservationMail_(data) {
  try {
    console.log('メール送信開始');
    
    var p = data || {};
    if (typeof data === 'string') {
      p = JSON.parse(data);
    }
    
    if (!p.reserve_no) {
      throw new Error('予約番号が必要です');
    }
    if (!p.customer || !p.customer.email || !p.customer.name) {
      throw new Error('顧客情報が必要です');
    }
    
    var subject = '【予約確定】' + p.reserve_no;
    var lines = [];
    
    if (p.items && p.items.length > 0) {
      for (var i = 0; i < p.items.length; i++) {
        var item = p.items[i];
        var itemTotal = (item.unit_price || 0) * (item.qty || 0);
        lines.push('・' + item.name + ' ×' + item.qty + ' = ' + itemTotal + '円');
      }
    }
    
    var paymentMethod = '現金';
    if (p.payment_method === 'paypay') {
      paymentMethod = 'PayPay';
    }
    
    var pickupDate = '未設定';
    var pickupTime = '未設定';
    if (p.pickup) {
      pickupDate = p.pickup.date || '未設定';
      pickupTime = p.pickup.time || '未設定';
    }
    
    var totalAmount = String(p.total || 0);
    
    var bodyText = p.customer.name + ' 様\n\n';
    bodyText += 'ご予約ありがとうございます。以下の内容で承りました。\n\n';
    bodyText += '予約番号: ' + p.reserve_no + '\n';
    bodyText += '受取日時: ' + pickupDate + ' ' + pickupTime + '\n';
    bodyText += 'お支払い: ' + paymentMethod + '\n\n';
    bodyText += 'ご注文内容:\n';
    bodyText += lines.join('\n') + '\n\n';
    bodyText += '合計: ' + totalAmount + ' 円\n\n';
    bodyText += '当日お気をつけてお越しください。\n\n';
    bodyText += '---\n';
    bodyText += 'カンパーニュ\n';
    bodyText += '営業日: 水曜日・土曜日\n';
    bodyText += '営業時間: 11:00～17:00';
    
    GmailApp.sendEmail(p.customer.email, subject, bodyText, {
      bcc: adminEmail_(),
      name: 'カンパーニュ予約システム'
    });
    
    console.log('メール送信完了');
    return json_({"ok":true,"message":"mail_sent"});
    
  } catch (error) {
    console.error('メール送信エラー: ' + error.toString());
    return json_({"ok":false,"message":"mail_failed","error":error.toString()});
  }
}