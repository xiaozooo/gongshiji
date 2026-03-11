# 技术文档

> 面向开发者，描述当前仓库中的真实实现。

## 1. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建 | Vite 6 | 开发、构建、预览 |
| 语言 | Vanilla JavaScript | ESM 组织方式 |
| 样式 | 原生 CSS | 单文件设计系统与组件样式 |
| 本地存储 | IndexedDB + `idb` | 数据持久化 |
| PWA | `vite-plugin-pwa` | manifest、SW、离线缓存 |
| 测试 | `node:test` | `tests/` 下单元测试 |
| 加密工具 | Web Crypto API | 仅工具函数存在，UI 未接入 |

当前 `package.json` 中只有两个运行时依赖：`idb` 与 `vite-plugin-pwa` 相关构建依赖；文档中不应再把 `flatpickr` 视为项目依赖。

## 2. 目录结构

```text
gongshiji/
├── .github/workflows/deploy.yml
├── docs/
├── public/
│   ├── favicon.svg
│   └── icons/
├── src/
│   ├── components/
│   │   ├── jobsPanel.js
│   │   ├── modal.js
│   │   ├── navbar.js
│   │   └── toast.js
│   ├── db/
│   │   ├── database.js
│   │   ├── jobStore.js
│   │   └── recordStore.js
│   ├── pages/
│   │   ├── history.js
│   │   ├── home.js
│   │   ├── jobs.js
│   │   └── settings.js
│   ├── utils/
│   │   ├── colors.js
│   │   ├── conflict.js
│   │   ├── crypto.js
│   │   ├── csv.js
│   │   ├── debounce.js
│   │   ├── historyStats.js
│   │   ├── recordCopy.js
│   │   └── time.js
│   ├── index.css
│   ├── main.js
│   └── router.js
├── tests/
├── index.html
├── package.json
└── vite.config.js
```

说明：`src/pages/jobs.js` 仍在仓库中，但当前 `main.js` 只注册了 `#home`、`#history`、`#settings` 三个路由。

## 3. 应用启动流程

入口在 `src/main.js`：

1. 加载全局样式
2. 初始化 IndexedDB
3. 调用 `ensureDefaultJob()` 保证存在默认岗位
4. 渲染底部导航
5. 初始化在线状态条
6. 注册并启动 Hash 路由

## 4. 路由与页面

路由器位于 `src/router.js`，采用简单的 Hash 路由方案。

- `#home` -> `src/pages/home.js`
- `#history` -> `src/pages/history.js`
- `#settings` -> `src/pages/settings.js`

页面通过动态 `import()` 懒加载，切换时会清空 `#page-container` 再重新挂载页面 DOM。

## 5. 数据层设计

### 5.1 数据库

数据库名：`gongshiji-db`
版本：`1`

包含三个 object store：

- `jobs`
- `records`
- `meta`

### 5.2 `jobs` store

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID |
| `name` | string | 岗位名称 |
| `wage` | number | 默认时薪 |
| `currency` | string | 预留字段，当前未使用 |
| `notes` | string | 岗位备注 |
| `color` | string | 岗位色 |
| `isDefault` | boolean | 默认岗位标记 |
| `createdAt` | string | ISO 时间 |
| `updatedAt` | string | ISO 时间 |
| `isDeleted` | boolean | 软删除标记 |

索引：`name`、`createdAt`、`isDeleted`

### 5.3 `records` store

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID |
| `jobId` | string | 岗位 ID |
| `jobName` | string | 冗余岗位名称 |
| `wage` | number | 实际使用工价 |
| `date` | string | 本地日期 `YYYY-MM-DD` |
| `yearMonth` | string | `YYYY-MM` |
| `startTimestamp` | string | 开始时间 ISO |
| `endTimestamp` | string | 结束时间 ISO |
| `hours` | number | 净工时小时数 |
| `breakMinutes` | number | 休息分钟数 |
| `memo` | string | 备注 |
| `isSplit` | boolean | 是否由跨天拆分得到 |
| `source` | string | `manual` 或 `import` |
| `createdAt` | string | 创建时间 |
| `updatedAt` | string | 更新时间 |
| `isDeleted` | boolean | 软删除标记 |

索引：`date`、`jobId`、`date_jobId`、`startTimestamp`、`yearMonth`、`isDeleted`

### 5.4 `meta` store

当前已知用途：

- `lastBackupAt`：导出 CSV 后更新时间

## 6. 主要模块

### 6.1 `src/db/jobStore.js`

负责岗位数据操作：

- 创建岗位
- 更新岗位
- 软删除与恢复
- 查询全部岗位
- 设置默认岗位
- 启动时保证默认岗位存在

### 6.2 `src/db/recordStore.js`

负责记录数据操作：

- 新增、更新、删除记录
- 按日期、月份、日期区间查询
- 获取最新记录
- 检查重叠时间段
- 批量导入记录和岗位

### 6.3 `src/pages/home.js`

首页录入流程：

- 从岗位列表渲染岗位选择器
- 根据日期与时间计算总分钟和净分钟
- 允许休息分钟和自定义工价
- 保存前执行同日同岗判断与时间重叠判断
- 支持把上一次记录复制到表单

限制：`getTimestamps()` 明确要求 `endTime > startTime`，所以不会进入跨天拆分逻辑。

### 6.4 `src/pages/history.js`

历史页面分三种模式：

- 按周
- 按月
- 按工作

核心能力：

- KPI 汇总
- 工时和收入趋势图
- 日期筛选
- 长按记录后编辑或删除
- 导出当前查询范围 CSV

### 6.5 `src/pages/settings.js`

当前只接入了三类设置：

- 岗位管理面板
- CSV 导出 / CSV 导入
- 清空全部本地数据

注意：虽然仓库有 `src/utils/crypto.js`，但设置页尚未提供加密备份入口。

### 6.6 工具模块

- `time.js`：时间转换、分钟/小时计算、本地时间处理、跨天拆分工具
- `csv.js`：CSV 生成、解析、下载
- `conflict.js`：导入冲突检测
- `historyStats.js`：历史页聚合统计
- `recordCopy.js`：复制上一条记录时确定目标日期
- `colors.js`：岗位颜色稳定映射

## 7. PWA 与部署配置

`vite.config.js` 中已经固定：

- `base: '/gongshiji/'`
- `registerType: 'autoUpdate'`
- manifest 的 `start_url: '/gongshiji/'`
- GitHub Pages 适配图标路径

这意味着仓库默认面向 GitHub Pages 子路径部署；如果换到根路径或其他仓库名，需要同步调整 `base` 和 `start_url`。

## 8. 测试与验证

当前测试位于 `tests/`，通过 Node 原生测试运行：

```bash
node --test
```

已覆盖的模块主要包括：

- `time.js` 中的休息时间净值计算
- `csv.js` 的 CSV 生成与解析
- `historyStats.js` 的周/月范围和聚合逻辑
- `colors.js` 的岗位颜色选择
- `recordCopy.js` 的复制日期决策
- `recordStore.js` 的最新记录排序逻辑

## 9. 已知技术问题

- `src/main.js` 的在线状态条在 `online` 事件中把 `innerHTML` 置空
- `csv.js` 先按换行切分，再逐行解析，无法稳健处理带换行字段的 CSV
- `time.js` 的跨天拆分函数已经存在，但首页入口未使用
- 样式文件中仍保留部分未实际启用的样式痕迹，说明实现经历过迭代残留
