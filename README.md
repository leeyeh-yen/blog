# 未名手记

一个 Mori 风格的极简个人博客：VitePress 负责静态站点，GitHub Pages 负责托管，本地网页管理器负责文章、图片和发布。

## 本地运行

```bash
pnpm install
pnpm dev
```

博客预览地址为 `http://127.0.0.1:4173`。

另开一个终端启动本地管理器：

```bash
pnpm admin
```

管理器地址为 `http://127.0.0.1:4174`。它只监听本机地址，不应暴露到局域网或互联网。

## 内容目录

- 已发布文章：`site/posts/<年份>/<slug>.md`
- 本地草稿：`site/drafts/`，默认不会提交 Git
- 图片：`site/public/images/<年份>/<文章 slug>/`

## 发布到 GitHub Pages

1. 将仓库推送到 GitHub。
2. 在仓库 Settings → Pages 中选择 GitHub Actions 作为发布来源。
3. 推送 `main` 或 `master` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布。

绑定自定义域名后，将仓库 Settings → Pages 中的域名填入站点设置即可。构建时也可以通过 `SITE_URL` 和 `BASE_PATH` 环境变量覆盖站点地址。
