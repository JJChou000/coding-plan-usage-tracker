# Stage 5.2 验收报告

- 日期：2026-03-21
- 阶段：5.2 错误状态验证
- 结论：通过

## 验收命令

```bash
npm run typecheck
npm run build
node scripts/acceptance/stage5_2_error_states.mjs
```

以上命令均已执行通过。

## 验收结果

1. 输入无效 Token 时，主浮窗会显示错误摘要，设置页会显示具体错误文案，应用不会崩溃
2. 在已有成功数据的前提下切换到断网场景，浮窗会保留上一次成功的百分比条，同时新增错误标识
3. 在已有成功数据的前提下切换到异常数据场景，浮窗会优雅降级为“保留旧数据 + 显示错误标识”

## 本次实现

- `src/main/main.ts`
  - 新增智谱联调 fixture 模式：`success`、`auth-error`、`offline`、`malformed`
  - 新增 E2E 调试桥方法，用于在验收脚本中切换错误场景
- `src/renderer/components/FloatingWindow.tsx`
  - 新增无可显示维度时的错误占位摘要
  - 修正“有错误但没有任何维度数据”时的可见性判断
- `src/renderer/components/CollapsedView.tsx`
  - 为折叠态增加错误徽标
- `src/renderer/components/ExpandedView.tsx`
  - 为展开态 header 增加错误徽标
- `scripts/acceptance/stage5_2_error_states.mjs`
  - 新增阶段 5.2 自动化验收脚本，覆盖无效 Token、断网、异常数据三条链路

## 本次遇到的棘手问题

### 1. 无效 Token 场景下，主浮窗一度变成“空白”而不是错误提示

- 根因：`FloatingWindow` 早期把“存在 provider 状态对象”误当成“存在可显示维度”，导致错误数据虽然到了，但视图层仍走进 `CollapsedView`，后者又因为没有主维度而返回 `null`
- 解决方案：在 `src/renderer/components/FloatingWindow.tsx` 中把“provider 状态”和“可显示 provider”拆开，只让有维度的数据进入折叠/展开视图；纯错误态则走错误占位摘要
- 最终效果：无效 Token 时会稳定显示错误摘要，不再出现空白浮窗

### 2. Electron 浮窗里用 Playwright 等待文字 `visible` 不够稳定

- 根因：Electron 透明浮窗在 Playwright 的“可见性”判断上不如普通浏览器标签页稳定，容易把真实已渲染的内容误判为不可见
- 解决方案：5.2 脚本改为“DOM 结构 + 渲染态快照”双重断言，既检查浮窗上是否出现错误占位/错误徽标，也检查 renderer state 中的错误与保留数据是否符合预期
- 最终效果：验收脚本能稳定复现并验证三种错误场景，不再因工具层抖动误报失败

### 3. Electron 主进程调试桥切换 fixture 模式时，参数传递有兼容性坑

- 根因：`ElectronApplication.evaluate` 在本链路下没有稳定把第二个参数传入主进程执行上下文，导致 fixture 模式反复回落到默认 `success`
- 解决方案：在 `scripts/acceptance/stage5_2_error_states.mjs` 中改用显式分支调用主进程调试桥，避免依赖该参数传递方式
- 最终效果：脚本可以稳定在 `success / auth-error / offline / malformed` 四种模式之间切换

### 4. Windows 下删除临时 userData 目录时，字典文件释放有延迟

- 根因：Electron 进程退出后，`Dictionaries/*.bdic` 在 Windows 上偶发仍被短暂占用
- 解决方案：在 5.2 验收脚本里为临时目录清理增加延迟与重试
- 最终效果：验收通过后能稳定完成收尾，不再因为清理临时目录失败而误判整轮验收失败
