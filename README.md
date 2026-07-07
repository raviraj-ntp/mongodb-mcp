# MongoDB MCP

Feature-rich MCP server for **MongoDB** with **multi-connection** support. Connect many clusters at once — no switching, no duplicate MCP processes.

- **npm:** `@raviraj87/mongodb-mcp`
- **GitHub:** https://github.com/raviraj-ntp/mongodb-mcp
- Runs locally via stdio (any MCP-compatible client)

---

## Quick start

Add to your **MCP client configuration** (path depends on client — e.g. Claude Desktop, VS Code, Windsurf):

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@raviraj87/mongodb-mcp"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017/mydb"
      }
    }
  }
}
```

**Option B — multiple connections** (copy `config.example.yaml` → `~/.mongodb-mcp.yaml`):

```yaml
default_connection: local
connections:
  local:
    uri_env: MONGODB_URI
  staging:
    uri_env: MONGODB_URI_STAGING
  prod:
    uri_env: MONGODB_URI_PROD
    read_only: true
```

Set URIs in `mcp.json` env. Every tool accepts optional `connection: "staging"`.

**Extra connections via env** (no YAML):

```bash
MONGODB_EXTRA_CONNECTIONS=staging:MONGODB_URI_STAGING,prod:MONGODB_URI_PROD
```

---

## vs official `mongodb-mcp-server`

| Feature | Official | This server |
|---------|----------|-------------|
| Multiple clusters simultaneously | Switch or N processes | Named `connection` param |
| Composite tools | No | `explore_collection`, `database_overview`, `compare_collections` |
| Diagnostics | `mongodb-logs` | + `server_status`, `current_ops`, `repl_set_status` |
| Knowledge search | Yes | Yes (`search_knowledge`, optional) |
| Atlas API | Full | Core read ops (optional) |
| Per-connection `read_only` | No | Yes |

---

## Tools (~45)

**Connection:** `list_connections`, `ping`, `connect`

**Read:** `find`, `find_one`, `aggregate`, `aggregate_db`, `count`, `explain`, `distinct`, `sample_documents`, `text_search`, `export_query`

**Metadata:** `list_databases`, `list_collections`, `collection_schema`, `collection_indexes`, `collection_storage_size`, `collection_stats`, `db_stats`, `validate_collection`

**Write:** `insert_many`, `update_many`, `delete_many`, `bulk_write`, `find_one_and_*`

**Admin:** `create_collection`, `drop_collection`, `rename_collection`, `create_index`, `drop_index`, `drop_database`, `coll_mod`

**Diagnostics:** `server_status`, `current_ops`, `repl_set_status`, `mongodb_logs`, `list_commands`

**Composite:** `explore_collection`, `database_overview`, `analyze_query`, `compare_collections`, `index_health`

**Assistant:** `list_knowledge_sources`, `search_knowledge` (disable with `assistant.enabled: false`)

**Atlas:** `atlas_list_*`, `atlas_inspect_cluster`, `atlas_performance_advisor` (set `atlas.enabled: true`)

---

## Safety

- Global or per-connection `read_only`
- `index_check` — reject collection scans
- `disable_server_side_js` — block `$where`, `$function`
- `confirmation_required_tools` — destructive ops need `confirmed: true`
- `max_documents_per_query`, `max_payload_bytes`
- `connection_filter` — expose only specific connections per project

---

## Install from source

```bash
cd mongodb-mcp
npm install
npm run build
```

Clone from GitHub:

```bash
git clone https://github.com/raviraj-ntp/mongodb-mcp.git
```

```json
{
  "command": "node",
  "args": ["/path/to/mongodb-mcp/dist/index.js"]
}
```

## License

MIT

---

## Publishing (maintainers)

Repo: https://github.com/raviraj-ntp/mongodb-mcp · npm: `@raviraj87/mongodb-mcp`

```bash
git status
npm run build
git push origin main

npm whoami    # raviraj87
npm version patch    # required before republish
npm publish --access public
# 2FA: npm publish --access public --otp=XXXXXX
```

Verify tarball: `npm pack --dry-run`

| Error | Fix |
|-------|-----|
| `remote origin already exists` | `git remote set-url origin https://github.com/raviraj-ntp/mongodb-mcp.git` |
| `Permission denied (publickey)` | Use HTTPS remote, not `git@github.com:...` |
| `403 ... previously published versions` | `npm version patch` then publish |
| `429 Too many requests` | Wait 30–60 min, retry once |

New GitHub repo: `gh repo create raviraj-ntp/mongodb-mcp --public --source=. --remote=origin --push`
