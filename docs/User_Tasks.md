# 用户操作手册 (User Tasks)

> 本文档列出所有需要你（人类用户）手动完成的工作。AI 无法代替你完成这些操作。

---

## 进度追踪

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 1 | 获取智谱 API Token | ✅ 已完成 | |
| 2 | 调研阿里云百炼 API | 🔄 进行中 | 见下方最新操作步骤 |
| 3 | 准备应用图标 | ✅ 已完成 | 已选用编号7（火箭），保存至 `resources/icons/app-icon.png` |
| 4 | 在 GitHub 创建仓库 | ✅ 已完成 | [JJChou000/coding-plan-usage-tracker](https://github.com/JJChou000/coding-plan-usage-tracker) |

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

### 当前分析结论

> 🔍 **已排除 SSR**：页面 HTML 中无用量数据。说明这是纯客户端 SPA，数据在页面 JS 加载完毕后由后台 API 异步填充。之前看不到 Fetch/XHR 请求是因为 DevTools 打开太晚。

### 最新操作步骤（必须按顺序）

1. 打开 [百炼 Coding Plan 页面](https://bailian.console.aliyun.com/cn-beijing/#/efm/coding-plan-detail)
2. 等页面**完全加载**显示出用量数据（6%、25%、18%）
3. **此时再**按 `F12` 打开 DevTools → Network 标签页
4. 筛选器选 **Fetch/XHR**
5. **点击页面右上角的「刷新」按钮**（即页面中「最后统计时间」旁边的刷新图标 🔄），不要按 F5
6. 观察 Network 中新出现的请求
7. 找到包含用量数据的请求，点击查看 URL、请求头和响应，截图给 AI

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
