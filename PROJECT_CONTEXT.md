# ITChamps Custom Org Layout — Project Context

> **Purpose:** Reference doc so future Claude sessions don't need to re-explore the codebase.
> **Last updated:** 2026-03-20

---

## What This App Does

A Frappe/ERPNext app that overrides the default HRMS Organizational Chart page with:
- Group-by dropdown (Department / Branch / Hierarchy)
- Color-coded nodes per group
- Compact collapsible tree view
- Modern dashboard with stats bar, search, and color legend
- Dark mode support

## Tech Stack & Dependencies

- **Framework:** Frappe v16 + ERPNext v16 + HRMS v16
- **Deployment:** Frappe Cloud (itchamps.m.frappe.cloud)
- **Python:** 3.14 on server, >=3.10 required
- **Build system:** setuptools via pyproject.toml (NO setup.py / setup.cfg)

## Directory Structure

```
itchamps_custom_org_layout/          ← Git repo root
├── pyproject.toml                   ← Single build config (setuptools)
├── MANIFEST.in                      ← Packaging manifest
├── README.md
├── license.txt
├── requirements.txt                 ← Empty (no extra deps)
├── itchamps_custom_org_layout/      ← Python package (app root)
│   ├── __init__.py                  ← Has __version__ = "1.0.0"
│   ├── hooks.py                     ← Frappe hooks config
│   ├── modules.txt                  ← Contains "ITChamps Custom Org Layout"
│   ├── patches.txt                  ← Empty
│   ├── patches/
│   │   └── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── org_chart.py             ← Server API (get_org_chart_data, get_chart_filters)
│   ├── public/
│   │   ├── js/custom_org_chart.js   ← Client-side org chart (380 lines)
│   │   └── css/custom_org_chart.css ← Styles (364 lines)
│   └── itchamps_custom_org_layout/  ← Frappe "module" directory (CRITICAL)
│       └── __init__.py              ← Must exist and be non-empty
```

## Key Architecture Notes

### Frappe Module System
- `modules.txt` lists `ITChamps Custom Org Layout`
- Frappe converts this to folder name: `itchamps_custom_org_layout`
- So Frappe imports `itchamps_custom_org_layout.itchamps_custom_org_layout` (app.module)
- The inner `itchamps_custom_org_layout/itchamps_custom_org_layout/` dir MUST exist with a valid `__init__.py`

### hooks.py Key Config
- `app_include_js`: `/assets/itchamps_custom_org_layout/js/custom_org_chart.js`
- `app_include_css`: `/assets/itchamps_custom_org_layout/css/custom_org_chart.css`
- `page_js`: overrides `organizational-chart` page
- `required_apps`: frappe, erpnext, hrms

### API Endpoints
- `itchamps_custom_org_layout.api.org_chart.get_org_chart_data(company, group_by)`
  - Returns `{employees: [...], stats: {...}}`
- `itchamps_custom_org_layout.api.org_chart.get_chart_filters(company)`
  - Returns `{departments: [...], branches: [...]}`

## Bugs Fixed (2026-03-20)

### 1. `No module named 'itchamps_custom_org_layout.itchamps_custom_org_layout'`
**Root cause:** Two issues:
1. `pyproject.toml` used `flit_core` build backend which didn't include sub-packages
2. `setup.py` and `setup.cfg` conflicted with `pyproject.toml` — setuptools picked up `readme` and `license` from `setup.cfg` but `pyproject.toml` didn't declare them as `dynamic`, causing `AttributeError: 'NoneType' object has no attribute 'get'`

**Fix:**
- Switched `pyproject.toml` to `setuptools` backend with explicit package discovery
- Added `readme = "README.md"` and `license = "MIT"` directly in `pyproject.toml`
- Deleted `setup.py` and `setup.cfg` (redundant, caused conflicts)
- Ensured inner `__init__.py` is non-empty

## How to Deploy

```bash
# Push changes to GitHub
git add -A && git commit -m "Fix build config" && git push

# On Frappe Cloud: trigger a rebuild/deploy from the dashboard
# Or locally:
bench get-app <repo-url>
bench --site <site> install-app itchamps_custom_org_layout
bench build
bench restart
```
