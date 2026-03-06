# 使用官方的 Node 轻量级镜像
FROM node:18-bullseye-slim

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
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 设定工作目录
WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装项目依赖 (跳过 lockfile 严格检查，直接根据 package.json 安装最新兼容易用版本)
RUN npm install --no-package-lock --legacy-peer-deps

# 复制全部项目文件
COPY . .

# 执行全栈构建 (打包 Vite 前端以及检查服务端逻辑)
RUN npm run build

# 容器对外暴露端口 (Render.com 默认会将环境 $PORT 转发至容器)
EXPOSE 3000

# 启动 Node.js Express 后端服务器
CMD ["npm", "run", "start"]
