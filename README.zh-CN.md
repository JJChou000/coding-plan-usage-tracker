# Coding Plan Usage Tracker

[阅读中文说明](./README.zh-CN.md) | [Read the English README](./README.en.md)

Windows 桌面浮窗工具，用于集中监控多个 AI Coding Plan 的额度使用情况，减少在多个网页、控制台和设置页之间来回切换的成本。

## 版本信息

- 当前版本：`v0.2.0`
- 目标平台：Windows
- 技术栈：Electron 34、React 19、TypeScript、Vite 6
- 最新发布：[GitHub Releases](https://github.com/JJChou000/coding-plan-usage-tracker/releases)
- 变更记录：[docs/Changelog.md](./docs/Changelog.md)

## 界面截图

### 折叠态

![折叠态浮窗](docs/assets/readme/collapsed.png)

### 展开态

![展开态浮窗](docs/assets/readme/expanded.png)

### 吸附态

![吸附态浮窗](docs/assets/readme/docked.png)

### 设置面板

![设置面板](docs/assets/readme/settings.png)

## 核心能力

- 桌面常驻浮窗，支持折叠态、展开态和边缘吸附
- 系统托盘菜单，支持刷新、打开设置和退出应用
- 厂商维度数据展示，支持在折叠态选择主展示维度
- 自动刷新与错误退避，默认 `60s`，可配置为 `30s / 60s / 120s / 300s`
- 透明度调节、低透明度可读性增强、吸附态数字与时间显示优化
- 使用 `electron-store` 持久化窗口位置、窗口状态、刷新频率和厂商配置

## Provider 支持情况

### 智谱

- 配置字段：`API Token`
- 数据来源：真实线上额度接口
- 当前支持展示：
  - `每 5 小时 Token`
  - `MCP 每月额度`

### 阿里云百炼

- 配置字段：`Cookie`
- 当前状态：当前暂未开放新增入口
- 数据来源：当前仍以 mock 数据链路保留 UI 和结构兼容性，待真实接口确认后恢复入口

## 安装方式

### 方式一：下载 Release 安装包

前往 [GitHub Releases](https://github.com/JJChou000/coding-plan-usage-tracker/releases) 下载 `v0.2.0` 或更新版本的 Windows 安装包。

### 方式二：本地构建

```bash
npm install
npm run build
```

构建完成后，安装包会输出到 `dist/` 目录。

## 开发命令

```bash
npm run dev
npm run test
npm run typecheck
npm run build
```

## 使用说明

1. 启动应用后，桌面会出现浮窗，系统托盘会出现应用图标。
2. 首次使用时，右键托盘图标，点击“设置”打开设置面板。
3. 添加厂商并填写认证信息后，浮窗会自动开始刷新额度数据。
4. 点击浮窗可在折叠态和展开态之间切换。
5. 展开态中可勾选需要在折叠态显示的主维度。
6. 将浮窗拖拽到屏幕边缘后会自动吸附，点击边缘把手可恢复显示。

## 仓库说明

- 根 README 作为仓库首页入口，中文与英文说明分别维护
- 截图资源统一存放在 `docs/assets/readme/`
- 本地构建输出如 `dist/`、`out/`、`node_modules/` 不会进入 GitHub 仓库

## 相关文档

- 产品需求：[docs/PRD.md](./docs/PRD.md)
- 工程设计：[docs/Engineering.md](./docs/Engineering.md)
- 开发任务：[docs/Development_Tasks.md](./docs/Development_Tasks.md)
- 变更日志：[docs/Changelog.md](./docs/Changelog.md)

## 已知说明

- 当前正式支持 Windows。
- 阿里云百炼真实接口仍待确认，因此发布版不会默认开放新增入口。
