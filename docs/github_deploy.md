# GitHub 部署指南

> 适用于当前仓库的默认部署方式：GitHub Pages + GitHub Actions。

## 1. 当前仓库配置

仓库已经包含：

- `vite.config.js` 中的 `base: '/gongshiji/'`
- `manifest.start_url: '/gongshiji/'`
- [`.github/workflows/deploy.yml`](/home/xiao/gongshiji/.github/workflows/deploy.yml)

因此，默认前提是：

- 仓库名为 `gongshiji`
- 部署目标为 `https://<用户名>.github.io/gongshiji/`

如果你的仓库名不同，需要同时修改：

- [vite.config.js](/home/xiao/gongshiji/vite.config.js)
- manifest 中的 `start_url`

## 2. GitHub Pages 工作流

当前工作流在 push 到 `main` 时自动执行：

1. 检出代码
2. 安装 Node 20
3. 执行 `npm ci`
4. 执行 `npm run build`
5. 上传 `dist/`
6. 部署到 GitHub Pages

工作流文件：[`deploy.yml`](/home/xiao/gongshiji/.github/workflows/deploy.yml)

## 3. 首次部署步骤

### 3.1 创建仓库

在 GitHub 创建公开仓库，例如 `gongshiji`。

### 3.2 推送代码

```bash
git init
git add .
git commit -m "init: gongshiji"
git branch -M main
git remote add origin https://github.com/<用户名>/gongshiji.git
git push -u origin main
```

### 3.3 打开 Pages

进入仓库设置：

1. 打开 `Settings`
2. 进入 `Pages`
3. `Source` 选择 `GitHub Actions`

之后每次推送到 `main` 都会自动重新部署。

## 4. 本地构建检查

部署前建议先在本地验证：

```bash
npm ci
npm run build
npm run preview
```

如果构建失败，GitHub Actions 也会失败。

## 5. 改仓库名时的处理

如果仓库名不是 `gongshiji`，例如 `worklog`，需要把以下内容一并改掉：

```js
export default defineConfig({
  base: '/worklog/'
})
```

以及：

```js
manifest: {
  start_url: '/worklog/'
}
```

否则部署后静态资源会 404。

## 6. 常见问题

### 6.1 页面空白或资源 404

通常是 `base` 与仓库名不一致。

### 6.2 PWA 安装异常

先确认：

- 页面已经通过 HTTPS 打开
- `icons/icon-192.png` 与 `icons/icon-512.png` 已被正确发布
- Service Worker 已成功注册

### 6.3 Actions 成功但页面旧版本未刷新

当前 PWA 配置为 `autoUpdate`，但浏览器仍可能缓存旧资源。可尝试：

- 强制刷新页面
- 关闭后重新打开标签页
- 在浏览器中清理站点数据后重试
