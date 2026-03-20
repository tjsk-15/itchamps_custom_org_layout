# ITChamps Custom Org Layout — Project Context

> Reference doc for future Claude sessions. Last updated: 2026-03-20.

## What This App Does

Overrides the HRMS Organizational Chart page with a **top-down tree chart**.
Each employee = a card (170px wide). Manager → reportee lines drawn via CSS
pseudo-elements on nested `<ul>/<li>`. Cards show avatar, name, designation,
department tag (colored), branch tag (gray). Collapse/expand via ± button.

**Filters:** Department dropdown + Branch dropdown in toolbar. No search field.
When filtering, API walks up reports_to chain to keep tree connected.

## CRITICAL: Styles are INLINE in JS

All CSS is injected via `<style id="itc-org-styles">` in `custom_org_chart.js`.
The external `.css` file is intentionally empty — Frappe Cloud wasn't loading it.
If you need to change styles, edit the string array in the JS file.

## Directory Structure

```
itchamps_custom_org_layout/
├── pyproject.toml                        ← setuptools, no setup.py/cfg
├── MANIFEST.in / README.md / license.txt
├── itchamps_custom_org_layout/
│   ├── __init__.py
│   ├── hooks.py
│   ├── modules.txt                       ← "ITChamps Custom Org Layout"
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py
│   ├── api/org_chart.py                  ← Server API
│   ├── public/js/custom_org_chart.js     ← JS + ALL STYLES INLINE
│   ├── public/css/custom_org_chart.css   ← Empty (styles in JS)
│   └── itchamps_custom_org_layout/__init__.py
```

## API: `get_org_chart_data(company, department="", branch="")`

Returns:
```json
{
  "employees": [{"id","name","designation","department","branch","reports_to","image"}, ...],
  "departments": ["Dept1", "Dept2"],
  "branches": ["Branch1", "Branch2"]
}
```
Filters applied server-side. When filtered, ancestor managers added to keep tree connected.

## JS Architecture (custom_org_chart.js)

- IIFE wrapping everything
- Injects `<style id="itc-org-styles">` on first load
- Overrides `frappe.pages["organizational-chart"]`
- Toolbar: Company (Link), Department (Select), Branch (Select)
- `load()` → API call → `render()` builds tree from flat list
- Tree: nested `<ul class="itc-tree">/<li>/<div class="itc-card">`
- Connector lines: CSS `::before` (vertical) and `::after` (horizontal) on `<li>`
- Collapse: `li.collapsed > ul { display:none }`, toggle button `.itc-toggle`
- Click card → `frappe.set_route("app","employee", id)`

## CSS (all inside JS)

- `.itc-tree, .itc-tree ul` — flexbox horizontal layout
- `li::before` — vertical line up, `li::after` — horizontal rail
- `ul::before` — vertical line down from parent
- `.itc-card` — 170px card, `.itc-av` — avatar circle
- `.itc-tag-d` — dept tag (colored border), `.itc-tag-b` — branch tag (gray)
- Dark mode via `[data-theme=dark]`

## hooks.py

- `app_include_js/css` — standard paths
- `page_js["organizational-chart"]` — overrides HRMS page
- `required_apps` — frappe, erpnext, hrms

## Build

- pyproject.toml + setuptools. No setup.py/cfg/requirements.txt.
- Inner module dir must exist with non-empty `__init__.py`.
