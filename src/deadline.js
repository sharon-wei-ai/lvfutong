/** Application-window marks. Dates are ISO (YYYY-MM-DD). */

export function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function daysUntil(iso, today) {
  const a = new Date(`${iso}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  return Math.round((a - b) / 86400000);
}

/**
 * kind: dated | rolling | anytime | awaiting | in_force
 * openFrom / openTo optional ISO dates
 */
export const deadlineById = {
  "w-mof-mine": { kind: "dated", openFrom: "2025-02-20", openTo: "2025-04-30", note: "2025年轮次" },
  "w-mof-fund": { kind: "rolling", note: "预算下达后由省分解" },
  "w-yn-reserve": { kind: "rolling", note: "州（市）批次入库" },
  "w-yn-green-mine": { kind: "anytime", note: "建成后网上申请" },
  "w-yn-mine-pack": { kind: "rolling", note: "十五五储备库" },
  "w-yn-under": { kind: "dated", openFrom: "2026-06-22", openTo: "2026-06-26", note: "行动方案征求意见" },
  "w-gx-reserve": { kind: "rolling", note: "十五五滚动入库" },
  "w-fj-under": { kind: "rolling", note: "随省级专项批次" },
  "w-nx-jy": { kind: "dated", openFrom: "2026-03-17", openTo: "2026-04-30" },
  "w-nx-dwk": { kind: "dated", openFrom: "2026-03-17", openTo: "2026-04-17" },
  "w-nh": { kind: "dated", openTo: "2025-03-07", note: "2025年省级专项" },
  "w-forest-base": { kind: "awaiting", note: "下一批次以林草局通知为准" },

  "p-mine-2025": { kind: "dated", openFrom: "2025-02-20", openTo: "2025-04-30", note: "2025年示范工程" },
  "p-fund-2026": { kind: "in_force", note: "资金管理办法，不是申报口" },
  "p-fund-budget": { kind: "in_force", note: "预算已提前下达" },
  "p-fund-issued-2026": { kind: "in_force", note: "2026年预算已正式下达" },
  "p-forest-base": { kind: "awaiting", note: "下一批次随通知" },
  "p-mine-15": { kind: "rolling", note: "十五五按图斑组卷" },
  "p-gx-15": { kind: "rolling", note: "自治区储备库" },
  "p-nx-2026": { kind: "dated", openFrom: "2026-03-17", openTo: "2026-04-30" },
  "p-fj-2026": { kind: "in_force", note: "政策已印发，专项随批次" },
  "p-dt-2026": { kind: "in_force" },
  "p-pv-spec": { kind: "in_force", note: "2026-03-28起施行" },
  "p-eod": { kind: "in_force" },
  "p-mineral-law": { kind: "in_force", note: "2025-07-01起施行" },
  "p-master": { kind: "in_force" },
  "p-yn-qa": { kind: "in_force", note: "现行办理口径" },
  "p-yn-fund": { kind: "in_force", note: "无省级林下专项口" },
  "p-yn-action": { kind: "dated", openFrom: "2026-06-22", openTo: "2026-06-26", note: "征求意见" },
  "p-yn-species": { kind: "in_force", note: "选品目录，不是奖补口" },
  "p-yn-reserve": { kind: "rolling", note: "州（市）组卷入库" },
  "p-yn-green-mine": { kind: "anytime", note: "建成后网上申请" },
  "p-yn-mine-15": { kind: "rolling", note: "十五五储备库" },

  "o-mine-pack": { kind: "rolling", note: "随省厅储备库" },
  "o-yn-reserve": { kind: "rolling", note: "州（市）批次入库" },
  "o-yn-mine": { kind: "rolling", note: "十五五" },
  "o-yn-green": { kind: "anytime", note: "建成即报" },
  "o-gx-zhi": { kind: "rolling", note: "十五五滚动" },
  "o-fj-space": { kind: "in_force", note: "政策已出台" },
  "o-nx-prep": { kind: "dated", openFrom: "2026-03-17", openTo: "2026-04-30", note: "备2027年窗口" },
  "o-pv-mine": { kind: "in_force", note: "规范已实施" },
  "o-xiangshan": { kind: "rolling", note: "市县策划入库" },
  "o-land": { kind: "rolling", note: "随省级整治批次" },
  "o-reserve": { kind: "rolling", note: "储备林年度任务" },
};

export function resolveDeadline(item, today = todayISO()) {
  const spec = {
    kind: item.windowKind,
    openFrom: item.openFrom,
    openTo: item.openTo,
    note: item.window,
    ...(deadlineById[item.id] || {}),
  };
  if (item.openFrom) spec.openFrom = item.openFrom;
  if (item.openTo) spec.openTo = item.openTo;
  if (item.windowKind) spec.kind = item.windowKind;

  if (item.live) {
    return { key: "soon", label: "窗口待核", hint: "列表标题，打开原文核对是否还在报", sort: 2 };
  }

  const kind = spec.kind || inferKind(item);
  const from = spec.openFrom || "";
  const to = spec.openTo || "";
  const note = spec.note || item.window || "";

  if (kind === "dated" || to) {
    if (to && today > to) {
      return {
        key: "closed",
        label: "申报已过",
        hint: rangeText(from, to, note),
        sort: 3,
      };
    }
    if (from && today < from) {
      return {
        key: "soon",
        label: "尚未开始",
        hint: `${from}起${note ? " · " + note : ""}`,
        sort: 1,
      };
    }
    if (to && today <= to) {
      const left = daysUntil(to, today);
      const leftText = left === 0 ? "今日截止" : `还剩${left}天`;
      return {
        key: "open",
        label: "申报未过",
        hint: `${leftText} · ${to}${note ? " · " + note : ""}`,
        sort: 0,
      };
    }
  }

  if (kind === "awaiting") {
    return { key: "soon", label: "窗口未开", hint: note || "下一批次待通知", sort: 2 };
  }
  if (kind === "anytime") {
    return { key: "open", label: "申报未过", hint: note ? `随时可报 · ${note}` : "随时可报", sort: 0 };
  }
  if (kind === "rolling") {
    return { key: "open", label: "申报未过", hint: note ? `滚动申报 · ${note}` : "滚动申报", sort: 0 };
  }
  if (kind === "in_force") {
    return { key: "open", label: "申报未过", hint: note ? `现行有效 · ${note}` : "现行有效，无固定截止日", sort: 1 };
  }
  if (item.urgency === "closed" || item.status === "closed") {
    return { key: "closed", label: "申报已过", hint: note || "窗口已关闭", sort: 3 };
  }
  return { key: "open", label: "申报未过", hint: note || "请核对官方页面", sort: 1 };
}

function inferKind(item) {
  if (item.urgency === "closed" || item.status === "closed") return "dated";
  if (item.status === "rolling" || /滚动|批次/.test(item.window || item.status || "")) return "rolling";
  if (item.status === "open") return "rolling";
  return "in_force";
}

function rangeText(from, to, note) {
  const range = from && to ? `${from} 至 ${to}` : to ? `截止 ${to}` : "";
  return [range, note].filter(Boolean).join(" · ");
}

export function deadlineStamp(mark) {
  return `<div class="deadline ${mark.key}"><b>${mark.label}</b><span>${mark.hint}</span></div>`;
}
