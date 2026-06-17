---
title: NewAPI
emoji: 🔑
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# NewAPI

AI 模型 API 聚合网关 - 带数据导入导出功能

## 功能特点

- 支持多种 AI 模型 API 聚合
- **数据导入导出**（仅 root 用户可用）
- 渠道管理
- 令牌管理
- 用户管理

## 数据导入导出使用说明

### 导出数据

1. 以 root 用户登录
2. 访问 `/api/data-export/export`
3. 自动下载 JSON 备份文件

### 导入数据

1. 以 root 用户登录
2. 发送 POST 请求到 `/api/data-export/import`
3. 上传之前导出的 JSON 文件

## 部署说明

首次访问会自动跳转到初始化页面，设置管理员账号密码。

## 数据持久化（重要）

Hugging Face Spaces 免费版没有持久化存储，重启后数据会丢失。

**解决方案**：配置外部数据库

在 Space 的 **Settings → Variables and Secrets** 中添加：

```
SQL_DSN=你的数据库连接字符串
```

推荐免费数据库：
- [Neon](https://neon.tech) - Serverless PostgreSQL，无需信用卡
- [Supabase](https://supabase.com) - 免费 PostgreSQL，500MB 存储

## 保持活跃

Hugging Face Spaces 免费版 48 小时无访问会休眠。

建议用 [UptimeRobot](https://uptimerobot.com) 每 10 分钟 ping 一次你的域名，保持服务在线。
