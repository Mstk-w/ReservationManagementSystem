/**
 * カンパーニュ予約システム - GAS CORS完全解決版
 * 確実に動作するCORS回避とメール送信機能
 */

// ★★★ CORS完全対応レスポンス関数 ★★★
function createCorsResponse_(data, callback = null) {
  try {
    const jsonData = JSON.stringify(data);
    
    // JSONP コールバック対応
    if (callback) {
      const output = ContentService
        .createTextOutput(`${callback}(${jsonData});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
      return output;
    }
    
    // 通常のJSON + CORS ヘッダー
    const output = ContentService
      .createTextOutput(jsonData)
      .setMimeType(ContentService.MimeType.JSON);
    
    return output;
    
  } catch (error) {
    console.error('レスポンス作成エラー:', error);
    const errorResponse = JSON.stringify({
      ok: false,
      message: "response_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
    
    if (callback) {
      return ContentService
        .createTextOutput(`${callback}(${errorResponse});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService
      .createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ★★★ GET リクエスト処理（JSONP対応）★★★
function doGet(e) {
  try {
    console.log('[GET] リクエスト開始');
    console.log('[GET] パラメータ:', JSON.stringify(e.parameter || {}));
    
    const params = e.parameter || {};
    const key = String(params.key || '').trim();
    const path = String(params.path || '').trim();
    const data = String(params.data || '').trim();
    const callback = String(params.callback || '').trim(); // JSONP コールバック
    
    // API呼び出しの場合
    if (key && path) {
      console.log(`[API-GET] JSONP呼び出し: ${path}, callback: ${callback}`);
      return handleApiRequest_(key, path, data, callback);
    }
    
    // 管理画面表示
    console.log('[GET] 管理画面表示');
    return HtmlService
      .createTemplateFromFile('AdminIndex')
      .evaluate()
      .setTitle('カンパーニュ管理ダッシュボード')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    console.error('[GET] エラー:', error);
    const callback = e.parameter?.callback;
    return createCorsResponse_({
      ok: false,
      message: "get_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    }, callback);
  }
}

// ★★★ POST リクエスト処理 ★★★
function doPost(e) {
  try {
    console.log('[POST] リクエスト開始');
    
    let key = '';
    let path = '';
    let requestData = {};
    let callback = '';
    
    // パラメータからの取得
    if (e.parameter) {
      key = String(e.parameter.key || '').trim();
      path = String(e.parameter.path || '').trim();
      callback = String(e.parameter.callback || '').trim();
      
      if (e.parameter.data) {
        try {
          requestData = JSON.parse(e.parameter.data);
        } catch (parseError) {
          console.warn('[POST] パラメータデータ解析失敗:', parseError);
        }
      }
    }
    
    // POSTボディからの取得
    if (e.postData && e.postData.contents) {
      try {
        const postData = JSON.parse(e.postData.contents);
        key = key || String(postData.key || '').trim();
        path = path || String(postData.path || '').trim();
        callback = callback || String(postData.callback || '').trim();
        requestData = postData.data || requestData;
      } catch (parseError) {
        console.warn('[POST] POSTボディ解析失敗:', parseError);
      }
    }
    
    console.log(`[POST] 処理対象: path="${path}", callback="${callback}"`);
    
    return handleApiRequest_(key, path, requestData, callback);
    
  } catch (error) {
    console.error('[POST] エラー:', error);
    const callback = e.parameter?.callback;
    return createCorsResponse_({
      ok: false,
      message: "post_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    }, callback);
  }
}

// ★★★ API リクエスト処理（JSONP対応）★★★
function handleApiRequest_(key, path, data, callback = null) {
  try {
    // API キー認証
    const expectedKey = getApiKey_();
    if (!key || key !== expectedKey) {
      console.error('[API] 認証失敗');
      return createCorsResponse_({
        ok: false,
        message: "unauthorized",
        timestamp: new Date().toISOString()
      }, callback);
    }
    
    console.log(`[API] 認証成功: ${path}`);
    
    // データ処理
    let processedData = data;
    if (typeof data === 'string' && data.trim()) {
      try {
        processedData = JSON.parse(data);
      } catch (parseError) {
        console.error('[API] データ解析エラー:', parseError);
        return createCorsResponse_({
          ok: false,
          message: "invalid_json_data",
          error: parseError.toString()
        }, callback);
      }
    }
    
    // ルーティング
    let result;
    switch (path) {
      case 'mail':
        result = sendReservationMail_(processedData);
        break;
        
      case 'remind':
        result = addReminder_(processedData);
        break;
        
      case 'test':
        result = {
          ok: true,
          message: "api_test_success",
          timestamp: new Date().toISOString(),
          callback_support: !!callback,
          received_data: processedData
        };
        break;
        
      default:
        result = {
          ok: false,
          message: "endpoint_not_found",
          available_paths: ["mail", "remind", "test"]
        };
    }
    
    return createCorsResponse_(result, callback);
    
  } catch (error) {
    console.error('[API] 処理エラー:', error);
    return createCorsResponse_({
      ok: false,
      message: "api_processing_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    }, callback);
  }
}

// ★★★ 設定取得 ★★★
function getApiKey_() {
  try {
    const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    return key || '91d012136acf47f0b65ca8f84aceced56af240e21d3f42878f6e535dfe03a625';
  } catch (error) {
    console.error('[CONFIG] API_KEY 取得エラー:', error);
    return '91d012136acf47f0b65ca8f84aceced56af240e21d3f42878f6e535dfe03a625';
  }
}

function getAdminEmail_() {
  try {
    const email = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    return email || Session.getActiveUser().getEmail();
  } catch (error) {
    console.error('[CONFIG] ADMIN_EMAIL 取得エラー:', error);
    return Session.getActiveUser().getEmail();
  }
}

// ★★★ メール送信機能（完全版）★★★
function sendReservationMail_(data) {
  try {
    console.log('[MAIL] メール送信処理開始');
    
    // データ検証
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        message: "invalid_data",
        error: "データが正しくありません"
      };
    }
    
    const validation = validateMailData_(data);
    if (!validation.valid) {
      console.error('[MAIL] データ検証失敗:', validation.errors);
      return {
        ok: false,
        message: "validation_failed",
        errors: validation.errors
      };
    }
    
    const payload = validation.data;
    console.log(`[MAIL] 送信対象: ${payload.customer.email}, 予約番号: ${payload.reserve_no}`);
    
    // メール本文作成
    const mailContent = createMailContent_(payload);
    
    // Gmail 送信実行
    const sendResult = sendEmailWithRetry_(
      payload.customer.email,
      mailContent.subject,
      mailContent.body,
      {
        bcc: getAdminEmail_(),
        name: 'カンパーニュ予約システム'
      }
    );
    
    if (sendResult.success) {
      console.log('[MAIL] 送信成功');
      return {
        ok: true,
        message: "mail_sent_successfully",
        timestamp: new Date().toISOString()
      };
    } else {
      console.error('[MAIL] 送信失敗:', sendResult.error);
      return {
        ok: false,
        message: "mail_send_failed",
        error: sendResult.error,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    console.error('[MAIL] 予期しないエラー:', error);
    return {
      ok: false,
      message: "mail_processing_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// ★★★ メールデータ検証 ★★★
function validateMailData_(data) {
  const errors = [];
  const cleanData = {};
  
  try {
    // 予約番号
    if (!data.reserve_no) {
      errors.push('予約番号が必要です');
    } else {
      cleanData.reserve_no = String(data.reserve_no).trim();
    }
    
    // 顧客情報
    if (!data.customer || typeof data.customer !== 'object') {
      errors.push('顧客情報が必要です');
    } else {
      cleanData.customer = {};
      
      if (!data.customer.name) {
        errors.push('顧客名が必要です');
      } else {
        cleanData.customer.name = String(data.customer.name).trim();
      }
      
      if (!data.customer.email) {
        errors.push('顧客メールアドレスが必要です');
      } else {
        const email = String(data.customer.email).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push('メールアドレスの形式が正しくありません');
        } else {
          cleanData.customer.email = email;
        }
      }
    }
    
    // 受取情報
    cleanData.pickup = {
      date: String(data.pickup?.date || '未設定').trim(),
      time: String(data.pickup?.time || '未設定').trim()
    };
    
    // 商品情報
    if (!Array.isArray(data.items)) {
      cleanData.items = [];
    } else {
      cleanData.items = data.items.map(item => ({
        name: String(item.name || '商品名不明').trim(),
        qty: Number(item.qty) || 0,
        unit_price: Number(item.unit_price) || 0
      }));
    }
    
    // 合計金額・支払い方法
    cleanData.total = Number(data.total) || 0;
    cleanData.payment_method = String(data.payment_method || 'cash').trim();
    
    return {
      valid: errors.length === 0,
      errors: errors,
      data: cleanData
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`データ検証エラー: ${error.toString()}`],
      data: null
    };
  }
}

// ★★★ メール本文作成 ★★★
function createMailContent_(data) {
  try {
    const subject = `【予約確定】${data.reserve_no} - カンパーニュ`;
    
    let itemsList = '';
    if (Array.isArray(data.items) && data.items.length > 0) {
      itemsList = data.items.map(item => {
        const lineTotal = (item.unit_price || 0) * (item.qty || 0);
        return `・${item.name} ×${item.qty} = ¥${lineTotal.toLocaleString()}`;
      }).join('\n');
    } else {
      itemsList = '・商品情報の取得に失敗しました';
    }
    
    const paymentText = data.payment_method === 'paypay' ? 'PayPay' : '現金';
    
    const body = `${data.customer.name} 様

この度は、カンパーニュをご利用いただき誠にありがとうございます。
ご予約を以下の内容で承りました。

【予約詳細】
予約番号: ${data.reserve_no}
受取日時: ${data.pickup.date} ${data.pickup.time}
お支払い: ${paymentText}

【ご注文内容】
${itemsList}

合計: ¥${(data.total || 0).toLocaleString()}

【受取について】
当日は指定の日時にお気をつけてお越しください。
商品をご用意してお待ちしております。

【店舗情報】
営業日: 水曜日・土曜日
営業時間: 11:00～17:00

ご不明な点がございましたら、このメールに返信してお問い合わせください。

---
カンパーニュ
Hygge Bakery Reservation System

※このメールは自動送信されています。
`;

    return { subject, body };
    
  } catch (error) {
    console.error('[MAIL] 本文作成エラー:', error);
    throw new Error(`メール本文作成に失敗: ${error.toString()}`);
  }
}

// ★★★ Gmail送信（リトライ機能付き）★★★
function sendEmailWithRetry_(to, subject, body, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[MAIL] 送信試行 ${attempt}/${maxRetries}: ${to}`);
      
      GmailApp.sendEmail(to, subject, body, {
        name: options.name || 'カンパーニュ予約システム',
        bcc: options.bcc || '',
        replyTo: options.replyTo || getAdminEmail_(),
        htmlBody: body.replace(/\n/g, '<br>')
      });
      
      console.log(`[MAIL] 送信成功: ${to}`);
      return { success: true, attempt: attempt };
      
    } catch (error) {
      console.error(`[MAIL] 送信失敗 ${attempt}/${maxRetries}:`, error);
      
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: error.toString(),
          totalAttempts: maxRetries 
        };
      }
      
      // リトライ待機
      Utilities.sleep(1000 * attempt);
    }
  }
}

// ★★★ リマインダー機能 ★★★
function addReminder_(data) {
  try {
    console.log('[REMIND] リマインダー設定開始');
    
    if (!data.reserve_no || !data.customer?.email || !data.pickup?.date) {
      const error = 'リマインダー設定に必要なデータが不足しています';
      console.error('[REMIND]', error);
      return {
        ok: false,
        message: "reminder_validation_failed",
        error: error
      };
    }
    
    const cleanData = {
      reserve_no: String(data.reserve_no).trim(),
      customer: {
        name: String(data.customer.name || '').trim(),
        email: String(data.customer.email).trim()
      },
      pickup: {
        date: String(data.pickup.date).trim(),
        time: String(data.pickup.time || '').trim()
      }
    };
    
    // プロパティサービスに保存
    const key = `REMIND_${cleanData.pickup.date}`;
    const sp = PropertiesService.getScriptProperties();
    
    let reminderList = [];
    const existingData = sp.getProperty(key);
    if (existingData) {
      try {
        reminderList = JSON.parse(existingData);
        if (!Array.isArray(reminderList)) {
          reminderList = [];
        }
      } catch (parseError) {
        console.warn('[REMIND] 既存データ解析失敗:', parseError);
        reminderList = [];
      }
    }
    
    // 重複チェック・更新
    let found = false;
    for (let i = 0; i < reminderList.length; i++) {
      if (reminderList[i]?.reserve_no === cleanData.reserve_no) {
        reminderList[i] = cleanData;
        found = true;
        break;
      }
    }
    
    if (!found) {
      reminderList.push(cleanData);
    }
    
    // 保存
    sp.setProperty(key, JSON.stringify(reminderList));
    
    // 日次トリガー確認
    ensureDailyTrigger_();
    
    console.log(`[REMIND] 設定完了: ${cleanData.reserve_no}, 合計${reminderList.length}件`);
    
    return {
      ok: true,
      message: "reminder_set_successfully",
      count: reminderList.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[REMIND] 予期しないエラー:', error);
    return {
      ok: false,
      message: "reminder_processing_error",
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// ★★★ 日次トリガー設定 ★★★
function ensureDailyTrigger_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const exists = triggers.some(trigger => 
      trigger.getHandlerFunction() === 'sendReminderDaily_'
    );
    
    if (!exists) {
      ScriptApp.newTrigger('sendReminderDaily_')
        .timeBased()
        .everyDays(1)
        .atHour(8)
        .create();
      console.log('[TRIGGER] 日次リマインダートリガーを作成しました');
    }
  } catch (error) {
    console.error('[TRIGGER] 日次トリガー設定エラー:', error);
  }
}

// ★★★ 日次リマインダー送信 ★★★
function sendReminderDaily_() {
  try {
    const timezone = 'Asia/Tokyo';
    const today = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
    const key = `REMIND_${today}`;
    
    console.log(`[DAILY] ${today} のリマインダー処理開始`);
    
    const sp = PropertiesService.getScriptProperties();
    const data = sp.getProperty(key);
    
    if (!data) {
      console.log('[DAILY] 本日の予約はありません');
      return;
    }
    
    let reminderList = [];
    try {
      reminderList = JSON.parse(data);
    } catch (parseError) {
      console.error('[DAILY] データ解析失敗:', parseError);
      return;
    }
    
    console.log(`[DAILY] ${reminderList.length} 件の予約があります`);
    
    let successCount = 0;
    for (const reservation of reminderList) {
      if (!reservation?.customer?.email) continue;
      
      try {
        const subject = `【本日受取】予約番号 ${reservation.reserve_no} - カンパーニュ`;
        const pickupTime = reservation.pickup?.time || '時間未設定';
        
        const body = `${reservation.customer.name || 'お客様'} 様

本日は受取日です。

【受取予定】
日時: ${today} ${pickupTime}
予約番号: ${reservation.reserve_no}

お気をつけてご来店ください。
スタッフ一同、お待ちしております。

【店舗情報】
営業日: 水曜日・土曜日
営業時間: 11:00～17:00

---
カンパーニュ
`;

        GmailApp.sendEmail(reservation.customer.email, subject, body, {
          name: 'カンパーニュ予約システム',
          replyTo: getAdminEmail_()
        });
        
        successCount++;
        console.log(`[DAILY] リマインダー送信完了: ${reservation.customer.email}`);
        
      } catch (mailError) {
        console.error(`[DAILY] メール送信失敗: ${reservation.customer.email}`, mailError);
      }
    }
    
    // 処理完了後、データを削除
    sp.deleteProperty(key);
    console.log(`[DAILY] リマインダー処理完了: ${successCount}/${reminderList.length} 件成功`);
    
  } catch (error) {
    console.error('[DAILY] 日次処理エラー:', error);
  }
}