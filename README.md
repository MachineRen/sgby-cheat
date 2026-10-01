# 三国霸业 · 金手指

豆包应用「三国霸业」(https://4m2x6wry2s8z5.doubaoapps.com/app/app_17f1t3rbtp3/) 的辅助工具页。仅供个人学习研究，请勿用于破坏他人存档或对外传播修改后的存档。

## 在线使用

**https://machineren.github.io/sgby-cheat/**

手机 / 电脑浏览器直接打开即可，包含：

| 标签页 | 说明 |
|---|---|
| ① 注入面板 | 复制控制台脚本 / 书签代码（电脑端） |
| ② 在线改档 | 手机端主力：桥接书签 ↔ 编辑页 双向中转存档 |
| ③ 武将图鉴 | 59 名武将基础属性与技能 |
| ④ 装备图鉴 | 29 件装备属性与价格 |
| ⑤ 上限 & 主题 | 游戏内数值上限对照 + 主题换肤 |

## 注入面板（电脑端）

1. 打开游戏页面 → F12 打开控制台
2. 从「① 注入面板」复制脚本粘贴回车，右下角出现悬浮面板

面板功能：资源/兵力/军令、主公（类型/等级/改名）、建筑科技仓库、武将招募与等级、装备获取、攻击倍率、主题换肤（连游戏配色一起换）。

## 手机端（在线改档）

存档在游戏域的 localStorage 里，跨域页面读写不到，所以需要一次「桥接书签」中转：

1. 在游戏页面点「桥」书签 → 存档复制到剪贴板并跳到编辑页
2. 编辑页改数据 → 生成回写链接 → 复制
3. 回游戏页面打开链接 → 再点一次「桥」书签 → 写回并刷新

## 文件

- `index.html` —— 单文件工具页（面板脚本 / 书签代码 / 图鉴 / 编辑器全部内嵌）
- `sgby-cheat-panel.js` —— 注入面板源文件（可独立托管，也支持 `script` 标签远程加载）

## 更新方式

1. 改 `sgby-cheat.html` 与 `sgby-cheat-panel.js`（**注意**：`sgby-cheat.html` 内嵌两份面板源码 —— `#cheatSrc` 与 `#bookmarkSrc`，改一处必须同步另一处，且书签版不能有换行）
2. 拷贝到本目录：`cp sgby-cheat.html index.html && cp sgby-cheat-panel.js sgby-cheat-panel.js`
3. 提交推送，Pages 会自动重新发布

本机 `git push` 直连 github.com:443 常被网络环境阻断，兜底通道是 REST API：

```bash
cd /Users/ren/WorkBuddy/2026-09-30-13-54-41
GH_TOKEN=xxx node gh-push.js            # 默认推 index.html + sgby-cheat-panel.js
GH_MSG="提交信息" GH_TOKEN=xxx node gh-push.js index.html
```

脚本按 git blob sha1 比对远端，内容相同会自动跳过；token 只从环境变量读，不落盘。推送后 Pages 构建约需 1–3 分钟。
