# ITChamps Custom Org Layout — Project Context

> Reference doc for future Claude sessions. Last updated: 2026-03-20.

## What This App Does

Overrides the HRMS Organizational Chart page with a **top-down tree** where each
employee is a card. Manager → reportee relationships are shown with vertical and
horizontal CSS connector lines. Cards show avatar, name, designation, department tag
(colored), and branch tag. The tree is scrollable horizontally if wider than the viewport.

**Filters:** Department dropdown, Branch dropdown (no free-text search).
Selecting a filter shows only matching employees plus their manager chain up to the root.

## Tech Stack

- Frappe v16, ERPNext v16, HRMS v16
- Frappe Cloud: itchamps.m.frappe.cloud
- Python >=3.10, setuptools via pyproject.toml (no setup.py/setup.cfg)

## Directory Structure

```
itchamps_custom_org_layout/               ← repo root
├── pyproject.toml
├── MANIFEST.in / README.md / license.txt
├── itchamps_custom_org_layout/           ← Python package
│   ├── __init__.py                       ← __version__
│   ├── hooks.py
│   ├── modules.txt                       ← "ITChamps Custom Org Layout"
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py
│   ├── api/org_chart.py                  ← Server API
│   ├── public/js/custom_org_chart.js     ← Client JS
│   ├── public/css/custom_org_chart.css   ← Styles
│   └── itchamps_custom_org_layout/__init__.py  ← Frappe module dir (must exist)
```

## API: `get_org_chart_data(company, department="", branch="")`

Returns `{ employees: [...], filters: { departments: [...], branches: [...] } }`.
Each employee: `{ id, name, designation, department, branch, reports_to, reports_to_name, image }`.
When filters are active, the API walks up the reports_to chain to include ancestor managers
so the tree stays connected.

## JS Architecture (custom_org_chart.js)

- Namespace: `itchamps_org`
- Overrides `frappe.pages["organizational-chart"].on_page_load`
- Toolbar: Company (Link), Department (Select), Branch (Select) — no search field
- Builds tree from flat employee list using `reports_to` → parent-child map → roots
- Renders nested `<ul class="itc-level">` / `<li class="itc-node">` / `<div class="itc-card">`
- Collapse/expand via `.itc-expand-btn` toggling `.itc-collapsed` on `<li>`
- Click card → navigate to Employee doctype

## CSS Architecture (custom_org_chart.css)

- Tree uses nested `<ul>/<li>` flexbox layout (horizontal siblings, vertical parent-child)
- Connector lines are pure CSS `::before` and `::after` pseudo-elements on `<li>` and `<ul>`
- `.itc-card` — 180px wide card with colored top border, avatar, name, designation, tags
- `.itc-expand-btn` — circular toggle button at card bottom
- `.itc-collapsed > .itc-level` — hides children
- Horizontal scroll via `.itc-tree-scroll { overflow-x: auto }`
- Dark mode: `[data-theme="dark"]` overrides

## hooks.py

- `app_include_js`: `/assets/itchamps_custom_org_layout/js/custom_org_chart.js`
- `app_include_css`: `/assets/itchamps_custom_org_layout/css/custom_org_chart.css`
- `page_js["organizational-chart"]`: `public/js/custom_org_chart.js`
- `required_apps`: frappe, erpnext, hrms

## Build Notes

- pyproject.toml uses setuptools. No setup.py/setup.cfg (deleted — caused conflicts).
- Inner `itchamps_custom_org_layout/itchamps_custom_org_layout/__init__.py` must exist and be non-empty.
- No requirements.txt (deleted — pyproject.toml has `dependencies = []`).
