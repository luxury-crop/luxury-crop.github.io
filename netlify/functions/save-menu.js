/* ============================================================
   save-menu — Netlify Function
   Receives the admin dashboard's current menu JSON and commits it
   permanently to data/menu.json on the live GitHub Pages repo, via
   GitHub's Contents API. The GitHub write token lives only here
   (server-side env var) and is never exposed to the browser; the
   browser only carries a low-stakes shared key that gates this
   endpoint (see ADMIN_PUBLISH_KEY).
   ============================================================ */
'use strict';

const OWNER = 'luxury-crop';
const REPO = 'luxury-crop.github.io';
const BRANCH = 'main';
const FILE_PATH = 'data/menu.json';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_ORIGINS = ['https://luxury-crop.github.io', 'http://localhost:5050'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

exports.handler = async function (event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const cors = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const adminKey = process.env.ADMIN_PUBLISH_KEY;
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  if (!adminKey || auth !== 'Bearer ' + adminKey) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'غير مصرح' }) };
  }

  if (!event.body || event.body.length > MAX_BYTES) {
    return { statusCode: 413, headers: cors, body: JSON.stringify({ error: 'البيانات كبيرة جدًا' }) };
  }

  let menu;
  try { menu = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'JSON غير صالح' }) };
  }
  if (!menu || typeof menu !== 'object' || !Array.isArray(menu.categories)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'بنية المنيو غير صالحة' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'الخادم غير مهيأ' }) };
  }

  const apiUrl = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + FILE_PATH;
  const ghHeaders = {
    Authorization: 'Bearer ' + token,
    'User-Agent': 'luxury-crop-menu-admin',
    Accept: 'application/vnd.github+json',
  };

  try {
    const getRes = await fetch(apiUrl + '?ref=' + BRANCH, { headers: ghHeaders });
    if (!getRes.ok) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'تعذّر قراءة الملف الحالي من GitHub' }) };
    }
    const cur = await getRes.json();

    const content = Buffer.from(JSON.stringify(menu, null, 2), 'utf-8').toString('base64');
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders),
      body: JSON.stringify({
        message: 'تحديث المنيو من لوحة الإدارة',
        content: content,
        sha: cur.sha,
        branch: BRANCH,
      }),
    });
    if (!putRes.ok) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'تعذّر النشر على GitHub' }) };
    }
    const putJson = await putRes.json();
    return {
      statusCode: 200,
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors),
      body: JSON.stringify({ ok: true, commit: putJson.commit && putJson.commit.sha }),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'خطأ غير متوقع' }) };
  }
};
