# ---------------------------------------------------------
# 阶段 1: 构建阶段 (Builder)
# ---------------------------------------------------------
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# 复制依赖定义并安装全量依赖 (含 devDependencies 用于打包)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 复制源代码并执行构建
COPY . .
RUN npm run build:all

# ---------------------------------------------------------
# 阶段 2: 运行阶段 (Runner)
# ---------------------------------------------------------
FROM node:20-bullseye-slim

# 安装 Chromium 及其必须的系统库 (为了 Puppeteer)
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 设置环境变量
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

WORKDIR /app

# 仅复制生产环境必需的依赖定义
COPY package*.json ./

# 只安装生产依赖 (omit=dev)，减小镜像体积和内存占用
RUN npm install --omit=dev --legacy-peer-deps --no-package-lock

# 从 Builder 阶段复制打包好的产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# 容器对外暴露端口
EXPOSE 10000

# 启动 Node.js
# 注入 --max-old-space-size=384 强制在触碰 Render 512MB 物理极限前积极回收内存
CMD ["node", "--max-old-space-size=384", "dist-server/index.mjs"]
