# 通过本地后台发布博客到 GitHub

本文说明如何完成 GitHub 仓库的首次绑定，以及之后如何完全通过本地后台保存、提交和发布文章。

## 一、准备工作

开始前需要：

- 一个 GitHub 账号；
- 一个用于存放博客源码的 GitHub 仓库；
- 本地博客和管理器能够正常运行；
- 本地已经安装 Git。

本项目当前使用的默认分支是 `master`，GitHub Pages 工作流同时支持 `master` 和 `main`。

## 二、创建 GitHub 仓库

1. 登录 GitHub。
2. 点击右上角的 `New repository`。
3. 填写仓库名称，例如 `my-blog`。
4. 根据需要选择公开或私有仓库。
5. 不要勾选初始化 README、`.gitignore` 或 License。
6. 点击 `Create repository`。

创建完成后，复制仓库的 HTTPS 地址，例如：

```text
https://github.com/your-name/my-blog.git
```

## 三、首次绑定本地仓库

第一次发布前，需要在项目目录打开 PowerShell，并执行以下命令。

### 1. 配置 Git 身份

```powershell
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱"
```

这些设置只作用于当前博客项目。

### 2. 添加远程仓库

将下面的地址替换成自己的仓库地址：

```powershell
git remote add origin https://github.com/用户名/仓库名.git
```

可以使用以下命令检查配置：

```powershell
git remote -v
```

### 3. 完成第一次提交和推送

```powershell
git add --all
git commit -m "初始化博客"
git push -u origin master
```

首次推送时，Windows 可能会打开浏览器，要求登录并授权 GitHub。完成授权后等待推送结束即可。

## 四、配置本地管理器

打开本地管理器：

```text
http://127.0.0.1:4174/
```

点击右上角的“站点设置”，填写：

- GitHub 仓库：`用户名/仓库名`
- 默认分支：`master`

保存后，文章末尾的“在 GitHub 编辑此页”会自动指向对应的 Markdown 文件。

需要注意：后台中的 GitHub 仓库设置用于生成网页编辑链接；真正执行 `git push` 的远程地址仍以 `git remote` 配置为准。

## 五、启用 GitHub Pages

1. 打开 GitHub 上的博客仓库。
2. 进入 `Settings`。
3. 在左侧选择 `Pages`。
4. 在发布来源中选择 `GitHub Actions`。

项目已经包含 `.github/workflows/deploy.yml`，推送到 `master` 或 `main` 后会自动：

1. 安装依赖；
2. 构建 VitePress 博客；
3. 上传静态文件；
4. 部署到 GitHub Pages。

官方文档：

- [配置 GitHub Pages 发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [使用自定义 GitHub Actions 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 六、日常发布文章

首次绑定完成后，日常写作不再需要使用终端。

1. 打开 `http://127.0.0.1:4174/`。
2. 新建文章或选择已有文章。
3. 填写标题、日期、路径、摘要和标签。
4. 将状态设置为“已发布”。
5. 点击“保存文章”。
6. 点击右上角“提交并发布”。
7. 填写本次提交说明。
8. 可先点击“检查构建”。
9. 点击“确认发布”。

后台会依次执行：

```text
博客构建检查
→ git add --all
→ git commit
→ git push
→ GitHub Actions 自动部署
```

## 七、草稿与已发布文章

- 状态为“草稿”的文章保存在 `site/drafts`，不会出现在博客前台。
- 状态为“已发布”的文章保存在 `site/posts`，构建后会出现在博客中。
- 将草稿改为已发布并保存时，后台会自动移动文件。
- 删除文章时，文章会进入本地回收站，可以从后台恢复。

## 八、查看部署状态

推送完成后：

1. 打开 GitHub 仓库。
2. 点击 `Actions`。
3. 打开最新的 `Deploy blog to GitHub Pages` 任务。
4. 等待任务显示绿色对勾。

第一次部署通常需要稍等片刻。部署完成后，可以在仓库的 `Settings → Pages` 中找到博客地址。

## 九、常见问题

### 提示“尚未配置 Git 远程仓库”

执行：

```powershell
git remote add origin https://github.com/用户名/仓库名.git
```

如果已经存在名为 `origin` 的远程仓库，可修改地址：

```powershell
git remote set-url origin https://github.com/用户名/仓库名.git
```

### 提示没有设置用户名或邮箱

执行：

```powershell
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱"
```

### 推送时要求登录

按照系统弹出的 GitHub 登录窗口完成授权。GitHub 不再接受账户密码作为 Git HTTPS 推送密码，应使用浏览器授权或 Personal Access Token。

### 推送提示没有上游分支

首次执行：

```powershell
git push -u origin master
```

之后后台就可以直接执行 `git push`。

### GitHub Actions 构建失败

先在本地后台的发布窗口点击“检查构建”。如果本地构建成功，再到 GitHub 的 `Actions` 页面查看失败步骤和日志。

### 后台提示没有需要发布的变更

说明文章和设置已经提交，当前工作区没有新的修改。这不是错误。

## 十、数据安全

- 编辑中的未保存内容会自动备份到当前浏览器。
- 覆盖保存文章前，后台会在本地保留历史版本。
- 删除的文章会进入回收站。
- 可以在“站点设置”中点击“创建本地备份”。
- GitHub 仓库本身也会保留每次提交的完整历史记录。

