# 使用支持最新 TailwindCSS v4 和 Vite 6 的 Node.js 20 镜像
FROM node:20-bullseye-slim

# 安装 Chromium 及其必须的系统库 (为了 Puppeteer)
# 并清理 apt 缓存以缩减 Docker 镜像体积
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 设置环境变量告诉 Puppeteer 不用自己下载 Chromium，并指向刚才安装的 Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
  NODE_ENV=production

# 设定工作目录
WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装项目依赖 (由于云端默认设 NODE_ENV=production 会忽略 dev 插件，必须强制传入 --include=dev 以供 Vite 打包)
RUN npm install --include=dev --no-package-lock --legacy-peer-deps

# 复制全部项目文件
COPY . .

# 执行全栈构建 (1. Vite 打包前端 → dist/  2. tsc 编译服务端 → dist-server/)
RUN npm run build:all

# 容器对外暴露端口 (Render.com 默认会将环境 $PORT 转发至容器)
EXPOSE 10000

# 使用原生 node 运行已编译的 JS 代码（比 tsx 省约 200MB 内存）
CMD ["node", "dist-server/index.mjs"]
