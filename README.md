# metR Issues — frontend

React + Tailwind CSS (Vite) UI for the Issues module of `DocManager-Dashboard-Metrics`.

```
npm install
npm run dev        # http://localhost:5173, proxies /api -> http://127.0.0.1:8092
```

Set `VITE_API_TARGET` in `.env` to point the proxy at another backend.

## Pages

| Route | Purpose |
|---|---|
| `/` | Validation input: snapshot ID, workspace path, mode (validate / force re-run / re-check pending) |
| `/dashboard` | Totals per module: total, errors, warnings, info |
| `/issues/schema` | Pending issues grouped by file → element, with micro-XSLT and master-XSLT actions |
| `/issues/broken-links`, `/issues/missing-metadata` | Placeholders until their APIs exist |

## Connecting a module

Every module is listed in `src/modules.js`. To connect one:

1. Implement its calls in `src/api/<module>.js`. Commented-out `request(...)` calls show the expected endpoints.
   - `validate` must return the same totals as the schema validation (`total_findings`, `total_errors`, `total_warnings`, `total_info`).
   - `getGroups` must return the `IssueGroupsResponse` shape (`files[] → elements[] → issues[]`).
2. Set `enabled: true` in `src/modules.js`.

## Schema XSLT fixes

`applyMicroXslt` and `applyMasterXslt` in `src/api/schemaIssues.js` are stubs. Once the endpoints exist, replace the stubs with the calls and set `features.microXslt` / `features.masterXslt` to `true`. After a fix succeeds, the UI runs `rerun=true`, which marks fixed issues and reloads the groups.
