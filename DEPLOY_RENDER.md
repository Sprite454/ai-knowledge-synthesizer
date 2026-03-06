# ☁️ 怎样免费部署 AI 知识合成器至 Render.com

因为我们的后端携带了用于突破反爬机制的 `Puppeteer`（无头 Chrome 浏览器），常规的静态网页托管平台（如 Vercel, Netlify）**无法运行** 本项目。

我们为您准备了专门用于 **[Render.com](https://render.com/)** 的全自动化 Docker 部署方案，且**完全免费**。

---

## 🚀 仅需 3 步完成部署

### 第一步：创建 Web Service
1. 注册并登录 [Render.com](https://dashboard.render.com/)。
2. 点击右上角的 **"New +"** 按钮，选择 **"Web Service"**。
3. 选择 **"Build and deploy from a Git repository"**，然后关联网页授权并授权选择您刚刚推送的本开源仓库 (`your-name/ai-knowledge-synthesizer`)。

### 第二步：配置环境与底层 (极简配置)
在跳转的项目设置页面，做几下勾选即可：
1. **Name**: 随便起一个您喜欢的名字，比如 `ai-synth-bot`。
2. **Environment**: 在下拉框里找到并强烈务必选择第一项 `Docker`。（Render 会自动侦探到本目录下的 Dockerfile，它会帮咱们装好纯净版 Linux Chrome）。
3. **Region**: 选择靠近您或者代理节点的地区即可（例如 Singapore, Oregon）。
4. **Instance Type**: 保持选择紫色的 `Free` （免费）即可！

### 第三步：灌入环境变量 (Environment Variables)
这是重中之重，必须要将连接数据库和 AI 的密钥贴进服务器！
1. 页面往下划，点击展开 **🔥 Advanced**。
2. 找到 **Environment Variables**，点击 `Add Environment Variable` 逐条配置：

> 💡 **小贴士**: 建议您点击旁边的 `Secret Files` 按钮，直接把本地记事本中包含全部内容的 `.env` 贴进去保存就不用一条一条写了。

**必备字段检查清单**：
| 变量名 (Key) | 变量值 (Value) |
|---|---|
| `GEMINI_API_KEY` | 您的谷歌 AI 密钥 |
| `KIMI_API_KEY` | 您的 Kimi 密钥 |
| `DEEPSEEK_API_KEY` | 您的 DeepSeek 密钥 |
| `VITE_SUPABASE_URL` | Supabase 的 Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 的 anon 公钥 |
| `SUPABASE_SERVICE_KEY` | Supabase 的 service_role 免权密钥 |

*（Docker 会自动设置好正确的系统级 PORT 和 PUPPETEER_EXECUTABLE_PATH，不需要您手工配置）*

### 🎉 完成！点击 Create Web Service！
点击屏幕下方硕大的 `Create Web Service` 绿色按钮。
1. 系统现在会开始拉取包含浏览器的 Linux 全栈系统环境，首次由于装配无头浏览器可能需要 **2-4 分钟**，请耐心等待。
2. 当进度条滚完并显示一行绿色的 `==> Your service is live 🎉` 时，说明一切搞定！
3. 您可以随时点击页面左上角的外部链接前往属于您的云端合成器了。

---

> ⚠️ 注意事项: 
> Render 的免费容器如果 15 分钟内没有外部访问，它会自动进入休眠以节省资源。一旦有人再次访问唤醒它，大约需要等待几十秒完成冷启动。这在个人测试使用时完全不影响体验，一旦开机就能急速抓网页！
