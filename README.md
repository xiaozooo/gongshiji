# 工时记

一个面向小时工、兼职和临时用工场景的本地工时记录 PWA。

在线地址：`https://xiaozooo.github.io/gongshiji/`

## 功能

- 工时录入：日期、开始/结束时间、休息时长、临时工价、备注
- 岗位管理：新建、编辑、归档、恢复、默认岗位
- 历史统计：按周、按月、按工作查看工时和收入
- 数据管理：CSV 导入导出、冲突预览、清空本地数据
- PWA：支持安装、离线缓存、GitHub Pages 部署

## 开发

```bash
npm install
npm run dev
npm run build
npm run preview
node --test
```

## 部署

当前仓库默认部署到 GitHub Pages 子路径：`/gongshiji/`。

如果仓库名变化，需要同步修改：

- `vite.config.js` 中的 `base`
- PWA manifest 中的 `start_url`

## 已知限制

- 当前不支持直接录入跨午夜工时
- 在线状态栏恢复在线时文本会被清空
- 加密备份和 JSON 备份工具代码已存在，但界面未接入

## License

[MIT](LICENSE)
