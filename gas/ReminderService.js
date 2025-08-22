function addReminder_(data) {
  try {
    console.log('リマインド設定開始');
    
    var p = data || {};
    if (typeof data === 'string') {
      p = JSON.parse(data);
    }
    
    if (!p.reserve_no) {
      throw new Error('予約番号が必要です');
    }
    if (!p.customer || !p.customer.email) {
      throw new Error('顧客情報が必要です');
    }
    if (!p.pickup || !p.pickup.date) {
      throw new Error('受取日が必要です');
    }
    
    var sp = PropertiesService.getScriptProperties();
    var key = 'REMIND_' + p.pickup.date;
    var existingData = sp.getProperty(key);
    var arr = [];
    
    if (existingData) {
      try {
        arr = JSON.parse(existingData);
      } catch (parseError) {
        arr = [];
      }
    }
    
    var found = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].reserve_no === p.reserve_no) {
        arr[i] = p;
        found = true;
        break;
      }
    }
    
    if (!found) {
      arr.push(p);
    }
    
    sp.setProperty(key, JSON.stringify(arr));
    ensureDailyTrigger_();
    
    console.log('リマインド設定完了: ' + p.reserve_no);
    return json_({"ok":true,"count":arr.length,"message":"reminder_set"});
    
  } catch (error) {
    console.error('リマインド設定エラー: ' + error.toString());
    return json_({"ok":false,"message":"reminder_failed","error":error.toString()});
  }
}

function ensureDailyTrigger_() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var exist = false;
    
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'sendReminderDaily_') {
        exist = true;
        break;
      }
    }
    
    if (!exist) {
      ScriptApp.newTrigger('sendReminderDaily_').timeBased().atHour(8).everyDays(1).create();
      console.log('日次トリガー作成完了');
    }
  } catch (error) {
    console.error('トリガー設定エラー: ' + error.toString());
  }
}

function sendReminderDaily_() {
  try {
    var tz = 'Asia/Tokyo';
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var sp = PropertiesService.getScriptProperties();
    var key = 'REMIND_' + today;
    var existingData = sp.getProperty(key);
    var arr = [];
    
    if (existingData) {
      try {
        arr = JSON.parse(existingData);
      } catch (parseError) {
        console.error('データ解析失敗');
        return;
      }
    }
    
    console.log('リマインド処理開始: ' + arr.length + '件');
    
    if (arr.length === 0) {
      console.log('本日の予約なし');
      return;
    }
    
    var successCount = 0;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || !p.customer || !p.customer.email) {
        continue;
      }
      
      try {
        var subject = '【本日受取】予約番号 ' + p.reserve_no;
        var pickupTime = '時間未設定';
        if (p.pickup && p.pickup.time) {
          pickupTime = p.pickup.time;
        }
        
        var bodyText = p.customer.name + ' 様\n\n';
        bodyText += '本日 ' + p.pickup.date + ' ' + pickupTime + ' に受取予定です。\n';
        bodyText += 'お気をつけてご来店ください。\n\n';
        bodyText += '予約番号: ' + p.reserve_no + '\n\n';
        bodyText += '---\n';
        bodyText += 'カンパーニュ\n';
        bodyText += '営業日: 水曜日・土曜日\n';
        bodyText += '営業時間: 11:00～17:00';
        
        GmailApp.sendEmail(p.customer.email, subject, bodyText, {
          name: 'カンパーニュ予約システム'
        });
        successCount++;
        console.log('リマインドメール送信完了: ' + p.customer.email);
        
      } catch (error) {
        console.error('メール送信失敗: ' + error.toString());
      }
    }
    
    sp.deleteProperty(key);
    console.log('リマインド処理完了: ' + successCount + '/' + arr.length + '件成功');
    
  } catch (error) {
    console.error('日次リマインド処理エラー: ' + error.toString());
  }
}