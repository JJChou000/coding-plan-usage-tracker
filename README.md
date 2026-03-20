# Coding Plan Usage Tracker

桌面浮窗工具，用于集中监控多个 AI Coding Plan 的额度使用情况。

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

阶段 0 目标：

- 使用 `electron-vite` + React 19 + TypeScript 初始化工程
- 建立 `src/main`、`src/preload`、`src/renderer`、`src/shared` 基础结构
- 补齐共享类型、全局样式变量和后续阶段需要的占位文件

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
