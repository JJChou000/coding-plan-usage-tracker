# 用户操作手册 (User Tasks)

> 本文档列出所有需要你（人类用户）手动完成的工作。AI 无法代替你完成这些操作。

---

## 进度追踪

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 1 | 获取智谱 API Token | ⬜ 未完成 | |
| 2 | 调研阿里云百炼 API | ⬜ 未完成 | 需要抓包 |
| 3 | 准备应用图标 | ⬜ 未完成 | 可用 AI 生成 |
| 4 | 在 GitHub 创建仓库 | ⬜ 未完成 | |

---

## 任务 1：获取智谱 API Token

### 为什么需要？

应用需要使用你的智谱 API Token 来查询你的个人额度用量。

### 操作步骤

1. 打开浏览器，访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 登录你的账号
3. 进入 [API Key 管理页面](https://open.bigmodel.cn/usercenter/apikeys)
4. 复制你的 API Key（格式为 `sk-xxxx` 或 `id.secret`）
5. **妥善保存**，后续在应用设置中粘贴

> ⚠️ **安全提醒**：API Key 是你的个人密钥，不要分享给他人。应用会通过 electron-store 加密存储在本地。

---

## 任务 2：调研阿里云百炼 Coding Plan API

### 为什么需要？

阿里云百炼的 Coding Plan 用量页面目前没有已知的公开 API。我们需要你帮忙用浏览器抓包，找出页面加载数据时调用的后端接口。

### 操作步骤

1. 打开 Chrome/Edge 浏览器
2. 按 `F12` 打开开发者工具
3. 切换到 **Network（网络）** 标签页
4. ✅ **确保已勾选** "Preserve log"（保留日志）选项
5. 在筛选器中选择 **"All"**（全部），而非 "Fetch/XHR"
6. **此时刷新页面**（按 F5 或 Ctrl+R），访问 [百炼 Coding Plan 页面](https://bailian.console.aliyun.com/cn-beijing/#/efm/coding-plan-detail)
7. 等待页面完全加载，观察 Network 面板中出现的请求
8. **搜索关键词**：在 Filter 输入框中输入 `usage` 或 `quota` 或 `coding-plan`，查找可能包含用量数据的请求
9. 找到后点击该请求，查看：
   - **Request URL**（请求地址）
   - **Request Headers**（请求头，特别是 Cookie 或 Authorization）
   - **Response**（响应数据，确认包含用量百分比信息）
10. 将这些信息截图或复制给 AI

> 💡 **提示**：之前你截图时 Fetch/XHR 显示 0 个请求，可能是因为打开 DevTools 时页面已经加载完毕。**必须先打开 Network 标签页，然后再刷新页面**，才能捕获到请求。

### 备选方案

如果使用上述步骤仍然找不到 API 请求（数据可能是 SSR 服务端渲染嵌入 HTML 中），请执行以下操作：

1. 在 Network 标签页，找到第一个文档请求（Type 为 `document`）
2. 点击该请求，切换到 **Response** 标签页
3. 按 `Ctrl+F` 搜索关键词如 `5小时` 或 `用量` 或 `percent`
4. 截图搜索结果

---

## 任务 3：准备应用图标

### 需要准备的图标

| 图标 | 尺寸 | 用途 | 格式 |
|---|---|---|---|
| 应用图标 | 256×256 | 安装包图标 | PNG |
| 托盘图标 | 16×16 | 系统托盘 | PNG |
| 智谱图标 | 16×16 | 浮窗中厂商标识 | PNG |
| 阿里云图标 | 16×16 | 浮窗中厂商标识 | PNG |

### 操作建议

- 应用图标可使用 AI 图像生成工具（如 DALL-E、Midjourney）创建
- 厂商图标可以从各厂商官网下载 Logo 并缩放
- 所有图标保存到项目的 `resources/icons/` 目录

---

## 任务 4：在 GitHub 创建仓库

### 操作步骤

1. 登录 [GitHub](https://github.com)
2. 创建新仓库，名称为 `coding-plan-usage-tracker`（或你喜欢的名称）
3. 设为 Public（公开）
4. **不要**勾选 "Initialize this repository with a README"（项目已有本地 Git）
5. 创建后，将远程仓库与本地关联：
   ```bash
   git remote add origin https://github.com/<你的用户名>/coding-plan-usage-tracker.git
   ```

> 项目已初始化 `.git`，只需添加 remote 即可。
