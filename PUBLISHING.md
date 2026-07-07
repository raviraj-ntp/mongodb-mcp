# Publishing this repository

## Before you push

```bash
git status
```

Do not commit: `node_modules/`, `dist/`, `.env`, connection strings.

## 1. Fix remote (if you see SSH / permission denied)

Your `gh` CLI uses **HTTPS**, not SSH. Set the remote once:

```bash
git remote set-url origin https://github.com/raviraj-ntp/mongodb-mcp.git
```

If `origin` does not exist yet:

```bash
git remote add origin https://github.com/raviraj-ntp/mongodb-mcp.git
```

Do **not** run `git remote add` if `origin` already exists — use `set-url` instead.

## 2. Create repo + push (GitHub CLI — recommended)

Logged in as `raviraj-ntp`:

```bash
gh auth login   # one-time, pick raviraj-ntp account
gh repo create raviraj-ntp/mongodb-mcp --public --source=. --remote=origin --push
```

If the repo already exists on GitHub but is empty:

```bash
git push -u origin main
```

## 3. Without GitHub CLI

1. Create an empty repo at https://github.com/new — owner `raviraj-ntp`, name `mongodb-mcp`, **no** README.
2. Then:

```bash
git remote set-url origin https://github.com/raviraj-ntp/mongodb-mcp.git
git push -u origin main
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `remote origin already exists` | Use `git remote set-url origin ...`, not `git remote add` |
| `Permission denied (publickey)` | Remote is SSH; switch to HTTPS URL above |
| `Could not resolve to a Repository` | Repo not created yet — run `gh repo create` or create on github.com/new |
| Wrong GitHub account | `gh auth switch` → select `raviraj-ntp` |

## npm

See [NPM_PUBLISH.md](./NPM_PUBLISH.md).

```bash
npm whoami          # raviraj87
npm run build
npm publish --access public
```
