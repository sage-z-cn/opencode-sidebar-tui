# 同步上游代码指南

## 仓库结构

| 分支 | 用途 |
|------|------|
| `main` | 你自己的开发分支（基于原作者的 `main` 改造） |
| `origin-main` | 镜像原作者的 `main` 分支，用于同步 |

**原仓库**: `https://github.com/islee23520/open-sidebar-terminal.git`

## 首次配置

如果还没 clone 这个仓库，先 clone 并添加上游远程：

```bash
git clone https://github.com/sage-z-cn/ai-sidebar-terminal.git
cd opencode-sidebar-tui
git remote add upstream https://github.com/islee23520/open-sidebar-terminal.git
```

如果已有本地仓库，确认远程配置：

```bash
git remote -v
# origin    https://github.com/sage-z-cn/ai-sidebar-terminal.git (fetch)
# origin    https://github.com/sage-z-cn/ai-sidebar-terminal.git (push)
# upstream  https://github.com/islee23520/open-sidebar-terminal.git (fetch)
# upstream  https://github.com/islee23520/open-sidebar-terminal.git (push)
```

## 同步流程

当原作者推送了新提交，执行以下步骤：

```bash
# 拉取上游最新代码
git fetch upstream main

# 切换到 origin-main 分支
git checkout origin-main

# 合并上游改动
git merge upstream/main

# 推送到远程 origin-main
git push origin origin-main

# 切回 main，将上游改动合并进来
git checkout main
git merge origin-main
```

### 简化版（无冲突时）

```bash
git fetch upstream main
git checkout origin-main && git merge upstream/main && git push origin origin-main
git checkout main && git merge origin-main && git push origin main
```

## 处理合并冲突

如果 `main` 与 `origin-main` 之间有冲突：

```bash
git checkout main
git merge origin-main
# 手动解决冲突
git add .
git commit -m "merge: 同步上游 origin/main 至 main"
git push origin main
```

## 快捷脚本

可将以下内容保存为 `sync-upstream.sh`（或 Windows 用 `sync-upstream.ps1`）：

```bash
#!/bin/bash
set -e
echo ">>> 拉取上游..."
git fetch upstream main
echo ">>> 更新 origin-main..."
git checkout origin-main
git merge upstream/main
git push origin origin-main
echo ">>> 合并到 main..."
git checkout main
git merge origin-main
echo ">>> 完成！"
```

## 注意事项

- `origin-main` 分支应保持与原作者的 `main` 一致，不要在 `origin-main` 上直接开发
- 同步后建议跑一遍测试确保兼容：`npm install && npm run compile`
- GitHub 的 Sync fork 按钮对本仓库**无效**（因为默认分支不再是上游的镜像），请使用本文档的手动同步方式
