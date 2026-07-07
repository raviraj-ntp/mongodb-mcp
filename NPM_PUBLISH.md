# Publish to npm

Package: **`@raviraj87/mongodb-mcp`**

```bash
npm whoami    # must show: raviraj87
cd mongodb-mcp
npm run build
npm publish --access public
```

After publish: https://www.npmjs.com/package/@raviraj87/mongodb-mcp

## What gets published

Only files in `package.json` → `files`:

- `dist/`
- `config.example.yaml`
- `README.md`
- `LICENSE`

Not included: `src/`, `PUBLISHING.md`, `node_modules/`.

## Verify before publish

```bash
npm pack --dry-run
```
