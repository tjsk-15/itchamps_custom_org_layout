# ITChamps Custom Org Layout — Project Context

> **Purpose:** Reference doc so future Claude sessions don't need to re-explore the codebase.
> **Last updated:** 2026-03-20

---

## What This App Does

A Frappe/ERPNext app that overrides the default HRMS Organizational Chart page.
Layout is **Manager-grouped**: each manager is a collapsible section header with their
direct reports shown as a card grid below. Department and Branch are shown as colored
tags on every card. Toolbar has Department and Branch filter dropdowns.

## Tech Stack

- Frappe v16 + ERPNext v16 + HRMS v16
- Deployed on Frappe Cloud (itchamps.m.frappe.cloud)
- Python >=3.10, build via setuptools in pyproject.toml

## Directory Structure

```
itchamps_custom_org_layout/               ← Git repo root
├── pyproject.toml                        ← Build config (setuptools, NOT flit)
├── MANIFEST.in
├── README.md / license.txt / requirements.txt
├── itchamps_custom_org_layout/           ← Python package
│   ├── __init__.py                       ← __version__ = "1.0.0"
│   ├── hooks.py                          ← Frappe hooks
│   ├── modules.txt                       ← "ITChamps Custom Org Layout"
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py
│   ├── api/org_chart.py                  ← Server API
│   ├── public/js/custom_org_chart.js     ← Client JS
│   ├── public/css/custom_org_chart.css   ← Styles
│   └── itchamps_custom_org_layout/__init__.py  ← Frappe module dir (must exist)
```

## API

### `get_org_chart_data(company, department="", branch="")`
- Fetches all active employees for company
- Applies optional department/branch filters
- Groups employees by their `reports_to` manager
- Returns:
```json
{
  "groups": [
    {
      "type": "manager",
      "manager": {"id":"HR-EMP-001","name":"John","designation":"VP","department":"Sales","branch":"HQ","image":""},
      "reports": [{"id":"HR-EMP-002","name":"Jane",...}, ...]
    },
    {
      "type": "unmanaged",
      "manager": null,
      "reports": [...]
    }
  ],
  "stats": {"Showing":50,"Total Employees":84,"Departments":12,"Branches":2,"Managers":1},
  "filters": {
    "departments": ["Accountant","Engineering",...],
    "branches": ["Head Office","Bangalore Office"]
  }
}
```

## JS Architecture (custom_org_chart.js)
- Overrides `frappe.pages["organizational-chart"]`
- Toolbar: Company (Link), Department (Select), Branch (Select)
- Filter options populated from API `filters` field
- `paint()` → iterates groups → `html_manager_group()` or `html_unmanaged_group()`
- Each employee = `html_emp_card()` with department tag + branch tag
- Manager groups collapsible via `.itc-closed` class
- `search()` = real-time text filter on cards and groups

## CSS Architecture (custom_org_chart.css)
- `.itc-mgr-group` — bordered container per manager
- `.itc-mgr-header` — clickable manager row with dept-colored left border
- `.itc-report-grid` — CSS grid of employee cards (auto-fill, min 260px)
- `.itc-card` — employee card with dept-colored left border
- `.itc-tag-dept` — colored department pill, `.itc-tag-branch` — gray branch pill
- Dark mode via `[data-theme="dark"]`

## hooks.py
- `app_include_js/css` — loads JS and CSS globally
- `page_js["organizational-chart"]` — overrides HRMS org chart page
- `required_apps` — frappe, erpnext, hrms

## Build Notes
- pyproject.toml uses `setuptools` (not flit). No setup.py or setup.cfg.
- Inner `itchamps_custom_org_layout/itchamps_custom_org_layout/__init__.py` must exist (Frappe module system).

## Deploy
```bash
git add -A && git commit -m "msg" && git push
# Frappe Cloud: trigger rebuild from dashboard
# Local: bench build && bench restart
```
