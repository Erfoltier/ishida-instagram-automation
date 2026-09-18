/**
 * Staff review page for Instagram drafts. Runs on Cloudflare Workers (free tier),
 * so there is no always-on server to pay for — this is a thin, stateless proxy
 * in front of the same GitHub Issues + repo files the Actions pipeline already
 * uses as its source of truth. Nothing here duplicates business logic: approve
 * just posts the same "approve" comment a human would type on the Issue, edit
 * just triggers the same regenerate-slide.yml workflow used everywhere else.
 */

const APPROVAL_LABEL = "instagram-draft";

function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isAuthed(request, env) {
  return cookieValue(request, "staff_auth") === env.STAFF_PASSCODE;
}

async function ghFetch(env, path, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      // GitHub's REST API rejects requests with no User-Agent (403); Workers' fetch doesn't set one by default.
      "user-agent": "ishida-instagram-staff-worker",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

function extractDraftId(issueBody) {
  const match = issueBody.match(/<!-- draft-id: (.+?) -->/);
  return match ? match[1] : null;
}

function rawUrl(env, relativePath) {
  return `https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/main/${relativePath}?v=${Date.now()}`;
}

async function listDrafts(env) {
  const issues = await ghFetch(env, `/issues?labels=${APPROVAL_LABEL}&state=open&per_page=20`);
  const drafts = [];
  for (const issue of issues) {
    const draftId = extractDraftId(issue.body || "");
    if (!draftId) continue;
    const manifestResponse = await fetch(rawUrl(env, `drafts/${draftId}/manifest.json`));
    if (!manifestResponse.ok) continue;
    const manifest = await manifestResponse.json();
    drafts.push({
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      draftId: manifest.draftId,
      subject: manifest.subject,
      caption: manifest.caption,
      hashtags: manifest.hashtags,
      complianceNotes: manifest.complianceNotes,
      slides: manifest.slides
        .sort((a, b) => a.order - b.order)
        .map(slide => ({ ...slide, imageUrl: rawUrl(env, `drafts/${draftId}/${slide.fileName}`) })),
    });
  }
  return drafts;
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json", ...init.headers } });
}

async function handleApi(request, env, url) {
  if (!isAuthed(request, env)) return jsonResponse({ error: "unauthorized" }, { status: 401 });

  if (url.pathname === "/api/drafts" && request.method === "GET") {
    return jsonResponse(await listDrafts(env));
  }

  if (url.pathname === "/api/drafts/approve" && request.method === "POST") {
    const { issueNumber } = await request.json();
    await ghFetch(env, `/issues/${issueNumber}/comments`, { method: "POST", body: JSON.stringify({ body: "approve" }) });
    return jsonResponse({ ok: true });
  }

  if (url.pathname === "/api/drafts/reject" && request.method === "POST") {
    const { issueNumber, reason } = await request.json();
    await ghFetch(env, `/issues/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: `却下: ${reason || "(理由なし)"}` }),
    });
    await ghFetch(env, `/issues/${issueNumber}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    return jsonResponse({ ok: true });
  }

  if (url.pathname === "/api/drafts/generate" && request.method === "POST") {
    await ghFetch(env, "/actions/workflows/generate.yml/dispatches", {
      method: "POST",
      body: JSON.stringify({ ref: "main" }),
    });
    return jsonResponse({ ok: true, note: "生成には1〜2分ほどかかります。" });
  }

  if (url.pathname === "/api/drafts/edit" && request.method === "POST") {
    const { draftId, order, title, body } = await request.json();
    if (!draftId || !order || !title || !body) return jsonResponse({ error: "draftId, order, title, bodyは必須です。" }, { status: 400 });
    await ghFetch(env, "/actions/workflows/regenerate-slide.yml/dispatches", {
      method: "POST",
      body: JSON.stringify({ ref: "main", inputs: { draft_id: draftId, slide_order: String(order), slide_title: title, slide_body: body } }),
    });
    return jsonResponse({ ok: true, note: "再生成には30秒〜1分ほどかかります。" });
  }

  return jsonResponse({ error: "not found" }, { status: 404 });
}

const PAGE_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>いしだ皮フ科 Instagram投稿案 確認</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; background: #FBFAF6; color: #1F292E; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  .card { background: #fff; border: 1px solid #E9E3D4; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .slide { display: flex; gap: 12px; align-items: flex-start; border-top: 1px solid #eee; padding: 12px 0; }
  .slide img { width: 120px; height: 120px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
  .slide-text { flex: 1; min-width: 0; }
  .slide-text .order { font-size: 12px; color: #B8A060; font-weight: 700; }
  textarea, input[type=text] { width: 100%; font-family: inherit; font-size: 14px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
  button { font-family: inherit; font-size: 14px; padding: 8px 16px; border-radius: 8px; border: 1px solid #3D6270; background: #fff; color: #3D6270; cursor: pointer; }
  button.primary { background: #3D6270; color: #fff; }
  button.danger { border-color: #a33; color: #a33; }
  button:disabled { opacity: 0.5; cursor: default; }
  .actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
  .caption { white-space: pre-wrap; font-size: 14px; background: #FBFAF6; padding: 12px; border-radius: 8px; }
  #login { max-width: 320px; margin: 80px auto; }
  #app { display: none; }
  .status { font-size: 13px; color: #3D6270; }
  .subject { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .list-item { display: flex; gap: 12px; align-items: center; cursor: pointer; }
  .list-item img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
  .list-item .meta { flex: 1; min-width: 0; }
  .back-link { background: none; border: none; color: #3D6270; padding: 0 0 12px; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>

<div id="login">
  <h1>スタッフ確認画面</h1>
  <p>合言葉を入力してください。</p>
  <input type="password" id="passcode" placeholder="合言葉">
  <div class="actions"><button class="primary" onclick="doLogin()">入る</button></div>
  <p class="status" id="login-status"></p>
</div>

<div id="app">
  <h1>Instagram投稿案 確認</h1>
  <div id="drafts"></div>
</div>

<script>
async function doLogin() {
  const passcode = document.getElementById('passcode').value;
  const res = await fetch('/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ passcode }) });
  if (res.ok) { document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block'; loadDrafts(); }
  else document.getElementById('login-status').textContent = '合言葉が違います。';
}

let draftsCache = [];
let selectedDraftId = null;

async function loadDrafts() {
  const container = document.getElementById('drafts');
  try {
    const res = await fetch('/api/drafts');
    if (res.status === 401) { document.getElementById('login').style.display = 'block'; document.getElementById('app').style.display = 'none'; return; }
    const data = await res.json();
    if (!res.ok) { container.innerHTML = '<p>エラー: ' + escapeHtml(data.error || res.status) + '</p>'; return; }
    draftsCache = Array.isArray(data) ? data : [];
    renderView();
  } catch (err) {
    container.innerHTML = '<p>読み込みエラー: ' + escapeHtml(String(err)) + '</p>';
  }
}

function renderView() {
  const container = document.getElementById('drafts');
  const draft = selectedDraftId && draftsCache.find(d => d.draftId === selectedDraftId);
  if (draft) {
    container.innerHTML = '<button class="back-link" onclick="backToList()">← 一覧に戻る</button>' + renderDraft(draft);
    return;
  }
  selectedDraftId = null;
  const header = \`<div class="actions" style="margin-bottom:16px;">
    <button class="primary" onclick="generateNew()">＋ 新規草稿を作成</button>
    <button onclick="loadDrafts()">更新</button>
  </div>\`;
  const list = draftsCache.length === 0
    ? '<p>承認待ちの投稿案はありません。</p>'
    : draftsCache.map(renderListItem).join('');
  container.innerHTML = header + list;
}

function renderListItem(draft) {
  const cover = draft.slides.find(s => s.kind === 'cover') || draft.slides[0];
  return \`
  <div class="card list-item" onclick="viewDraft('\${draft.draftId}')">
    \${cover ? \`<img src="\${cover.imageUrl}" alt="cover">\` : ''}
    <div class="meta">
      <div class="subject">\${escapeHtml(draft.subject)}</div>
      <div class="status">Issue #\${draft.issueNumber} ・ \${draft.slides.length}枚</div>
    </div>
    <button onclick="event.stopPropagation(); viewDraft('\${draft.draftId}')">詳しく見る</button>
  </div>\`;
}

function viewDraft(draftId) { selectedDraftId = draftId; renderView(); }
function backToList() { selectedDraftId = null; renderView(); }

async function generateNew() {
  if (!confirm('新しい投稿案の生成をリクエストします。1〜2分ほどかかります。よろしいですか？')) return;
  const res = await fetch('/api/drafts/generate', { method: 'POST' });
  if (!res.ok) { alert('エラー: ' + (await res.json()).error); return; }
  alert('生成をリクエストしました。1〜2分ほど待ってから「更新」を押してください。');
}

function renderDraft(draft) {
  const slidesHtml = draft.slides.map(slide => \`
    <div class="slide" id="slide-\${draft.draftId}-\${slide.order}">
      <img src="\${slide.imageUrl}" alt="slide \${slide.order}">
      <div class="slide-text">
        <div class="order">\${slide.order}枚目 (\${slide.kind})</div>
        \${slide.kind === 'cta' ? \`<p>\${escapeHtml(slide.title)} / \${escapeHtml(slide.body)}</p><p class="status">最終ページは固定文言のため編集できません</p>\` : \`
        <input type="text" value="\${escapeAttr(slide.title)}" id="title-\${draft.draftId}-\${slide.order}">
        <textarea rows="2" id="body-\${draft.draftId}-\${slide.order}">\${escapeHtml(slide.body)}</textarea>
        <div class="actions">
          <button onclick="editSlide('\${draft.draftId}', \${slide.order})">保存して再生成</button>
        </div>
        <p class="status" id="edit-status-\${draft.draftId}-\${slide.order}"></p>
        \`}
      </div>
    </div>\`).join('');

  return \`
  <div class="card">
    <div class="subject">\${escapeHtml(draft.subject)}</div>
    \${slidesHtml}
    <p><strong>キャプション</strong></p>
    <div class="caption">\${escapeHtml(draft.caption)}\n\n\${draft.hashtags.join(' ')}</div>
    <p><strong>医療広告配慮メモ</strong>: \${escapeHtml(draft.complianceNotes)}</p>
    <div class="actions">
      <button class="primary" onclick="approve(\${draft.issueNumber})">承認してInstagramへ公開</button>
      <button class="danger" onclick="reject(\${draft.issueNumber})">却下</button>
      <a href="\${draft.issueUrl}" target="_blank" style="align-self:center;font-size:13px;">GitHub Issueで見る</a>
    </div>
  </div>\`;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }

// statusEl is looked up fresh by id every time it's touched, never held across a
// loadDrafts() call — loadDrafts() replaces the container's innerHTML, which
// detaches any previously-fetched element reference from the visible page.
function statusElFor(draftId, order) {
  return document.getElementById(\`edit-status-\${draftId}-\${order}\`);
}

async function editSlide(draftId, order) {
  const title = document.getElementById(\`title-\${draftId}-\${order}\`).value;
  const body = document.getElementById(\`body-\${draftId}-\${order}\`).value;
  statusElFor(draftId, order).textContent = '再生成をリクエストしました。30秒〜1分ほどお待ちください…';
  const res = await fetch('/api/drafts/edit', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ draftId, order, title, body }) });
  if (!res.ok) { statusElFor(draftId, order).textContent = 'エラー: ' + (await res.json()).error; return; }
  setTimeout(() => pollForUpdate(draftId, order, title), 15000);
}

async function pollForUpdate(draftId, order, expectedTitle, attempt = 0) {
  const status = statusElFor(draftId, order);
  if (attempt > 8) { if (status) status.textContent = '反映確認がタイムアウトしました。ページを再読み込みしてください。'; return; }
  await loadDrafts();
  const img = document.querySelector(\`#slide-\${draftId}-\${order} img\`);
  if (img) img.src = img.src.split('?')[0] + '?v=' + Date.now();
  const titleInput = document.getElementById(\`title-\${draftId}-\${order}\`);
  if (titleInput && titleInput.value === expectedTitle) return;
  setTimeout(() => pollForUpdate(draftId, order, expectedTitle, attempt + 1), 8000);
}

async function approve(issueNumber) {
  if (!confirm('この内容でInstagramへ公開します。よろしいですか？')) return;
  await fetch('/api/drafts/approve', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ issueNumber }) });
  alert('承認しました。数十秒後にInstagramへ公開されます。');
  loadDrafts();
}

async function reject(issueNumber) {
  const reason = prompt('却下理由（任意）');
  if (reason === null) return;
  await fetch('/api/drafts/reject', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ issueNumber, reason }) });
  loadDrafts();
}

loadDrafts();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/login" && request.method === "POST") {
        const { passcode } = await request.json();
        if (passcode !== env.STAFF_PASSCODE) return jsonResponse({ error: "invalid" }, { status: 401 });
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": `staff_auth=${encodeURIComponent(passcode)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
          },
        });
      }

      if (url.pathname.startsWith("/api/")) {
        try {
          return await handleApi(request, env, url);
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
        }
      }

      return new Response(PAGE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (error) {
      // Surface the real cause instead of Cloudflare's generic blank error page.
      return new Response(`Worker error: ${error instanceof Error ? error.stack : String(error)}`, { status: 500 });
    }
  },
};
