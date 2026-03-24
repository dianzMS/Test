# AI Chat App

一个简洁的 AI 聊天 Web 应用，支持流式输出，一键部署到 Vercel。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FdianzMS%2FTest&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20API%20Key&envLink=https%3A%2F%2Fplatform.openai.com%2Fapi-keys)

## 功能

- 🤖 支持 GPT-4o / GPT-4o mini / GPT-3.5 Turbo 模型切换
- ⚡ 流式响应，实时显示 AI 回复
- 💬 保持对话上下文
- 📱 响应式设计，支持移动端
- 🔒 API Key 安全存储在服务端环境变量中

## 一键部署

1. 点击上方 **"Deploy with Vercel"** 按钮
2. 登录 GitHub 授权 Vercel
3. 在环境变量中填入你的 `OPENAI_API_KEY`
4. 点击 Deploy，完成！

## 本地开发

```bash
# 安装依赖
npm install

# 安装 Vercel CLI
npm i -g vercel

# 创建 .env 文件
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 本地启动
vercel dev
```

## 项目结构

```
├── api/
│   └── chat.js          # Serverless API 代理 OpenAI
├── public/
│   ├── index.html       # 聊天界面
│   ├── style.css        # 样式
│   └── script.js        # 前端逻辑
├── vercel.json          # Vercel 路由配置
└── package.json
```
test
