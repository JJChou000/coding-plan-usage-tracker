# Coding Plan Usage Tracker - 项目规则

## 项目概述

桌面浮窗工具，用于集中监控多个 AI Coding Plan 的额度使用情况。

- **技术栈**: Electron 34+ / React 19 / TypeScript / Vite 6
- **目标平台**: Windows（架构保持跨平台能力）
- **设计风格**: 毛玻璃 (Glassmorphism)、深色主题

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式 (`strict: true`)
- React 组件统一使用函数式组件 + Hooks
- 文件命名: 组件用 PascalCase (`ProgressBar.tsx`)，工具/服务用 camelCase (`apiService.ts`)
- CSS 文件与组件同名: `ProgressBar.css`
- 使用 CSS Variables 管理主题变量，定义在 `src/renderer/styles/variables.css`

### 目录结构约定

```
src/
  main/           # Electron 主进程
    main.ts        # 入口
    tray.ts        # 系统托盘
    window.ts      # 窗口管理（浮窗、拖拽、边缘吸附）
  renderer/        # React 渲染进程
    components/    # UI 组件
    providers/     # 厂商数据提供者（每个厂商一个文件）
    hooks/         # 自定义 Hooks
    context/       # React Context（状态管理）
    styles/        # 全局样式和变量
    App.tsx        # 根组件
    main.tsx       # 渲染进程入口
  shared/          # 主进程和渲染进程共享的类型定义
    types.ts       # 公共类型接口
  preload/         # Electron preload 脚本
    preload.ts
```

### 厂商 Provider 架构

- 所有厂商 Provider 必须实现 `IProvider` 接口（定义在 `src/shared/types.ts`）
- 每个 Provider 包含: `id`, `name`, `icon`, `fetchUsage()`, `getAuthFields()`
- 新增厂商只需在 `src/renderer/providers/` 下创建新文件并在 `providerRegistry.ts` 中注册

### Git 规范

- 提交信息使用中文 Conventional Commits 格式
- 分支命名: `feat/xxx`, `fix/xxx`, `docs/xxx`
- 基于 GitHub Issue 开发

### 关键设计约束

1. **不使用数据库**：用户配置通过 `electron-store` 持久化
2. **刷新频率默认 60 秒**，可配置（30s ~ 5min）
3. **浮窗默认置顶** (`alwaysOnTop: true`)
4. **边缘吸附**: 浮窗拖拽到屏幕边缘时自动缩进，仅显示小把手
5. **折叠态**: 显示厂商图标 + 主百分比 + 刷新时间
6. **展开态**: 显示所有额度维度的百分比条，多维度的可勾选展示



- 完成每一步，通过验收后在Developement.md上画"x"。