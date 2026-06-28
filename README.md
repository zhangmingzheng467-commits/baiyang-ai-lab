# Baiyang Personal Site

白杨的个人网站与 AI 实验场。

## Files

- `index.html` - 页面结构
- `styles.css` - 页面样式
- `app.js` - 投稿、作品墙、审核台等交互逻辑

## Preview

直接打开 `index.html`，或部署到 GitHub Pages / Vercel / Cloudflare Pages。

## Cloud Submissions

当前网站支持两种模式：

1. `supabase-config.js` 为空：使用浏览器本地演示数据。
2. 填入 Supabase 配置：投稿、图片、审核改为云端模式。

Supabase 配置步骤：

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase-setup.sql`。
3. 执行前把 SQL 里的 `ADMIN_EMAIL` 替换为你的管理员邮箱。
4. 在 Supabase Authentication 里创建同邮箱的管理员用户。
5. 在 `supabase-config.js` 填入 `url` 和 `anonKey`。
6. 推送到 GitHub，GitHub Pages 会自动更新。
