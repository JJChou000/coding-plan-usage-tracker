# Coding Plan Usage Tracker

Windows 桌面浮窗工具，用于集中查看多个 AI Coding Plan 的额度使用情况。

[阅读中文说明](./README.zh-CN.md) | [Read the English README](./README.en.md)

## 快速入口

- 当前版本：`v0.2.0`
- 最新发布：[GitHub Releases](https://github.com/JJChou000/coding-plan-usage-tracker/releases)
- 中文完整说明：[README.zh-CN.md](./README.zh-CN.md)
- English documentation: [README.en.md](./README.en.md)
- 变更记录：[docs/Changelog.md](./docs/Changelog.md)

## 项目定位

这个项目提供一个常驻桌面的透明浮窗，帮你在不反复切网页的情况下查看 AI Coding Plan 的核心额度数据。当前正式支持 Windows，界面支持折叠态、展开态、边缘吸附、托盘操作和周期刷新。

## 当前状态

- 智谱 Provider 已接入真实额度链路
- 阿里云百炼保留 Provider 结构与兼容代码，但默认不在新增列表中开放
- 仓库已移除发布无关的截图产物与脚手架残留，避免将不必要内容继续公开跟踪

## 安装与开发

```bash
npm install
npm run dev
```

构建 Windows 安装包：

```bash
npm run build
```
