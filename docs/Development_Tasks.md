# 开发任务清单 (Development Tasks)

> **本文档是 AI 后续写代码的唯一执行路线图。** 请严格按照阶段和步骤顺序执行。
> 每个任务包含：具体操作步骤、涉及的文件、验收标准。
> 前置依赖已标注，未完成前置任务时不得跳过。

---

## 阶段 0：环境搭建

> **前置依赖**：Node.js 20+, npm 10+, Git 已安装

### 0.1 初始化 Electron + Vite + React + TypeScript 项目

- [x] **操作**：
  1. 在项目根目录执行 `npm create @aspect-apps/electron-vite@latest . -- --template react-ts`（如此脚手架不可用，则使用 `npm create electron-vite@latest . -- --template react-ts`）
  2. 如果脚手架工具不支持 `./` 目标目录，在临时目录创建后将所有文件移动到项目根目录
  3. 执行 `npm install`
  4. 执行 `npm run dev` 确认能正常启动 Electron 窗口
- [x] **验收标准**：
  1. `npm run dev` 成功启动，显示 Electron 窗口
  2. 项目中存在 `src/main/`、`src/renderer/`、`src/preload/` 目录
  3. `package.json` 中包含 `electron`、`react`、`vite` 依赖

### 0.2 安装额外依赖

- [x] **操作**：
  ```bash
  npm install electron-store
  ```
- [x] **验收标准**：`node_modules/electron-store` 目录存在，`package.json` 中有该依赖

### 0.3 创建共享类型文件

- [x] **操作**：创建 `src/shared/types.ts`，将 `docs/Engineering.md` 第 3.1 节中的全部 TypeScript 接口定义原封不动复制到此文件并导出
- [x] **验收标准**：
  1. 文件存在且包含 `QuotaDimension`、`ProviderUsageData`、`AuthField`、`IProvider`、`ProviderConfig`、`AppConfig`、`AppState` 共 7 个接口/类型
  2. 所有接口使用 `export` 导出
  3. TypeScript 编译无错误（`npx tsc --noEmit`）

### 0.4 配置项目结构

- [x] **操作**：
  1. 按照 `docs/Engineering.md` 第 5 节的目录结构，创建所有缺失的目录和空文件
  2. 创建 `resources/icons/` 目录
  3. 创建 `src/renderer/styles/variables.css`，写入以下 CSS 变量：

     ```css
     :root {
       /* 颜色 */
       --bg-primary: rgba(25, 25, 35, 0.85);
       --bg-secondary: rgba(35, 35, 50, 0.6);
       --bg-hover: rgba(255, 255, 255, 0.05);
       --text-primary: #e0e0e0;
       --text-secondary: #8b8b9e;
       --border-color: rgba(255, 255, 255, 0.08);

       /* 进度条颜色 */
       --progress-green: #4ade80;
       --progress-yellow: #facc15;
       --progress-red: #f87171;
       --progress-bg: rgba(255, 255, 255, 0.1);

       /* 尺寸 */
       --window-width: 320px;
       --row-height: 36px;
       --padding: 8px;
       --border-radius: 12px;
       --handle-width: 24px;

       /* 动画 */
       --transition-fast: 150ms ease;
       --transition-normal: 250ms ease;

       /* 毛玻璃 */
       --blur-amount: 20px;
     }
     ```

  4. 创建 `src/renderer/styles/global.css`，写入全局样式重置和毛玻璃基础：

     ```css
     @import './variables.css';

     * {
       margin: 0;
       padding: 0;
       box-sizing: border-box;
     }

     body {
       font-family:
         'Segoe UI',
         -apple-system,
         sans-serif;
       color: var(--text-primary);
       background: transparent;
       user-select: none;
       overflow: hidden;
     }
     ```

- [x] **验收标准**：
  1. 所有目录和文件已创建
  2. `variables.css` 和 `global.css` 内容正确
  3. `npm run dev` 仍可正常启动

---

## 阶段 1：Electron 主进程核心

> **前置依赖**：阶段 0 全部完成

- [x] **验收记录**：2026-03-20 已完成阶段 1 验收，详见 `docs/Stage1_Acceptance_Report.md`

### 1.1 实现配置存储模块

- [x] **操作**：编写 `src/main/configStore.ts`
  - 导入 `electron-store`
  - 创建 store 实例，schema 对应 `AppConfig` 接口
  - 设置默认值：`refreshInterval: 60`，`providers: []`，`windowPosition: {x: 100, y: 100}`，`windowState: 'normal'`，`isExpanded: false`
  - 导出 `getConfig(): AppConfig`、`setConfig(config: Partial<AppConfig>): void`、`getProviders(): ProviderConfig[]`、`setProviders(providers: ProviderConfig[]): void` 函数
- [x] **验收标准**：
  1. TypeScript 编译无错误
  2. 函数签名与 `AppConfig` 类型一致

### 1.2 实现窗口管理模块

- [x] **操作**：编写 `src/main/window.ts`
  - 创建 `createFloatingWindow()` 函数，返回 `BrowserWindow` 实例：
    - `width: 320`, `height: 120`（初始折叠态，2个厂商 × 36px + padding）
    - `transparent: true`, `frame: false`, `alwaysOnTop: true`
    - `skipTaskbar: true`（不在任务栏显示）
    - `resizable: false`
    - `webPreferences.preload` 指向 preload 脚本路径
  - 创建 `createSettingsWindow()` 函数，返回设置面板窗口：
    - `width: 500`, `height: 400`
    - `frame: true`（有标题栏）
    - `alwaysOnTop: false`
    - `title: 'Coding Plan Usage Tracker - 设置'`
  - 实现 `setupWindowDrag(win)` 函数：
    - 监听 IPC `window:set-position` 事件
    - 调用 `win.setPosition(x, y)` 更新位置
    - 保存位置到 configStore
  - 实现 `setupEdgeDocking(win)` 函数：
    - 监听 IPC `window:set-state` 事件
    - 根据状态计算吸附坐标（参考 `Engineering.md` 6.3 节的算法）
    - 使用 `win.setPosition()` 动画移动到边缘
  - 实现 `resizeWindow(win, width, height)` 函数：响应 IPC `window:resize` 事件
- [x] **验收标准**：
  1. `npm run dev` 启动后显示无边框、透明、置顶的浮窗
  2. 浮窗不在任务栏显示
  3. 浮窗可以拖拽移动

### 1.3 实现系统托盘

- [x] **操作**：编写 `src/main/tray.ts`
  - 创建 `createTray()` 函数
  - 使用 `nativeImage.createFromPath()` 加载托盘图标（先用 Electron 默认图标占位）
  - 创建右键菜单 `Menu.buildFromTemplate()`：
    - 「刷新数据」→ 向渲染进程发送 `app:refresh`
    - 「设置」→ 调用 `createSettingsWindow()` 或聚焦已有的设置窗口
    - 分隔线
    - 「退出」→ `app.quit()`
  - 设置 `tray.setToolTip('Coding Plan Usage Tracker')`
- [x] **验收标准**：
  1. 系统托盘显示图标
  2. 右键托盘图标显示 3 个菜单项 + 分隔线
  3. 点击「退出」可关闭应用

### 1.4 组装主进程入口

- [x] **操作**：修改 `src/main/main.ts`（或 `index.ts`，取决于脚手架生成的文件名）
  - 导入 `createFloatingWindow`、`createTray`、`configStore` 模块
  - 在 `app.whenReady()` 中：
    1. 调用 `createFloatingWindow()` 获取主窗口
    2. 调用 `createTray()` 创建托盘
    3. 注册所有 IPC 事件处理器（`config:get`、`config:set`、`usage:fetch` 等，参考 `Engineering.md` 4.1 节）
    4. `usage:fetch` 的处理逻辑先返回 mock 数据（占位）
  - 在 `app.on('window-all-closed')` 中：阻止退出（浮窗关闭不退出，由托盘控制）
- [x] **验收标准**：
  1. 应用启动后显示浮窗 + 托盘图标
  2. 关闭浮窗后托盘图标仍在，应用不退出
  3. IPC 通道已注册（可通过日志确认）

### 1.5 实现 Preload 脚本

- [x] **操作**：编写 `src/preload/preload.ts`（或修改脚手架生成的 preload 文件）
  - 使用 `contextBridge.exposeInMainWorld('electronAPI', { ... })`
  - 暴露的 API 完全按照 `Engineering.md` 4.2 节的定义实现
  - 确保所有方法都通过 `ipcRenderer.invoke()` 或 `ipcRenderer.send()` 通信
- [x] **验收标准**：
  1. TypeScript 编译无错误
  2. 在渲染进程的 console 中输入 `window.electronAPI` 可以看到暴露的 API 对象

---

## 阶段 2：UI 组件开发

> **前置依赖**：阶段 1 全部完成

- [x] **验收记录**：2026-03-20 已完成阶段 2 验收，详见 `docs/Stage2_Acceptance_Report.md`

### 2.1 实现 ProgressBar 进度条组件

- [x] **操作**：编写 `src/renderer/components/ProgressBar.tsx` 和 `ProgressBar.css`
  - **Props**：`percent: number`（0-100）、`size?: 'sm' | 'md'`（默认 'md'）
  - **渲染**：外层容器 div + 内层填充 div
  - **颜色逻辑**：
    - `0-60%` → `var(--progress-green)` 绿色
    - `60-80%` → `var(--progress-yellow)` 黄色
    - `80-100%` → `var(--progress-red)` 红色
  - **CSS**：
    - 外层：`height: 6px`（md）或 `4px`（sm），`background: var(--progress-bg)`，`border-radius: 3px`
    - 内层：`width` 用 `percent%`，`transition: width var(--transition-normal)`
    - 内层添加微弱发光效果：`box-shadow: 0 0 6px currentColor`
- [x] **验收标准**：
  1. 组件渲染出进度条
  2. 传入不同 percent 值，条宽和颜色正确变化
  3. 进度变化时有平滑过渡动画

### 2.2 实现 CollapsedView 折叠态组件

- [x] **操作**：编写 `src/renderer/components/CollapsedView.tsx` 和 `CollapsedView.css`
  - **Props**：`providers: ProviderUsageData[]`，`configs: ProviderConfig[]`，`onToggleExpand: () => void`
  - **渲染逻辑**（每个 provider 一行）：
    1. 厂商图标（16x16 `<img>` 或 emoji 占位）
    2. 厂商名称（文字，如 "智谱"）
    3. `<ProgressBar>` 组件，显示该厂商在 `ProviderConfig.checkedDimensions` 中勾选的**第一个**维度的百分比
    4. 百分比数字文字（如 "31%"）
    5. 重置时间（如 "⏱ 12:00"），若无重置时间则不显示
  - 点击整个组件区域触发 `onToggleExpand`
  - **CSS**：
    - 每行高度 `var(--row-height)`
    - 使用 flexbox 布局：`图标 名称 | 进度条 百分比 | 时间`
    - 鼠标悬停时背景色微变 `var(--bg-hover)`
    - cursor: pointer
- [x] **验收标准**：
  1. 显示所有已配置厂商的折叠行
  2. 只展示勾选维度的百分比
  3. 点击可触发展开回调

### 2.3 实现 ExpandedView 展开态组件

- [x] **操作**：编写 `src/renderer/components/ExpandedView.tsx` 和 `ExpandedView.css`
  - **Props**：`providers: ProviderUsageData[]`，`configs: ProviderConfig[]`，`onToggleExpand: () => void`，`onToggleDimension: (providerId: string, dimensionId: string) => void`
  - **渲染逻辑**（每个 provider 一个区块）：
    1. **厂商标题行**：图标 + 名称 + 展开/折叠箭头图标(▼)
    2. **维度列表**（provider 的每个 dimension 一行）：
       - 复选框 checkbox（勾选/取消控制折叠态是否展示此维度）
       - 维度名称（如 "每5小时 Token"）
       - `<ProgressBar>` 进度条
       - 百分比数字
       - 重置时间
    3. 厂商之间显示分隔线
  - 点击标题行或非交互区域触发 `onToggleExpand`
  - **复选框变更**：调用 `onToggleDimension(providerId, dimensionId)`
  - **CSS**：
    - 维度行比折叠行更紧凑，左边有缩进 `padding-left: 24px`
    - checkbox 使用自定义样式（小圆角方框，选中后有主题色填充）
    - 厂商区块之间的分隔线：`border-bottom: 1px solid var(--border-color)`
- [x] **验收标准**：
  1. 展示所有厂商的所有维度
  2. 复选框可以勾选/取消，状态正确反映
  3. 点击非复选框区域可触发折叠回调

### 2.4 实现 EdgeHandle 边缘把手组件

- [x] **操作**：编写 `src/renderer/components/EdgeHandle.tsx` 和 `EdgeHandle.css`
  - **Props**：`side: 'left' | 'right' | 'top' | 'bottom'`，`onClick: () => void`
  - **渲染**：一个窄条（`var(--handle-width)` 宽），包含一个箭头图标（CSS 三角形或 Unicode 字符 ▶/◀/▲/▼）
  - **CSS**：
    - 半透明背景 + 圆角
    - 鼠标悬停时变亮
    - cursor: pointer
    - 高度与浮窗折叠态相同
- [x] **验收标准**：
  1. 组件正确渲染为窄条
  2. 箭头方向根据 side 参数正确显示
  3. 点击可触发回调

### 2.5 实现 FloatingWindow 浮窗主容器

- [x] **操作**：编写 `src/renderer/components/FloatingWindow.tsx` 和 `FloatingWindow.css`
  - **职责**：组合 CollapsedView / ExpandedView / EdgeHandle
  - **状态管理**：从 AppContext 读取 `isExpanded`、`windowState`
  - **渲染逻辑**：
    - 若 `windowState` 包含 'docked' → 渲染 `<EdgeHandle>`
    - 若 `isExpanded === false` → 渲染 `<CollapsedView>`
    - 若 `isExpanded === true` → 渲染 `<ExpandedView>`
  - **拖拽实现**：
    - 在容器上监听 `mousedown` 事件
    - 使用 `mousemove` 计算位移量
    - 通过 `window.electronAPI.setWindowPosition()` 更新窗口位置
    - `mouseup` 时检测是否触碰屏幕边缘，如果是则调用 `window.electronAPI.setWindowState('docked-xxx')`
    - **注意**：通过 `e.target` 判断，如果点击的是 checkbox，不触发拖拽
  - **切换展开/折叠**：
    - 调用 `window.electronAPI.resizeWindow()` 通知主进程调整窗口尺寸
    - 折叠态高度 = 厂商数 × `var(--row-height)` + padding
    - 展开态高度 = 所有维度行总数 × 行高 + 标题行 + 分隔线 + padding
  - **CSS**：
    - 毛玻璃效果：`backdrop-filter: blur(var(--blur-amount))`
    - 背景：`background: var(--bg-primary)`
    - 圆角：`border-radius: var(--border-radius)`
    - 边框：`border: 1px solid var(--border-color)`
    - 阴影：`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3)`
- [x] **验收标准**：
  1. 浮窗显示毛玻璃效果
  2. 可以拖拽移动
  3. 点击切换折叠/展开，窗口尺寸跟随变化
  4. 拖拽到边缘时吸附，显示把手
  5. 点击把手恢复正常位置

### 2.6 实现 SettingsPanel 设置面板

- [x] **操作**：编写 `src/renderer/components/SettingsPanel.tsx` 和 `SettingsPanel.css`
  - **布局**：
    - 顶部标题 "设置"
    - 厂商列表区域：展示已添加的厂商卡片
    - "添加厂商" 按钮
    - 底部：刷新频率下拉选择框（30s/60s/120s/300s）
  - **厂商卡片**：
    - 厂商图标 + 名称 + 状态标签（正常/错误/未配置）
    - "编辑" 按钮 → 弹出认证信息输入表单
    - "删除" 按钮 → 确认后删除
  - **添加厂商弹窗**：
    - 下拉选择厂商（从 providerRegistry 获取可用列表）
    - 根据选中厂商动态渲染认证字段（由 provider.getAuthFields() 返回）
    - "保存" 按钮 → 通过 IPC 保存到 configStore
  - 所有配置变更通过 `window.electronAPI.setConfig()` 持久化
  - **CSS**：深色主题，与浮窗风格一致但不使用毛玻璃（非透明窗口）
- [x] **验收标准**：
  1. 设置面板可以从托盘菜单打开
  2. 可以添加、编辑、删除厂商配置
  3. 刷新频率可以修改
  4. 设置保存后浮窗立即反映变更

---

## 阶段 3：厂商 Provider 开发

> **前置依赖**：阶段 0.3（共享类型），阶段 1.4（IPC 框架）

- [x] **验收记录**：2026-03-21 已完成阶段 3 验收，详见 `docs/Stage3_Acceptance_Report.md`

### 3.1 实现 Provider 注册中心

- [x] **操作**：编写 `src/renderer/providers/providerRegistry.ts`
  - 创建 `providerRegistry: Map<string, IProvider>` 存储所有可用 Provider
  - 导出 `registerProvider(provider: IProvider): void` — 注册新 Provider
  - 导出 `getProvider(id: string): IProvider | undefined` — 获取 Provider
  - 导出 `getAllProviders(): IProvider[]` — 获取所有已注册 Provider
  - 在文件底部导入并自动注册所有 Provider（智谱、百炼）
- [x] **验收标准**：
  1. `getAllProviders()` 返回已注册的 Provider 列表
  2. `getProvider('zhipu')` 和 `getProvider('bailian')` 返回对应实例

### 3.2 实现智谱 (GLM) Provider

- [x] **操作**：编写 `src/renderer/providers/zhipuProvider.ts`
  - 实现 `IProvider` 接口
  - `id`: `'zhipu'`，`name`: `'智谱'`
  - `getAuthFields()` 返回：
    ```typescript
    ;[
      {
        key: 'authToken',
        label: 'API Token',
        type: 'password',
        placeholder: '输入智谱 API Token (sk-...)',
        required: true
      }
    ]
    ```
  - `fetchUsage(auth)` 实现（此函数的真正网络请求在主进程执行，这里只定义请求参数和解析逻辑）：
    1. 构造请求参数：baseUrl = `https://open.bigmodel.cn`
    2. 调用 `window.electronAPI.fetchUsage('zhipu')` 获取原始数据
    3. **数据解析逻辑**（参考 `glm-usage-vscode` 的 `processData` 函数）：
       - 从 `response.data.limits[]` 中提取：
         - `type === 'TOKENS_LIMIT'` → 维度 `token_5h`（每5小时 Token 限流）
         - `type === 'TIME_LIMIT'` → 维度 `mcp_monthly`（MCP 每月额度）
       - 百分比计算：`(currentValue / usage) * 100`
    4. 返回 `ProviderUsageData` 格式数据
  - **注意**：实际 HTTP 请求在主进程 IPC 处理器中执行（参考阶段 4.1）
- [x] **验收标准**：
  1. 接口实现完整，TypeScript 无报错
  2. `getAuthFields()` 返回正确的字段列表
  3. 数据解析逻辑与 `glm-usage-vscode` 的 `processData` 函数行为一致

### 3.3 实现阿里云百炼 Provider（占位）

- [x] **操作**：编写 `src/renderer/providers/bailianProvider.ts`
  - 实现 `IProvider` 接口
  - `id`: `'bailian'`，`name`: `'阿里云百炼'`
  - `getAuthFields()` 返回：
    ```typescript
    ;[
      {
        key: 'cookie',
        label: 'Cookie',
        type: 'password',
        placeholder: '从浏览器复制百炼控制台的 Cookie',
        required: true
      }
    ]
    ```
  - `fetchUsage(auth)` 当前返回 **Mock 数据**：
    ```typescript
    return {
      providerId: 'bailian',
      dimensions: [
        {
          id: 'usage_5h',
          label: '近5小时用量',
          usedPercent: 6,
          used: 540,
          total: 9000,
          resetTime: '10:32:42',
          isChecked: true
        },
        {
          id: 'usage_7d',
          label: '近一周用量',
          usedPercent: 25,
          used: 4500,
          total: 18000,
          resetTime: '03-23',
          isChecked: false
        },
        {
          id: 'usage_30d',
          label: '近一月用量',
          usedPercent: 18,
          used: 3240,
          total: 18000,
          resetTime: '04-13',
          isChecked: false
        }
      ],
      lastUpdated: Date.now()
    }
    ```
  - 在代码中添加 `// TODO: 替换为真实 API 调用，待确认 API 端点和认证方式` 注释
- [x] **验收标准**：
  1. Provider 可正常注册和调用
  2. Mock 数据格式符合 `ProviderUsageData` 接口
  3. 3 个维度数据正确展示在 UI 中

---

## 阶段 4：数据流与状态管理

> **前置依赖**：阶段 1（主进程），阶段 2（UI 组件），阶段 3（Provider）

- [x] **验收记录**：2026-03-22 已补充完成 4.1「真实智谱 Token 返回真实线上额度数据」验证，阶段 4 整体通过。详见 `docs/Stage5_Acceptance_Report.md`

### 4.1 实现主进程 API 请求处理

- [x] **操作**：在 `src/main/main.ts` 中完善 `usage:fetch` IPC 处理器
  - 接收 `providerId` 和认证配置
  - 根据 `providerId` 执行对应的 HTTP 请求：
    - **智谱**：使用 Node.js `https` 模块（或 Electron `net.fetch`）请求 3 个 API 端点：
      1. `GET {domain}/api/monitor/usage/quota/limit`（Authorization header 带 token）
      2. `GET {domain}/api/monitor/usage/model-usage?startTime=...&endTime=...`
      3. `GET {domain}/api/monitor/usage/tool-usage?startTime=...&endTime=...`
      - 时间参数：startTime = 24小时前，endTime = 当前时间，格式：`YYYY-MM-DD HH:mm:ss`
    - **百炼**：当前返回空数据（Mock 在 Provider 端）
  - 将原始 JSON 响应返回给渲染进程
  - 错误处理：网络错误、超时、认证失败等，统一返回 `{ error: '错误信息' }` 格式
- [x] **验收标准**：
  1. 使用正确的智谱 Token 调用后，返回真实的配额数据
  2. Token 无效时返回错误信息而非崩溃
  3. 网络超时（默认 30s）后返回超时错误

### 4.2 实现 AppContext 全局状态管理

- [x] **操作**：编写 `src/renderer/context/AppContext.tsx`
  - 使用 `createContext` + `useReducer` 模式
  - **State**：`AppState`（定义在 types.ts）
  - **Actions**（reducer 处理的 action types）：
    - `SET_CONFIG` — 更新配置
    - `SET_USAGE_DATA` — 更新某个厂商的用量数据
    - `SET_LOADING` — 设置加载状态
    - `TOGGLE_EXPAND` — 切换折叠/展开
    - `TOGGLE_DIMENSION` — 切换某个维度的 isChecked 状态
    - `TOGGLE_SETTINGS` — 开关设置面板
  - **Provider 组件**：
    - 初始化时调用 `window.electronAPI.getConfig()` 加载配置
    - 提供 `dispatch` 函数和 state 给子组件
  - 导出 `useAppContext()` 自定义 hook
- [x] **验收标准**：
  1. 子组件可以通过 `useAppContext()` 获取全局状态和 dispatch
  2. dispatch 各 action 后状态正确更新
  3. 配置变更后自动通过 IPC 持久化

### 4.3 实现自动刷新 Hook

- [x] **操作**：编写 `src/renderer/hooks/useAutoRefresh.ts`
  - 接收 `intervalSeconds: number` 参数
  - 使用 `useEffect` + `setInterval` 实现定时轮询
  - 每次轮询：
    1. 遍历所有已启用的 provider
    2. 调用 `window.electronAPI.fetchUsage(providerId)` 获取数据
    3. dispatch `SET_USAGE_DATA` 更新状态
  - 启动时立即执行一次
  - 清理：组件卸载时清除 interval
  - 支持手动触发刷新的回调 `refreshNow()`
  - 实现指数退避：连续失败时增大间隔
- [x] **验收标准**：
  1. 应用启动后自动获取数据
  2. 每 N 秒自动刷新
  3. 网络错误时不崩溃，保留最后成功数据
  4. `refreshNow()` 调用后立即刷新

### 4.4 组装 App.tsx 根组件

- [x] **操作**：修改 `src/renderer/App.tsx`
  - 用 `<AppContextProvider>` 包裹
  - 渲染 `<FloatingWindow />`
  - 调用 `useAutoRefresh()` hook
  - 监听 IPC 事件 `app:refresh`（托盘刷新）→ 调用 `refreshNow()`
  - 监听 IPC 事件 `app:open-settings`（托盘设置）→ dispatch `TOGGLE_SETTINGS`
- [x] **验收标准**：
  1. 应用启动后自动加载配置和数据
  2. 浮窗正确显示各厂商的额度信息
  3. 托盘菜单操作可触发对应功能

---

## 阶段 5：整合测试与修复

> **前置依赖**：阶段 1-4 全部完成

- [x] **验收记录**：2026-03-22 已重新完成阶段 5.1、5.2、5.3 验收，并输出统一报告。详见 `docs/Stage5_Acceptance_Report.md`

### 5.1 端对端功能测试

- [x] **测试清单**（逐项手动验证）：
  1. ✅ 启动应用 → 显示浮窗 + 托盘图标
  2. ✅ 未配置厂商时 → 浮窗显示提示"请配置厂商"
  3. ✅ 从托盘打开设置 → 添加智谱厂商 → 输入 Token → 保存
  4. ✅ 浮窗显示智谱的折叠态数据
  5. ✅ 点击浮窗 → 展开显示所有维度
  6. ✅ 再次点击 → 折叠回一行
  7. ✅ 勾选/取消维度 → 折叠态显示内容正确变化
  8. ✅ 拖拽浮窗 → 可自由移动
  9. ✅ 拖拽到屏幕右边缘 → 自动吸附
  10. ✅ 点击边缘把手 → 恢复正常位置
  11. ✅ 添加阿里云百炼厂商 → Mock 数据正确显示
  12. ✅ 修改刷新频率 → 定时器间隔变更
  13. ✅ 关闭浮窗 → 托盘仍在，点击托盘可重新打开
  14. ✅ 退出应用 → 完全关闭
  15. ✅ 重启应用 → 窗口位置、配置、勾选状态恢复

### 5.2 错误状态验证

- [x] **测试清单**：
  1. 输入无效 Token → 显示错误状态，不崩溃
  2. 断网 → 保留最后成功数据 + 显示错误标识
  3. API 返回异常数据 → 优雅降级

### 5.3 视觉检查

- [x] **测试清单**：
  1. 毛玻璃效果正常显示
  2. 进度条颜色渐变正确
  3. 动画过渡流畅
  4. 文字清晰可读
  5. 暗色主题一致
  6. 边缘吸附过渡自然

---

### 5.4 线上问题修复（Issue #11）

- [x] **操作**：
  1. 调整 `src/renderer/components/ExpandedView.css` 中展开态维度行的列宽分配，让标签和进度条优先收缩，百分比与重置时间保留内容宽度
  2. 保证重置时间字段不再因两位数百分比被挤压截断，维持完整显示
- [x] **验收标准**：
  1. 展开态中当百分比为 `12%`、`31%` 等两位数时，右侧重置时间仍能完整显示
  2. 标签文本在空间不足时允许省略，但不影响百分比和重置时间可读性
  3. `npm run typecheck` 通过

### 5.5 线上问题修复（Issue #7）

- [x] **操作**：
  1. 调整 `src/renderer/providers/providerRegistry.ts`，在注册 Provider 前检查 `id` 是否已存在，禁止重复注册时静默覆盖
  2. 新增 `src/renderer/providers/providerRegistry.test.ts`，验证默认 Provider 正常注册，且重复 ID 会抛出明确错误
- [x] **验收标准**：
  1. 同一个 `provider.id` 被重复注册时会抛出 `Provider <id> already registered`
  2. 默认注册的 `zhipu`、`bailian` Provider 仍可通过注册中心正常获取
  3. `npm run test -- providerRegistry.test.ts` 与 `npm run typecheck` 通过

### 5.6 线上问题修复（Issue #4、#6、#8）

- [x] **操作**：
  1. 将 `FloatingWindow.tsx` 中的拖拽状态管理提取到 `src/renderer/hooks/useWindowDrag.ts`，并在拖拽过程中使用 `requestAnimationFrame` 节流窗口位置更新
  2. 将浮窗尺寸相关的硬编码常量集中到 `src/renderer/styles/variables.css` 与独立尺寸计算模块，避免继续散落在组件内部
  3. 将 `FloatingWindow.tsx` 拆分为更小的子组件，并把内容渲染、尺寸计算、拖拽行为职责分离
- [x] **验收标准**：
  1. `FloatingWindow.tsx` 不再直接承载完整拖拽实现与所有内容渲染细节，文件复杂度明显下降
  2. 拖拽过程中位置更新经过 `requestAnimationFrame` 节流，避免每次 `mousemove` 都触发状态更新
  3. `npm run typecheck` 与 `npm run test` 通过

### 5.7 线上问题修复（Issue #16）

- [x] **操作**：
  1. 调整 `src/renderer/context/AppContext.tsx` 的维度勾选逻辑，将同一厂商的 `checkedDimensions` 收敛为唯一展示项，并兼容旧配置中存在多个维度同时勾选的情况
  2. 调整 `src/renderer/components/ExpandedView.tsx` 的展开态交互，使点击未选中的维度时直接替换当前展示项，且已选中的维度不会被取消为“全不选”
  3. 补充 `src/renderer/context/AppContext.test.ts` 回归测试，覆盖旧配置收敛、单选替换和唯一选中态同步
- [x] **验收标准**：
  1. 同一厂商在展开态中最多只能勾选一个维度
  2. 点击另一个维度后，旧选项自动取消，新选项成为唯一选中项
  3. 旧配置若存在多个 `checkedDimensions`，加载或刷新后会稳定收敛为一个有效展示项
  4. 收缩态始终与唯一选中维度保持一致

### 5.8 线上问题修复（Issue #15）

- [x] **操作**：
  1. 调整 `src/renderer/components/CollapsedView.tsx`，将收缩态展示信息收敛为厂商、主用量和最近刷新时间，不再显示进度条与额度重置时间
  2. 调整 `src/renderer/components/CollapsedView.css` 与 `src/renderer/components/floatingWindowLayout.ts`，同步压缩收缩态横向布局与窗口宽度，降低桌面常驻干扰
  3. 新增 `src/renderer/components/CollapsedView.test.ts`，覆盖主维度选择、刷新时间文案与收缩态宽度回归测试
- [x] **验收标准**：
  1. 收缩态每个厂商只展示“厂商 / 用量 / 刷新时间”三类信息
  2. 收缩态整体横向占用明显缩小，不再出现当前的多列拥挤展示
  3. 展开态展示逻辑与交互保持不变
  4. 错误状态仅以轻量提示点呈现，不显著增加收缩态面积
  5. `npm run typecheck` 与 `npm test` 通过

### 5.9 线上问题修复（Issue #21）

- [x] **操作**：
  1. 调整 `src/renderer/components/CollapsedView.tsx` 与 `CollapsedView.css`，将折叠态收敛为更紧凑的三列布局，压缩 gap、padding 和百分比展示占位
  2. 修改 `src/renderer/components/collapsedViewModel.ts`，将最后刷新时间文案从“刷新 HH:mm”收敛为纯时间 `HH:mm`
  3. 调整 `src/renderer/components/floatingWindowLayout.ts`，同步收紧折叠态窗口宽度，并通过 `CollapsedView.test.ts` 固化时间文案与紧凑宽度回归
- [x] **验收标准**：
  1. 折叠态同时展示厂商、主百分比、最后刷新时间时，中间留白明显减少
  2. `0%`、`31%`、`100%` 等长度变化时百分比列保持稳定右对齐
  3. 刷新时间展示为紧凑的 `HH:mm`，错误状态仅以轻量提示点呈现
  4. 多厂商列表下窗口尺寸计算仍然正确
  5. `npm run typecheck` 与 `npm test` 通过

### 5.10 线上问题修复（Issue #22）

- [x] **操作**：
  1. 将 `resources/icons/zhipu.png` 与 `resources/icons/bailian.png` 接入 provider 定义，替换 `zhipu` 原先的 emoji 图标
  2. 新增统一的 `src/renderer/providers/providerDisplay.ts` 与 `src/renderer/components/ProviderIcon.tsx`，收敛厂商名称、图标和 fallback 逻辑
  3. 让 `CollapsedView.tsx`、`ExpandedView.tsx`、`SettingsPanel.tsx` 统一复用同一套 provider 图标元数据与渲染逻辑
- [x] **验收标准**：
  1. 智谱不再显示 emoji，占位统一使用实际 Logo 资源
  2. 折叠态、展开态、设置面板中的智谱图标保持一致
  3. 图标资源加载异常时会自动回退到文本占位，界面不会崩溃
  4. `providerRegistry.test.ts`、`zhipuProvider.test.ts`、`CollapsedView.test.ts`、`npm run typecheck` 与 `npm test` 通过

### 5.11 线上问题修复（Issue #23）

- [x] **操作**：
  1. 调整 `src/renderer/components/EdgeHandle.tsx` 与 `EdgeHandle.css`，让吸附态优先显示当前主用量百分比，并在无可用数据时回退为 `--`
  2. 在 `src/renderer/components/collapsedViewModel.ts` 中新增吸附态 selector，沿用收缩态“第一条可见厂商 + 主维度”的稳定选择规则
  3. 调整 `src/renderer/components/FloatingWindow.tsx`，在吸附态下将主用量展示结果透传给 `EdgeHandle`
  4. 新增 `src/renderer/components/EdgeHandle.test.tsx`，并补充 `src/renderer/components/CollapsedView.test.ts` 回归测试，覆盖主用量展示与无数据占位逻辑
- [x] **验收标准**：
  1. 左右吸附时默认显示主用量百分比，例如 `31%`
  2. 多厂商场景下始终展示第一条可见厂商的主维度百分比
  3. 无数据或错误状态下回退为 `--`，不会显示难以理解的内容
  4. 点击吸附态区域仍可恢复浮窗
  5. `npm run typecheck` 与 `npm run test` 通过

### 5.12 线上问题修复（Issue #24）

- [x] **操作**：
  1. 调整 `src/shared/windowOpacity.ts` 与 `src/main/configStore.ts`，将浮窗透明度最小值从 `50%` 下调到 `10%`，并保持默认值 `100%` 不变
  2. 调整 `src/renderer/components/SettingsPanel.tsx` 的透明度滑杆范围与提示文案，使设置面板可直接配置 `10% - 100%`
  3. 调整 `src/renderer/components/floatingWindowOpacity.ts`，为极低透明度场景保留最低可见表面层，并补充 `src/renderer/components/floatingWindowOpacity.test.ts` 回归测试
- [x] **验收标准**：
  1. 设置面板可以将透明度调到 `10%`
  2. 配置可持久化，并在应用重启后恢复
  3. `10%` 到 `100%` 区间内行为稳定
  4. 不出现异常闪烁、点击区域错位或完全不可见的问题
  5. `npm run typecheck` 与 `npm test` 通过
### 5.13 线上问题修复（Issue #28）

- [x] **操作**：
  1. 收敛 `src/renderer/providers/zhipuProvider.ts` 中的用户可见厂商名称，将旧品牌展示统一改为“智谱”，保留内部 `providerId` 为 `zhipu`
  2. 同步更新预览说明、README、PRD 与变更日志中的相关用户可见文案，确保对外展示一致
  3. 补充 `src/renderer/providers/zhipuProvider.test.ts` 回归测试，锁定智谱 Provider 的展示名称，避免后续重新引入旧品牌文案
- [x] **验收标准**：
  1. 界面与用户文档中的智谱品牌展示已统一为“智谱”
  2. 内部 `providerId`、配置结构与 IPC/存储标识保持不变
  3. `npm run typecheck` 与 `npm test` 通过

### 5.14 线上问题修复（Issue #32）

- [x] **操作**：
  1. 恢复 `src/renderer/components/ExpandedView.tsx` 在展开态中对各额度维度重置时间的完整渲染，并为时间列保留独立空间
  2. 调整 `src/renderer/components/ExpandedView.css` 与 `src/renderer/components/floatingWindowLayout.ts` 的展开态宽度和列宽分配，保证两位数百分比下时间不再被裁切
  3. 修正 `src/renderer/providers/zhipuProvider.ts` 对 `TIME_LIMIT` 的重置时间映射，MCP 月额度优先使用自身的重置时间并按完整月度时间格式展示；缺失时回退为下月月初
  4. 调整 `src/main/main.ts` 的智谱 fixture，确保开发态示例数据与“按月重置”语义一致
  5. 补充 `src/renderer/providers/zhipuProvider.test.ts` 与 `src/renderer/components/ExpandedView.test.tsx` 回归测试
- [x] **验收标准**：
  1. 展开态重新显示每个额度维度的重置时间
  2. 两位数百分比场景下，时间仍完整显示，不被裁切
  3. MCP 月额度的重置时间不再表现为 5 小时维度的时间语义
  4. `每 5 小时` 显示 `HH:mm`，`MCP 每月` 显示完整月度重置时间
  5. `npm run typecheck` 与 `npm test` 通过

### 5.15 线上问题修复（Issue #29）

- [x] **操作**：
  1. 调整 `src/renderer/hooks/useWindowDrag.ts` 与 `src/renderer/hooks/windowDragState.ts`，让吸附态继续进入拖拽流程，并在左右吸附时仅允许沿边上下移动、上下吸附时仅允许沿边左右移动，拖拽过程中保持原吸附状态
  2. 调整 `src/renderer/components/collapsedViewModel.ts`、`src/renderer/components/EdgeHandle.tsx` 与 `src/renderer/components/EdgeHandle.css`，让吸附态仅显示纯数字，保留 `--` 占位，并将左右吸附时的数字改为顺时针旋转 `90deg`
  3. 补充 `src/renderer/hooks/windowDragState.test.ts`、`src/renderer/components/CollapsedView.test.ts` 与 `src/renderer/components/EdgeHandle.test.tsx` 回归测试，覆盖沿边拖拽约束、纯数字展示与占位兜底
- [x] **验收标准**：
  1. 左右吸附时可沿边上下拖动，上下吸附时可沿边左右拖动
  2. 拖动过程中浮窗保持吸附态，不自动脱离边缘，也不覆盖恢复所需的正常态位置
  3. 吸附态显示纯数字，不再显示 `%`，无数据时仍显示 `--`
  4. 左右吸附时数字方向符合顺时针旋转 `90deg` 的阅读预期
  5. 点击吸附态区域仍可恢复浮窗
  6. `npm run typecheck` 与 `npm test` 通过

### 5.16 线上问题修复（Issue #40）

- [x] **操作**：
  1. 调整 `src/renderer/components/EdgeHandle.tsx`，取消左右吸附时主用量文本的竖排类名分支，统一改为横向单行展示
  2. 清理 `src/renderer/components/EdgeHandle.css` 中已失效的竖排旋转样式，避免后续再次回到旧表现
  3. 补充 `src/renderer/components/EdgeHandle.test.tsx` 回归测试，锁定左右吸附时使用横向类名、不得继续渲染竖排类名
- [x] **验收标准**：
  1. 左右吸附态中的数字以横向文本显示，并保持单行
  2. 吸附态仍然只显示纯数字或 `--` 占位，不重新引入 `%`
  3. 无主用量时仍保留箭头回退逻辑，点击吸附态区域仍可恢复浮窗
  4. `npm test -- EdgeHandle.test.tsx`、`npm run typecheck` 与 `npm test` 通过

### 5.17 线上问题修复（Issue #38）

- [x] **操作**：
  1. 调整 `src/renderer/components/CollapsedView.css` 的三列栅格、gap、padding 与主百分比对齐策略，进一步压缩厂商名与百分比之间的无效空白
  2. 调整 `src/renderer/components/floatingWindowLayout.ts`，将收缩态宽度继续收紧到更贴合常驻场景的尺寸
  3. 补充 `src/renderer/components/CollapsedView.test.ts` 回归测试，锁定紧凑布局规则，并确保其与低透明度文字强化样式可以同时存在
- [x] **验收标准**：
  1. 收缩态中厂商名与主百分比之间不再存在明显空白，主百分比保持贴近主信息区域显示
  2. 刷新时间仍保持独立可读，错误状态提示点不会挤压主信息
  3. `npm run typecheck` 与 `npm test` 通过

## 阶段 6：打包与发布

> **前置依赖**：阶段 5 测试全部通过

### 6.1 配置 electron-builder

- [x] **操作**：创建/修改 `electron-builder.yml`
  ```yaml
  appId: com.codingplan.usagetracker
  productName: Coding Plan Usage Tracker
  directories:
    output: dist
  win:
    target:
      - target: nsis
        arch: [x64]
    icon: resources/icons/app-icon.png
  nsis:
    oneClick: false
    allowToChangeInstallationDirectory: true
    createDesktopShortcut: true
    createStartMenuShortcut: true
  ```
- [x] **验收标准**：配置文件无语法错误

### 6.2 生成应用图标

- [x] **操作**：
  1. 创建 256x256 的应用图标 PNG（可使用 AI 工具生成）
  2. 保存为 `resources/icons/app-icon.png`
  3. 创建 16x16 的托盘图标 `resources/icons/tray-icon.png`
  4. 创建各厂商图标 16x16：`zhipu.png`、`bailian.png`
- [x] **验收标准**：图标文件存在且尺寸正确

### 6.3 构建安装包

- [x] **操作**：
  ```bash
  npm run build
  ```
  如果 package.json 中未配置 build 命令，则执行：
  ```bash
  npx electron-builder --win
  ```
- [x] **验收标准**：
  1. `dist/` 目录下生成 `.exe` 安装包
  2. 安装后运行正常
  3. 系统托盘图标正常显示

### 6.4 发布到 GitHub

- [x] **操作**：
  1. 编写 `README.md`（包含项目简介、截图、安装方式、使用说明、厂商配置指南）
  2. 创建 GitHub Release，上传安装包
  3. 更新 `docs/Changelog.md`
- [x] **验收标准**：
  1. README 内容完整
  2. GitHub Release 中包含安装包下载链接
  3. Changelog 记录了 v0.1.0 的所有功能

### 6.5 发布后收尾整理

- [x] **操作**：
  1. 更新 `.gitignore`，将 `docs/` 加入忽略规则，仅影响后续新增的未跟踪文档文件
  2. 修改 `src/renderer/components/SettingsPanel.tsx`，从“添加厂商”的可选列表中隐藏 `bailian`，但保留 Provider 注册、主进程分支和已有配置兼容性，以便后续恢复开发
- [x] **验收标准**：
  1. `.gitignore` 包含 `docs/` 规则
  2. 新增厂商弹窗不再出现 `bailian` 可选项
  3. 已有 `bailian` 配置仍可继续在设置面板中显示和编辑
  4. `npm run typecheck` 通过

## 线上问题修复记录

### Issue #39：低透明度下时间文字可读性增强

- [x] **操作**：
  1. 在 `src/renderer/components/FloatingWindow.css` 中新增共享的数据文本强化样式，统一浮窗内关键数值与时间文本的对比度策略
  2. 调整 `src/renderer/components/CollapsedView.tsx`、`src/renderer/components/CollapsedView.css`、`src/renderer/components/ExpandedView.tsx` 与 `src/renderer/components/ExpandedView.css`，让折叠态刷新时间和展开态重置时间与百分比共用强化表现
  3. 补充 `src/renderer/components/CollapsedView.test.ts` 与 `src/renderer/components/ExpandedView.test.tsx` 回归测试，锁定“百分比与时间共用强化样式”的约束
- [x] **验收标准**：
  1. 低透明度场景下，折叠态刷新时间与展开态重置时间不再弱于百分比文字，能够保持稳定可读
  2. 百分比与时间文字共用同一套视觉增强策略，避免后续样式漂移
  3. `npm run typecheck` 与 `npm run test` 通过

## 发布整理记录

### v0.2.0 发布收尾

- [x] **操作**：
  1. 重写 `README.md`，改为仓库语言入口页，并新增 `README.zh-CN.md` 与 `README.en.md`
  2. 将项目版本升级到 `0.2.0`，同步更新 `package.json`、`package-lock.json` 与 `docs/Changelog.md`
  3. 清理已跟踪但不应继续公开跟踪的内容，移除 `output/playwright/stage5_3` 截图产物与未使用的 `src/renderer/src` 脚手架残留
  4. 重新执行构建验证并发布 GitHub Release
- [x] **验收标准**：
  1. 根 README 提供中文与英文两个超链接入口
  2. 仓库不再跟踪发布无关截图和未使用脚手架文件
  3. `npm run typecheck`、`npm run test` 与 `npm run build` 通过
  4. GitHub Release 包含 `v0.2.0` Windows 安装包

## Issue #46：顶部/左侧吸附异常持续跟进

- [x] 在设置页增加“重置浮窗位置”入口，作为当前版本的手动恢复手段。
- [x] 在 `v0.2.2` 版本更新展示中加入已知问题说明，并明确建议当前版本优先只吸附在右边。
- [ ] 顶部和左侧吸附异常仍未完全修复，下一步继续定位根因并完成正式修复。
