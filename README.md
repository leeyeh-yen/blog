# 未名手记

一个参考 Mori 视觉风格的极简个人博客。VitePress 负责生成静态网站，GitHub Pages 负责托管，本地网页管理器负责文章、独立页面、图片、站点设置和 Git 发布。

## 一、安装与本地运行

需要先安装 Node.js、pnpm 和 Git。在项目目录执行：

```powershell
pnpm install
pnpm dev
```

博客预览地址：`http://127.0.0.1:4173/`

另开一个 PowerShell 窗口启动本地管理器：

```powershell
pnpm admin
```

管理器地址：`http://127.0.0.1:4174/`。管理器只监听本机地址，不应暴露到局域网或互联网。

## 二、使用本地管理器

### 管理文章

1. 在左侧选择“文章”。
2. 新建文章，填写标题、日期、路径、摘要和标签。
3. 选择“草稿”或“已发布”。
4. 根据需要设置文章过时提醒。
5. 编辑正文并点击“保存文章”。

草稿保存在 `site/drafts/`，不会出现在博客中；已发布文章保存在 `site/posts/<年份>/`，保存后会出现在首页、归档和标签页中。删除的文章会进入本地回收站。

### Markdown 快捷工具

编辑器工具栏支持：

- 二级标题；
- 粗体和斜体；
- 引用；
- 无序列表和有序列表；
- 行内代码和代码块；
- 链接；
- 分隔线；
- 图片插入。

选中文字后点击相应按钮，可直接为选区添加 Markdown 标记。点击“预览”可以查看本地渲染效果，按 `Ctrl + S` 或 `Command + S` 可以快速保存。

### 管理独立页面

在左侧切换到“页面”，可以编辑归档、标签、关于等内置页面，也可以创建自己的独立页面。

每个页面可以设置：

- 页面标题和摘要；
- URL 路径；
- 顶部导航显示名称；
- 是否显示在顶部导航；
- 导航排列顺序。

新页面保存后会自动加入博客顶部导航，不需要修改前端代码。归档、标签和关于属于内置页面，可以编辑，但不能删除或修改路径。

### 上传图片

点击编辑器右上方的“插入图片”，上传前可以选择：

- `压缩为 WebP`：自动旋转图片，将最长边限制为 2200px，并转换为质量 82 的 WebP，推荐日常使用；
- `保留原图`：不改变图片内容，适合 GIF、需要保留原始质量的照片或已经压缩过的图片。

保留原图支持 JPG、PNG、WebP、GIF 和 AVIF。图片保存在 `site/public/images/<年份>/<内容路径>/`，并自动插入当前 Markdown 内容。

### 启用文章评论

文章评论使用 Beaudar，并将评论保存为 GitHub Issue。首次使用需要完成一次授权：

1. 确认用于评论的 GitHub 仓库是公开仓库，并已启用 Issues；
2. 打开 [Beaudar GitHub App](https://github.com/apps/beaudar) 并安装到博客仓库；
3. 在“站点设置”中启用 Beaudar，填写评论仓库和分支；
4. 保存并重新发布博客。

默认使用 `leeyeh-yen/blog` 和 `master`，每篇文章按页面路径匹配一个 Issue。首次有人评论时，Beaudar 会自动创建对应的 Issue。单篇文章如需关闭评论，可在 Markdown frontmatter 中加入 `comments: false`。

## 三、首次连接 GitHub 仓库

先在 GitHub 创建一个空仓库，不要初始化 README、`.gitignore` 或 License。然后在本项目目录打开 PowerShell。

### 配置 Git 身份

```powershell
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱"
```

### 配置远程仓库

```powershell
git remote add origin https://github.com/用户名/仓库名.git
git remote -v
```

如果提示 `remote origin already exists`，说明已经存在远程配置，应修改地址：

```powershell
git remote set-url origin https://github.com/用户名/仓库名.git
git remote -v
```

### 首次提交和推送

```powershell
git add --all
git commit -m "初始化博客"
git push -u origin master
```

如果仓库使用 `main` 分支，将最后一条命令中的 `master` 改为 `main`。首次推送时，Windows 可能打开浏览器要求登录 GitHub。

## 四、启用 GitHub Pages

1. 打开 GitHub 博客仓库。
2. 进入 `Settings → Pages`。
3. 在 `Build and deployment` 中将 `Source` 设置为 `GitHub Actions`。
4. 返回仓库的 `Actions` 页面，等待 `Deploy blog to GitHub Pages` 工作流完成。

项目中的 `.github/workflows/deploy.yml` 会在推送 `master` 或 `main` 后自动安装依赖、构建博客并部署到 GitHub Pages。

## 五、配置站点与日常发布

在本地管理器右上角点击“站点设置”，填写博客名称、作者、Footer、GitHub 仓库和默认分支等信息。其中 GitHub 仓库使用 `用户名/仓库名` 格式。

日常发布流程：

1. 保存文章、页面或站点设置。
2. 点击“提交并发布”。
3. 填写提交说明。
4. 可先点击“检查构建”。
5. 点击“确认发布”。

后台会依次执行：

```text
检查博客构建
→ git add --all
→ git commit
→ git push
→ GitHub Actions 自动部署
```

推送完成后，可以到 GitHub 仓库的 `Actions` 页面查看部署状态。

## 六、目录说明

```text
site/posts/                 已发布文章
site/drafts/                本地草稿
site/public/images/         文章与页面图片
site/archive.md             归档页面
site/tags.md                标签页面
site/about.md               关于页面
site/settings.json          站点设置
admin/                      本地管理器
.github/workflows/          GitHub Pages 自动部署工作流
```

## 七、数据安全

- 未保存的编辑内容会自动备份在当前浏览器中；
- 覆盖保存文章前会在本地保留历史版本；
- 删除的文章会进入回收站；
- “站点设置”中可以创建完整的本地内容备份；
- GitHub 会保留每次成功提交的历史记录。

建议仍然定期备份整个项目目录。

## 八、常见问题

### 后台显示“尚未配置 Git 远程仓库”

先确认命令是在本博客项目目录执行，然后运行：

```powershell
git remote -v
```

没有输出时添加 `origin`；地址不正确时使用 `git remote set-url origin ...` 修改。修改后刷新后台管理页面。

### 推送提示没有上游分支

首次手动执行：

```powershell
git push -u origin master
```

### GitHub Actions 构建失败

先在后台发布窗口点击“检查构建”。如果本地检查通过，再到 GitHub 的 `Actions` 页面打开失败任务并查看具体步骤。

### 后台提示没有需要发布的变更

表示当前内容已经提交，工作区没有新的修改，不是故障。

更详细的首次发布说明仍保留在 [`docs/后台发布到GitHub.md`](docs/后台发布到GitHub.md)。
