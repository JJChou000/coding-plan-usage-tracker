# Coding Plan Usage Tracker

Windows 桌面浮窗工具，用于集中查看多个 AI Coding Plan 的额度使用情况，减少在多个网页与控制台之间来回切换的成本。

[阅读中文说明](./README.zh-CN.md) | [Read the English README](./README.en.md)

## 项目简介

- 当前版本：`v0.2.0`
- 最新发布：[GitHub Releases](https://github.com/JJChou000/coding-plan-usage-tracker/releases)
- 中文完整说明：[README.zh-CN.md](./README.zh-CN.md)
- English documentation: [README.en.md](./README.en.md)
- 变更记录：[docs/Changelog.md](./docs/Changelog.md)

## 功能特性

- 桌面常驻浮窗，支持折叠态、展开态和边缘吸附
- 系统托盘菜单，支持刷新、打开设置和退出应用
- 厂商维度数据展示，支持在折叠态选择主展示维度
- 自动刷新与错误退避，默认 `60s`，可配置为 `30s / 60s / 120s / 300s`
- 透明度调节与低透明度可读性增强
- 使用 `electron-store` 持久化窗口位置、窗口状态、刷新频率和厂商配置

## 界面截图

### 折叠态

![折叠态浮窗](docs/assets/readme/collapsed.png)

### 展开态

![展开态浮窗](docs/assets/readme/expanded.png)

### 吸附态

![吸附态浮窗](docs/assets/readme/docked.png)

### 设置面板

![设置面板](docs/assets/readme/settings.png)

## 安装方式

### 方式一：下载 Release 安装包

前往 [GitHub Releases](https://github.com/JJChou000/coding-plan-usage-tracker/releases) 下载最新 Windows 安装包。

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

## 当前支持

- 智谱：已接入真实额度链路
- 阿里云百炼：当前暂未开放新增入口
