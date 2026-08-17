import "./styles.css";
import {
  identities,
  regions,
  topics,
  policies,
  opportunities,
  guides,
  briefs,
} from "./data.js";
import {
  applyWindows,
  crawlSources,
  expandSources,
  policyUrls,
} from "./sources.js";
import {
  loadState,
  saveState,
  unreadCount,
  matchesUser,
  scoreItem,
  topicName,
  markRead,
  markAllRead,
  toggleSave,
  isSaved,
  toggleTopic,
  pushAlert,
} from "./store.js";
import { resolveDeadline, deadlineStamp } from "./deadline.js";

const app = document.getElementById("app");
let state = loadState();
let toastTimer;
let liveFeed = { fetchedAt: "", itemCount: 0, sources: [], items: [] };
let refreshing = false;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = hash.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryString || ""));
  const parts = path.split("/").filter(Boolean);
  return { path: "/" + parts.join("/"), parts, query };
}

function go(to) {
  location.hash = to;
}

function toast(text) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

function iconBell() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 1 1 12 0c0 7 2 8 2 8H4s2-1 2-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
}

function iconUser() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.6-3 4-4.5 7-4.5S17.4 16 19 19"/></svg>`;
}

function tabs(active) {
  const items = [
    ["/", "首页"],
    ["/policies", "政策"],
    ["/opps", "机会"],
    ["/me", "我的"],
  ];
  return `<nav class="tabs">${items
    .map(
      ([href, label]) =>
        `<a href="#${href}" class="${active === href ? "active" : ""}">${label}</a>`
    )
    .join("")}</nav>`;
}

function shell(active, inner, { title = "绿复通", back } = {}) {
  const n = unreadCount(state);
  return `<div class="phone">
    <header class="topbar">
      <div class="brand">
        ${back ? `<a class="back" href="#${back}">返回</a>` : ""}
        <b>${title}</b>
        <span>修复 · 林下 · 工程复合</span>
      </div>
      <div class="top-actions">
        <a class="icon-btn" href="#/alerts" aria-label="推送">${iconBell()}${
          n ? `<span class="badge">${n}</span>` : ""
        }</a>
        <a class="icon-btn" href="#/me" aria-label="我的">${iconUser()}</a>
      </div>
    </header>
    <main class="page">${inner}</main>
    ${tabs(active)}
  </div>`;
}

function identityName() {
  return identities.find((i) => i.id === state.identity)?.name || "未选择身份";
}

function ranked(list) {
  return [...list]
    .map((item) => ({ item, score: scoreItem(item, state) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

function liveIdentities(topicIds = []) {
  const map = {
    mine: ["contractor", "design", "gov"],
    understory: ["coop", "design", "gov"],
    eod: ["investor", "gov", "design", "contractor"],
    fund: ["gov", "contractor"],
    landscape: ["gov", "contractor", "design"],
    pv: ["investor", "contractor", "design"],
  };
  return [...new Set(topicIds.flatMap((t) => map[t] || []))];
}

function normalizeLive(item) {
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    date: item.date || "抓取",
    region: item.region,
    topics: item.topics || [],
    kind: item.kind || "新发",
    urgency: "normal",
    identities: liveIdentities(item.topics),
    summary: `来自${item.source}。点开可到官方页面核对是否仍在窗口期内。`,
    points: [],
    who: "以官方原文为准。",
    trap: "列表页标题不能代替申报指南，务必打开原文。",
    overlay: "若与修复工程或林下经营有关，对照首页申报窗口看该从哪一级报。",
    url: item.url,
    live: true,
  };
}

function officialUrl(p) {
  return p.url || policyUrls[p.id] || "";
}

function allPolicies() {
  const curatedUrls = new Set(Object.values(policyUrls));
  const extra = liveFeed.items
    .filter((it) => !curatedUrls.has(it.url))
    .map(normalizeLive);
  return [...policies, ...extra];
}

function policyById(id) {
  return allPolicies().find((x) => x.id === id);
}

function policyCard(p) {
  const url = officialUrl(p);
  const mark = resolveDeadline(p);
  return `<a class="card" href="#/policy/${encodeURIComponent(p.id)}">
    <div class="meta">
      <span class="tag">${esc(p.kind)}</span>
      <span>${esc(p.region)}</span>
      <span>${esc(p.date)}</span>
      ${p.live ? `<span class="urgent">新抓取</span>` : ""}
    </div>
    <div class="title">${esc(p.title)}</div>
    ${deadlineStamp(mark)}
    <p class="summary">${esc(p.summary)}</p>
    ${url ? `<span class="ext-link">官方窗口 · 点开详情再跳转</span>` : ""}
  </a>`;
}

function oppCard(o) {
  const mark = resolveDeadline(o);
  return `<a class="card" href="#/opp/${o.id}">
    <div class="meta">
      <span class="tag">${esc(o.mode)}</span>
      <span>${esc(o.region)}</span>
    </div>
    <div class="title">${esc(o.title)}</div>
    ${deadlineStamp(mark)}
    <p class="summary">${esc(o.matchHint)}</p>
  </a>`;
}

function windowCard(w) {
  const mark = resolveDeadline(w);
  return `<a class="card" href="${esc(w.url)}" target="_blank" rel="noopener">
    <div class="meta">
      <span class="tag">${esc(w.region)}</span>
    </div>
    <div class="title">${esc(w.title)}</div>
    ${deadlineStamp(mark)}
    <p class="summary">${esc(w.via)}</p>
    <span class="ext-link">打开官方页面</span>
  </a>`;
}

function matchedWindows() {
  return applyWindows
    .filter((w) => {
      const regionOk =
        state.region === "全国" || w.region === "全国" || w.region === state.region;
      const topicOk = w.topics.some((t) => state.topics.includes(t));
      return regionOk && topicOk;
    })
    .sort((a, b) => resolveDeadline(a).sort - resolveDeadline(b).sort);
}

function syncLabel() {
  if (!liveFeed.fetchedAt) return "尚未抓取官方列表";
  const d = new Date(liveFeed.fetchedAt);
  if (Number.isNaN(d.getTime())) return "尚未抓取官方列表";
  return `数据源 ${d.toLocaleString("zh-CN", { hour12: false })} · ${liveFeed.itemCount} 条新标题`;
}

function renderHome() {
  const list = allPolicies();
  const feed = ranked(list.filter((p) => matchesUser(p, state))).slice(0, 4);
  const opps = ranked(opportunities.filter((o) => matchesUser(o, state))).slice(0, 3);
  const wins = matchedWindows().slice(0, 4);
  const inner = `
    <p class="kicker">策报</p>
    <h1>按你的身份推政策，按工程接口找机会。</h1>
    <p class="lead">卡片上的绿色是申报未过，红色是申报已过。滚动入库按未过计。</p>
    <div class="row">
      <button class="chip ${state.identity ? "on" : ""}" data-open-onboard>${esc(identityName())}</button>
      <button class="chip on" data-open-onboard>${esc(state.region)}</button>
    </div>
    <div class="stat-row">
      <div class="stat"><b>${list.length}</b><span>条政策口径</span></div>
      <div class="stat"><b>${applyWindows.length}</b><span>个申报窗口</span></div>
      <div class="stat"><b>${unreadCount(state)}</b><span>条未读推送</span></div>
    </div>
    <div class="sync-bar">
      <span>${esc(syncLabel())}</span>
      <button class="link" data-refresh>${refreshing ? "刷新中" : "刷新数据源"}</button>
    </div>
    <div class="hero-stamp">
      <div class="kicker">怎么用</div>
      <p>先定身份和地区，再订主题。政策卡片点进去可跳转官方原文；申报窗口直接打开县局、省厅或财政部页面。数据源每天抓一次列表页，看有没有新标题。</p>
    </div>
    <div class="card flat">
      ${briefs
        .map(
          (b) => `<div class="brief">
            <div class="kicker">${esc(b.kicker)}</div>
            <div class="title">${esc(b.title)}</div>
            <p class="summary">${esc(b.text)}</p>
          </div>`
        )
        .join("")}
    </div>
    <div class="list-head"><h2>真实申报窗口</h2><a class="link" href="#/windows">全部</a></div>
    ${wins.map(windowCard).join("") || `<p class="empty">当前身份和地区没有对上的窗口。</p>`}
    <div class="list-head"><h2>匹配到你的政策</h2><a class="link" href="#/policies">全部</a></div>
    ${feed.map(policyCard).join("")}
    <div class="list-head"><h2>工程 + 农林接口</h2><a class="link" href="#/opps">全部</a></div>
    ${opps.map(oppCard).join("")}
    <p class="section-label">申报工具</p>
    ${guides
      .filter((g) => !state.identity || g.for.includes(state.identity))
      .map(
        (g) => `<a class="card" href="#/guide/${g.id}">
          <div class="title">${esc(g.title)}</div>
          <p class="summary">按步骤核对，不写空泛建议。</p>
        </a>`
      )
      .join("")}
    <p class="section-label"><a class="link" href="#/sources">数据源与可拓展清单</a></p>
  `;
  app.innerHTML = shell("/", inner);
  app.querySelectorAll("[data-open-onboard]").forEach((el) => {
    el.onclick = () => showOnboard(true);
  });
  app.querySelector("[data-refresh]").onclick = () => refreshNow();
  if (!state.onboarded) showOnboard(false);
}

function showOnboard(manual) {
  const wrap = document.createElement("div");
  wrap.className = "sheet";
  wrap.innerHTML = `<div class="panel">
    <p class="kicker">订阅设置</p>
    <h1>${manual ? "调整身份和地区" : "先告诉我你是谁"}</h1>
    <p class="lead">推送按身份过滤。合作社不会收到5亿总包招标，施工企业会优先看到矿山和山水工程。</p>
    <div class="id-grid">
      ${identities
        .map(
          (i) => `<button type="button" data-id="${i.id}" class="${
            state.identity === i.id ? "on" : ""
          }">${esc(i.name)}<small>${esc(i.hint)}</small></button>`
        )
        .join("")}
    </div>
    <div class="region-row">
      <select data-region>
        ${regions
          .map((r) => `<option ${r === state.region ? "selected" : ""}>${r}</option>`)
          .join("")}
      </select>
    </div>
    <div class="action-bar">
      <button class="btn" data-done>开始用</button>
    </div>
  </div>`;
  app.appendChild(wrap);
  wrap.querySelectorAll("[data-id]").forEach((btn) => {
    btn.onclick = () => {
      state = { ...state, identity: btn.dataset.id };
      wrap.querySelectorAll("[data-id]").forEach((b) => b.classList.toggle("on", b === btn));
    };
  });
  wrap.querySelector("[data-region]").onchange = (e) => {
    state = { ...state, region: e.target.value };
  };
  wrap.querySelector("[data-done]").onclick = () => {
    if (!state.identity) {
      toast("请先选一个身份");
      return;
    }
    state = { ...state, onboarded: true };
    saveState(state);
    maybePushWelcome();
    wrap.remove();
    render();
  };
  if (manual) {
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) wrap.remove();
    });
  }
}

function maybePushWelcome() {
  const id = `welcome-${state.identity}-${state.region}`;
  if (state.alerts.some((a) => a.id === id)) return;
  const name = identityName();
  state = pushAlert(state, {
    id,
    topic: state.topics[0] || "fund",
    title: `已按「${name} · ${state.region}」打开推送`,
    body: "之后只推你订的主题。可在「我的」里增减矿山、林下、EOD、林光。",
    date: new Date().toISOString().slice(0, 10),
  });
}

function renderPolicies() {
  const { query } = route();
  const q = (query.q || "").trim();
  const topic = query.topic || "";
  let list = ranked(allPolicies());
  if (topic) list = list.filter((p) => p.topics.includes(topic));
  if (q) list = list.filter((p) => `${p.title}${p.summary}${p.source}`.includes(q));
  const inner = `
    <p class="kicker">政策库</p>
    <h1>申报口径，不是新闻摘要。</h1>
    <p class="lead">每条都标了申报已过或未过。有截止日期的按今天计算。</p>
    <input class="search" placeholder="搜矿山、林下、EOD、奖补" value="${esc(q)}" data-search />
    <div class="filter-scroll">
      <a class="chip ${!topic ? "on" : ""}" href="#/policies">全部</a>
      ${topics
        .map(
          (t) =>
            `<a class="chip ${topic === t.id ? "on" : ""}" href="#/policies?topic=${t.id}">${esc(t.name)}</a>`
        )
        .join("")}
    </div>
    ${list.map(policyCard).join("") || `<p class="empty">没有匹配的政策。</p>`}
  `;
  app.innerHTML = shell("/policies", inner);
  const input = app.querySelector("[data-search]");
  input?.addEventListener("change", () => {
    const v = encodeURIComponent(input.value.trim());
    go(`/policies?q=${v}${topic ? `&topic=${topic}` : ""}`);
  });
}

function renderPolicy(id) {
  const p = policyById(id);
  if (!p) return renderNotFound();
  const saved = isSaved(state, "policy", p.id);
  const url = officialUrl(p);
  const mark = resolveDeadline(p);
  const inner = `
    <div class="meta">
      <span class="tag">${esc(p.kind)}</span>
      <span>${esc(p.region)}</span>
      <span>${esc(p.date)}</span>
    </div>
    <h1>${esc(p.title)}</h1>
    ${deadlineStamp(mark)}
    <p class="lead">${esc(p.source)}</p>
    <p class="summary">${esc(p.summary)}</p>
    <div class="row">${p.topics.map((t) => `<span class="chip on">${esc(topicName(t))}</span>`).join("")}</div>
    ${
      p.points?.length
        ? `<div class="block"><h3>要点</h3><ol class="points">${p.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`
        : ""
    }
    <div class="block"><h3>谁能进</h3><p>${esc(p.who)}</p></div>
    <div class="block"><h3>常见卡点</h3><p>${esc(p.trap)}</p></div>
    <div class="block"><h3>和工程 / 林下怎么叠加</h3><p>${esc(p.overlay)}</p></div>
    <div class="action-bar">
      ${
        url
          ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">打开官方窗口</a>`
          : `<button class="btn" disabled>暂无官方链接</button>`
      }
      <button class="btn ghost" data-save>${saved ? "已收藏" : "收藏"}</button>
    </div>
  `;
  app.innerHTML = shell("/policies", inner, { title: "政策", back: "/policies" });
  app.querySelector("[data-save]").onclick = () => {
    state = toggleSave(state, "policy", p.id);
    toast(isSaved(state, "policy", p.id) ? "已收藏" : "已取消");
    render();
  };
}

function renderOpps() {
  const list = ranked(opportunities).sort(
    (a, b) => resolveDeadline(a).sort - resolveDeadline(b).sort
  );
  const inner = `
    <p class="kicker">项目机会</p>
    <h1>工程做完，林下和光伏从哪接口。</h1>
    <p class="lead">绿色是申报未过，红色是申报已过。滚动入库按未过处理。</p>
    ${list.map(oppCard).join("")}
  `;
  app.innerHTML = shell("/opps", inner);
}

function renderOpp(id) {
  const o = opportunities.find((x) => x.id === id);
  if (!o) return renderNotFound();
  const saved = isSaved(state, "opp", o.id);
  const mark = resolveDeadline(o);
  const inner = `
    <div class="meta"><span class="tag">${esc(o.mode)}</span><span>${esc(o.region)}</span></div>
    <h1>${esc(o.title)}</h1>
    ${deadlineStamp(mark)}
    <p class="lead">${esc(o.scale)} · ${esc(o.status)} · ${esc(o.window)}</p>
    <p class="summary">${esc(o.matchHint)}</p>
    <div class="block"><h3>做什么</h3><ol class="points">${o.what.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
    <div class="block"><h3>谁能进</h3><p>${esc(o.whoCan)}</p></div>
    <div class="block"><h3>资金</h3><p>${esc(o.money)}</p></div>
    <div class="action-bar">
      <a class="btn" href="#/windows">去申报窗口</a>
      <button class="btn ghost" data-save>${saved ? "已收藏" : "收藏"}</button>
    </div>
  `;
  app.innerHTML = shell("/opps", inner, { title: "机会", back: "/opps" });
  app.querySelector("[data-save]").onclick = () => {
    state = toggleSave(state, "opp", o.id);
    toast(isSaved(state, "opp", o.id) ? "已收藏" : "已取消");
    render();
  };
}

function renderGuide(id) {
  const g = guides.find((x) => x.id === id);
  if (!g) return renderNotFound();
  const inner = `
    <p class="kicker">申报工具</p>
    <h1>${esc(g.title)}</h1>
    <ol class="points">${g.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="action-bar"><a class="btn" href="#/windows">打开真实申报窗口</a></div>
  `;
  app.innerHTML = shell("/", inner, { title: "工具", back: "/" });
}

function renderWindows() {
  const groups = [
    { key: "open", title: "申报未过" },
    { key: "soon", title: "尚未开始 / 窗口未开" },
    { key: "closed", title: "申报已过" },
  ];
  const inner = `
    <p class="kicker">申报窗口</p>
    <h1>每条都标明已过还是未过。</h1>
    <p class="lead">有截止日期的按今天计算。滚动入库和随时可报算未过。已过的仍留着，方便准备下一轮。</p>
    ${groups
      .map((g) => {
        const list = applyWindows
          .filter((w) => resolveDeadline(w).key === g.key)
          .sort((a, b) => resolveDeadline(a).sort - resolveDeadline(b).sort);
        if (!list.length) return "";
        return `<p class="group-label">${g.title} · ${list.length}</p>${list.map(windowCard).join("")}`;
      })
      .join("")}
  `;
  app.innerHTML = shell("/", inner, { title: "窗口", back: "/" });
}

function renderSources() {
  const statusOf = (id) => liveFeed.sources.find((s) => s.sourceId === id);
  const inner = `
    <p class="kicker">数据源</p>
    <h1>每天刷新一遍列表页，只收和修复 / 林下 / 工程复合有关的标题。</h1>
    <p class="lead">${esc(syncLabel())}。线上点刷新会读取每天定时写入的 feed.json；本地开发才会现场抓官方列表。</p>
    <div class="action-bar">
      <button class="btn" data-refresh>${refreshing ? "刷新中" : "现在刷新"}</button>
    </div>
    <p class="section-label">正在抓的</p>
    ${crawlSources
      .map((s) => {
        const st = statusOf(s.id);
        const cls = !s.active
          ? "wait"
          : st?.status === "ok"
            ? "ok"
            : st?.status === "fail"
              ? "fail"
              : "wait";
        const label = !s.active
          ? "未纳入日更"
          : st?.status === "ok"
            ? "已抓到"
            : st?.status === "empty"
              ? "无匹配标题"
              : st?.status === "fail"
                ? "失败"
                : "待抓";
        return `<a class="card" href="${esc(s.url)}" target="_blank" rel="noopener">
          <div class="meta"><span class="tag">${esc(s.region)}</span><span class="source-status ${cls}">${label}</span></div>
          <div class="title">${esc(s.name)}</div>
          <p class="summary">${esc(s.url)}</p>
        </a>`;
      })
      .join("")}
    <p class="section-label">建议拓展</p>
    ${expandSources
      .map(
        (s) => `<div class="card">
          <div class="title">${esc(s.name)}</div>
          <p class="summary">${esc(s.why)}</p>
          ${s.url ? `<a class="ext-link" href="${esc(s.url)}" target="_blank" rel="noopener">查看门户</a>` : ""}
        </div>`
      )
      .join("")}
  `;
  app.innerHTML = shell("/me", inner, { title: "数据源", back: "/me" });
  app.querySelector("[data-refresh]").onclick = () => refreshNow();
}

function renderAlerts() {
  const inner = `
    <p class="kicker">推送</p>
    <h1>只推你订过的主题。</h1>
    <p class="lead">官方列表里新出现的标题，会在每天刷新后进通知中心。</p>
    <div class="action-bar">
      <button class="btn ghost" data-all>全部已读</button>
      <button class="btn" data-refresh>刷新数据源</button>
    </div>
    ${state.alerts
      .map((a) => {
        const unread = !state.read.includes(a.id);
        const href = a.policyId
          ? `#/policy/${a.policyId}`
          : a.oppId
            ? `#/opp/${a.oppId}`
            : a.url
              ? a.url
              : "#/alerts";
        const extra = a.url && !a.policyId ? ` target="_blank" rel="noopener"` : "";
        return `<a class="card" href="${esc(href)}" data-alert="${esc(a.id)}"${extra}>
          <div class="alert-item">
            <span class="dot ${unread ? "unread" : ""}"></span>
            <div>
              <div class="meta"><span class="tag">${esc(topicName(a.topic) || a.topic)}</span><span>${esc(a.date)}</span></div>
              <div class="title">${esc(a.title)}</div>
              <p class="summary">${esc(a.body)}</p>
            </div>
          </div>
        </a>`;
      })
      .join("")}
  `;
  app.innerHTML = shell("/me", inner, { title: "推送", back: "/me" });
  app.querySelectorAll("[data-alert]").forEach((el) => {
    el.addEventListener("click", () => {
      state = markRead(state, el.dataset.alert);
    });
  });
  app.querySelector("[data-all]").onclick = () => {
    state = markAllRead(state);
    render();
  };
  app.querySelector("[data-refresh]").onclick = () => refreshNow();
}

function renderMe() {
  const savedPolicies = allPolicies().filter((p) => isSaved(state, "policy", p.id));
  const savedOpps = opportunities.filter((o) => isSaved(state, "opp", o.id));
  const inner = `
    <p class="kicker">我的</p>
    <h1>${esc(identityName())}</h1>
    <p class="lead">${esc(state.region)} · 已订 ${state.topics.length} 个主题</p>
    <div class="me-row"><span>身份 / 地区</span><button class="link" data-open-onboard>修改</button></div>
    <div class="me-row"><span>申报窗口</span><a class="link" href="#/windows">打开</a></div>
    <div class="me-row"><span>数据源</span><a class="link" href="#/sources">查看 / 刷新</a></div>
    <p class="section-label">推送主题</p>
    <div class="sub-grid">
      ${topics
        .map(
          (t) =>
            `<button type="button" data-topic="${t.id}" class="${
              state.topics.includes(t.id) ? "on" : ""
            }">${esc(t.name)}</button>`
        )
        .join("")}
    </div>
    <div class="action-bar" style="margin-top:16px">
      <a class="btn" href="#/alerts">打开通知中心</a>
    </div>
    <div class="list-head"><h2>收藏</h2></div>
    ${
      savedPolicies.map(policyCard).join("") + savedOpps.map(oppCard).join("") ||
      `<p class="empty">还没有收藏。</p>`
    }
  `;
  app.innerHTML = shell("/me", inner);
  app.querySelector("[data-open-onboard]").onclick = () => showOnboard(true);
  app.querySelectorAll("[data-topic]").forEach((btn) => {
    btn.onclick = () => {
      state = toggleTopic(state, btn.dataset.topic);
      render();
    };
  });
}

function renderNotFound() {
  app.innerHTML = shell("/", `<h1>没有这条内容</h1><p class="lead"><a class="link" href="#/">回首页</a></p>`);
}

function render() {
  const { parts } = route();
  const [a, b] = parts;
  if (!a) return renderHome();
  if (a === "policies") return renderPolicies();
  if (a === "policy" && b) return renderPolicy(decodeURIComponent(b));
  if (a === "opps") return renderOpps();
  if (a === "opp" && b) return renderOpp(b);
  if (a === "guide" && b) return renderGuide(b);
  if (a === "windows") return renderWindows();
  if (a === "sources") return renderSources();
  if (a === "alerts") return renderAlerts();
  if (a === "me") return renderMe();
  renderNotFound();
}

function seenKey() {
  return "lvfutong-seen-feed";
}

function pushNewFromFeed(prevIds) {
  const seen = new Set(prevIds);
  let next = state;
  let added = 0;
  for (const item of liveFeed.items) {
    if (seen.has(item.id)) continue;
    if (!item.topics?.some((t) => state.topics.includes(t))) continue;
    next = pushAlert(next, {
      id: "feed-" + item.id,
      topic: item.topics[0],
      title: item.title,
      body: `${item.source} 新出现相关标题，请打开官方页面核对窗口。`,
      date: item.date || new Date().toISOString().slice(0, 10),
      url: item.url,
    });
    added += 1;
  }
  state = next;
  localStorage.setItem(seenKey(), JSON.stringify(liveFeed.items.map((i) => i.id)));
  return added;
}

async function loadFeed({ alertNew = false } = {}) {
  try {
    const res = await fetch(`/feed.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return 0;
    const prev = JSON.parse(localStorage.getItem(seenKey()) || "[]");
    liveFeed = await res.json();
    if (prev.length && alertNew && liveFeed.items?.length) {
      return pushNewFromFeed(prev);
    }
    if (liveFeed.items?.length) {
      localStorage.setItem(
        seenKey(),
        JSON.stringify(liveFeed.items.map((i) => i.id))
      );
    }
    return 0;
  } catch {
    return 0;
  }
}

function applyLiveFeed(feed) {
  const prev = JSON.parse(localStorage.getItem(seenKey()) || "[]");
  liveFeed = feed;
  if (!prev.length) {
    if (liveFeed.items?.length) {
      localStorage.setItem(seenKey(), JSON.stringify(liveFeed.items.map((i) => i.id)));
    }
    return 0;
  }
  return pushNewFromFeed(prev);
}

function refreshToast(n, fail = 0) {
  const extra = fail ? `，${fail} 个源没抓到` : "";
  toast(n ? `已读取最新 feed，新增 ${n} 条${extra}` : `已读取最新 feed，没有新标题${extra}`);
}

async function refreshNow() {
  if (refreshing) return;
  refreshing = true;
  render();
  try {
    if (import.meta.env.DEV) {
      const res = await fetch("/api/refresh", { method: "POST" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("json")) {
        const n = applyLiveFeed(await res.json());
        const fail = (liveFeed.sources || []).filter((s) => s.status === "fail").length;
        refreshToast(n, fail);
        return;
      }
    }
    const n = await loadFeed({ alertNew: true });
    refreshToast(n);
  } catch {
    await loadFeed({ alertNew: true });
    toast("读取失败，仍显示已有口径");
  } finally {
    refreshing = false;
    render();
  }
}

window.addEventListener("hashchange", render);
loadFeed({ alertNew: true }).then((n) => {
  if (n) toast(`数据源有 ${n} 条新标题`);
  render();
});
