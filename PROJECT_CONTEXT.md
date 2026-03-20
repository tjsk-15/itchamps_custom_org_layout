# ITChamps Custom Org Layout — Project Context

> **Purpose:** Reference doc so future Claude sessions don't need to re-explore the codebase.
> **Last updated:** 2026-03-20

---

## What This App Does

A Frappe/ERPNext app that overrides the default HRMS Organizational Chart page with a
**Department → Manager → Employees** hierarchy, including:

- **Hierarchy:** Departments as collapsible top-level sections, managers under each department with their direct reports nested below
- **Filters:** Branch, Department, and Manager dropdown filters in the toolbar
- **Color-coded departments:** Each department gets a unique color
- **Search:** Real-time text search across employees, managers, departments
- **Stats bar:** Total Employees, Departments, Branches, Managers
- **Dark mode support**

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
│   │   └── org_chart.py             ← Server API
│   ├── public/
│   │   ├── js/custom_org_chart.js   ← Client-side org chart
│   │   └── css/custom_org_chart.css ← Styles
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

### API Endpoint
- `itchamps_custom_org_layout.api.org_chart.get_org_chart_data(company, branch, department, manager)`
  - Args: company (required), branch/department/manager (optional filters)
  - Returns:
    ```json
    {
      "departments": [
        {
          "name": "Engineering",
          "employee_count": 12,
          "managers": [
            {
              "manager": { "name": "HR-EMP-001", "employee_name": "...", ... },
              "reports": [ { "name": "HR-EMP-002", ... }, ... ]
            }
          ],
          "unmanaged": [ { "name": "HR-EMP-010", ... } ]
        }
      ],
      "stats": { "Total Employees": 50, "Departments": 5, "Branches": 3, "Managers": 8 },
      "filters": {
        "departments": ["Engineering", "Sales"],
        "branches": ["Main", "Remote"],
        "managers": [{"id": "HR-EMP-001", "name": "John Doe"}]
      }
    }
    ```

### JS Architecture (custom_org_chart.js)
- Overrides `frappe.pages["organizational-chart"].on_page_load`
- Toolbar: Company (Link), Branch (Select), Department (Select), Manager (Select)
- Filter dropdowns are populated from API response `filters` object
- Rendering: `render()` → iterates departments → `render_manager_card()` + `render_employee_card()`
- Collapsible: Department headers and manager sections are independently collapsible
- Search: `filter_nodes()` does real-time DOM-based text search

### CSS Structure (custom_org_chart.css)
- `.itc-dept-*` — department-level styles
- `.itc-manager-*` — manager card and toggle styles
- `.itc-employee-*` — employee card styles
- `.itc-reports-list` — direct reports container (indented, with left-border line)
- Dark mode via `[data-theme="dark"]` selectors

## Bugs Fixed (2026-03-20)

### 1. `No module named 'itchamps_custom_org_layout.itchamps_custom_org_layout'`
**Root cause:** `pyproject.toml` used `flit_core` + conflicting `setup.py`/`setup.cfg`
**Fix:** Switched to `setuptools`, removed `setup.py`/`setup.cfg`, added `readme`/`license` to `pyproject.toml`

### 2. `AttributeError: 'NoneType' object has no attribute 'get'` during build
**Root cause:** `setup.cfg` had `long_description = file: README.md` but `pyproject.toml` didn't declare `readme` as dynamic
**Fix:** Added `readme = "README.md"` and `license = "MIT"` directly in `pyproject.toml`, deleted `setup.cfg`

## Feature Changes (2026-03-20)

### Reformat: Department → Manager → Employees hierarchy
- **Old:** Flat hierarchy (reports_to tree) or flat grouped view (Department/Branch grid)
- **New:** 3-level hierarchy: Department sections → Manager cards → Employee cards
- **Filters:** Added Branch, Department, Manager dropdown filters (replace old Group By dropdown)
- **Server-side:** API now returns pre-structured department→manager→reports data
- **Unmanaged:** Employees without a manager shown in "No Manager Assigned" sub-section

## How to Deploy

```bash
# Push changes to GitHub
git add -A && git commit -m "Reformat org chart" && git push

# On Frappe Cloud: trigger a rebuild/deploy from the dashboard
# Or locally:
bench get-app <repo-url>
bench --site <site> install-app itchamps_custom_org_layout
bench build
bench restart
```
