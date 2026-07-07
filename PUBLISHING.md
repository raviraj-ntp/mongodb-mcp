# Publishing this repository

## Before you push

```bash
git status
```

Do not commit: `node_modules/`, `dist/`, `.env`, connection strings.

## GitHub CLI

```bash
gh auth login
git init
git add .
git commit -m "Initial commit: MongoDB MCP server with multi-connection support"
gh repo create raviraj-ntp/mongodb-mcp --public --source=. --remote=origin --push
```

## Without GitHub CLI

```bash
git init
git add .
git commit -m "Initial commit: MongoDB MCP server with multi-connection support"
git branch -M main
git remote add origin git@github.com:raviraj-ntp/mongodb-mcp.git
git push -u origin main
```

## npm

```bash
npm login
npm publish --access public
```
