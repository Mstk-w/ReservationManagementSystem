function doGet() {
  return HtmlService.createTemplateFromFile('AdminIndex').evaluate()
    .setTitle('管理ダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const key = String(e.parameter.key || '');
  const expect = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || key !== expect) return json_({ ok:false, message:'unauthorized' });

  const path = String(e.parameter.path || '');
  const body = e.postData ? JSON.parse(e.postData.contents) : {};
  if (path === 'mail')   return sendReservationMail_(body);
  if (path === 'remind') return addReminder_(body);
  return json_({ ok:false, message:'not_found' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
