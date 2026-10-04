// デプロイのアクセス範囲は必ず「自分のみ」。公開HTMLには認証情報を置かない。
const FOLDER_ID = '1VVHiJ0bE0sP0saDTewDyaPR6wurON2lQ';
function ownerOnly_() {
  const active = Session.getActiveUser().getEmail();
  const owner = Session.getEffectiveUser().getEmail();
  if (!active || active !== owner) throw new Error('所有者のGoogleアカウントで開いてください。');
}
function doGet(e) {
  ownerOnly_();
  const t = HtmlService.createTemplateFromFile('Index');
  t.issue = /^\d{4}-\d{2}-\d{2}$/.test(String(e && e.parameter.issue || '')) ? e.parameter.issue : '';
  return t.evaluate().setTitle('AIニュースへの一言').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function saveFeedback(input) {
  ownerOnly_();
  input = input || {};
  const text = String(input.text || '').trim();
  const id = String(input.id || '');
  if (!text || text.length > 3000) throw new Error('一言は1〜3000文字で入力してください。');
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) throw new Error('送信情報が不正です。画面を開き直してください。');
  const kind = ['ニュースの希望', '表示の改善', '両方'].includes(input.kind) ? input.kind : 'ニュースの希望';
  const duration = input.duration === '継続' ? '継続' : '次回のみ';
  const issue = /^\d{4}-\d{2}-\d{2}$/.test(input.issue || '') ? input.issue : '指定なし';
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    // 再送・ダブルクリックでは同じ文書を返す。原文は公開しない。
    const name = 'AIニュース要望_' + id;
    const existing = folder.getFilesByName(name);
    if (existing.hasNext()) return {url: existing.next().getUrl()};
    const doc = DocumentApp.create(name);
    const file = DriveApp.getFileById(doc.getId());
    try {
      doc.getBody().setText([
        'AIニュースへの要望',
        '形式: ai-news-feedback-v1',
        '受付ID: ' + id,
        '受付日時: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') + ' JST',
        '対象号: ' + issue,
        '種別: ' + kind,
        '適用期間: ' + duration,
        '収集対応: 未対応',
        '表示対応: 未対応',
        '', '【要望本文】', text, '【要望本文ここまで】',
        '', '【対応履歴】', '未対応。各タスクが実際の対応結果を追記する。'
      ].join('\n'));
      doc.saveAndClose();
      file.moveTo(folder);
      return {url: file.getUrl()};
    } catch (error) {
      // 中途半端な文書を残して再送時に成功と誤認しない。
      try { doc.saveAndClose(); file.setTrashed(true); } catch (_) {}
      throw new Error('保存できませんでした。入力内容を残したまま再送してください。');
    }
  } finally { lock.releaseLock(); }
}
