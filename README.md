# 绿复通

H5 底座的生态修复 / 林下经济 / 工程复合项目情报站。政策卡片进官方原文，申报窗口打开县局、省厅或财政部页面。数据源每天抓一次列表页。

## 本地打开

```bash
npm install
npm run refresh
npm run dev
```

浏览器打开终端里的地址。首页「刷新数据源」会现场抓取；没有 dev 中间件时读取 `public/feed.json`。

## 部署（Cloudflare Pages）

这个仓库是静态 H5，对应 **Pages**，不要用 `npx wrangler deploy`（那是 Workers 命令，会报 Missing entry-point）。

在 Cloudflare → Workers & Pages → 项目 → Settings → Builds：

- Build command：`npm run build`
- Build output directory：`dist`
- **Deploy command：留空**

如果界面强制要填部署命令，改成：

```bash
npx wrangler pages deploy dist
```

连上 GitHub 的 `main` 后，每次推送会自动发布。
## 每天刷新

```bash
npm run refresh
```

写到 `public/feed.json`。GitHub Actions 在 `.github/workflows/daily-refresh.yml`，每天 08:00（UTC 0:00）跑一次。也可本机 crontab：`0 8 * * * cd /path/to/agriculture && npm run refresh`。

## 数据源

正在抓：财政部修复资金专栏、福建林业局、广西自然资源厅、国家林草局、云南省林草局公示公告、云南省自然资源厅门户等。详情在应用里「数据源」页。
