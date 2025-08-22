function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function corsResponse_(content) {
  return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    console.log('doGet開始');
    
    var key = '';
    var path = '';
    var data = '';
    
    if (e && e.parameter) {
      key = String(e.parameter.key || '');
      path = String(e.parameter.path || '');
      data = String(e.parameter.data || '');
    }
    
    if (key && path) {
      console.log('API呼び出し: ' + path);
      
      var expect = PropertiesService.getScriptProperties().getProperty('API_KEY');
      if (!key || key !== expect) {
        console.error('認証失敗');
        return corsResponse_('{"ok":false,"message":"unauthorized"}');
      }
      
      var body = {};
      if (data) {
        try {
          body = JSON.parse(data);
        } catch (err) {
          console.error('データ解析エラー: ' + err.toString());
          return corsResponse_('{"ok":false,"message":"invalid_data"}');
        }
      }
      
      var result;
      if (path === 'mail') {
        result = sendReservationMail_(body);
      } else if (path === 'remind') {
        result = addReminder_(body);
      } else {
        result = json_({"ok":false,"message":"not_found"});
      }
      
      return corsResponse_(result.getContent());
    }
    
    console.log('管理画面表示');
    return HtmlService.createTemplateFromFile('AdminIndex').evaluate().setTitle('管理ダッシュボード').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
  } catch (error) {
    console.error('doGetエラー: ' + error.toString());
    return corsResponse_('{"ok":false,"message":"get_error","error":"' + error.toString() + '"}');
  }
}

function doPost(e) {
  try {
    console.log('doPost開始');
    
    var key = '';
    var path = '';
    var body = {};
    
    if (e && e.parameter) {
      key = String(e.parameter.key || '');
      path = String(e.parameter.path || '');
      
      if (e.parameter.method === 'OPTIONS') {
        return corsResponse_('{"ok":true,"message":"options_ok"}');
      }
      
      if (e.parameter.data) {
        try {
          body = JSON.parse(e.parameter.data);
        } catch (err) {
          console.error('パラメータデータ解析エラー: ' + err.toString());
        }
      }
    }
    
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        console.error('POSTデータ解析エラー: ' + err.toString());
      }
    }
    
    var expect = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || key !== expect) {
      console.error('認証失敗');
      return corsResponse_('{"ok":false,"message":"unauthorized"}');
    }
    
    console.log('処理開始: ' + path);
    
    var result;
    if (path === 'mail') {
      result = sendReservationMail_(body);
    } else if (path === 'remind') {
      result = addReminder_(body);
    } else {
      result = json_({"ok":false,"message":"not_found"});
    }
    
    return corsResponse_(result.getContent());
    
  } catch (error) {
    console.error('doPostエラー: ' + error.toString());
    return corsResponse_('{"ok":false,"message":"server_error","error":"' + error.toString() + '"}');
  }
}