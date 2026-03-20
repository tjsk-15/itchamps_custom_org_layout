# ITChamps Custom Org Layout — Project Context

> Reference for future Claude sessions. Last updated: 2026-03-20.

## What This App Does

Overrides HRMS Organizational Chart page with a **vertical indented tree**.
Each employee = a card row. Reportees are indented below their manager with
a left-border connector line. Cards show avatar, name, designation, department
tag (colored), branch tag (gray). Managers have a collapse/expand ± button.

**Filters:** Department + Branch dropdowns in toolbar. No search field.

## CRITICAL NOTES

1. **Styles are INLINE in JS** — injected via `<style id="itc-styles">`.
   External CSS file is empty. Frappe Cloud wasn't loading it.
2. **hooks.py uses `page_js` ONLY** — NOT `app_include_js`. Using both
   caused double-execution and the second run wiped out toolbar fields.
3. **Vertical layout, not horizontal tree** — With 84 employees and only 1
   manager, a horizontal tree overflows. Vertical indented list fits all.

## Directory Structure

```
itchamps_custom_org_layout/
├── pyproject.toml                        ← setuptools
├── MANIFEST.in / README.md / license.txt
├── itchamps_custom_org_layout/
│   ├── __init__.py / hooks.py / modules.txt
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py + org_chart.py
│   ├── public/js/custom_org_chart.js     ← JS + ALL STYLES
│   ├── public/css/custom_org_chart.css   ← Empty placeholder
│   └── itchamps_custom_org_layout/__init__.py
```

## hooks.py (IMPORTANT)

```python
page_js = {"organizational-chart": "public/js/custom_org_chart.js"}
page_css = {"organizational-chart": "public/css/custom_org_chart.css"}
```
NO `app_include_js` or `app_include_css` — these caused double-loading.

## API: `get_org_chart_data(company, department="", branch="")`

Returns `{ employees: [...], departments: [...], branches: [...] }`.
Each employee: `{id, name, designation, department, branch, reports_to, image}`.
When filtered, walks up reports_to chain to keep tree connected.

## JS Architecture

- IIFE, injects `<style>` on first run
- `frappe.pages["organizational-chart"].on_page_load` → builds page + toolbar
- Toolbar: Company (Link), Department (Select), Branch (Select)
- `doLoad()` → API call → `doRender()` builds tree from flat list
- Tree: recursive `nodeH()` → `.itc-card` + `.itc-children` (indented div)
- Collapse: `.itc-tog` button toggles `.itc-hidden` on `.itc-children`
- Click card → `frappe.set_route("app","employee", id)`

## CSS Classes (in JS)

- `.itc-card` — flex row card with left color bar
- `.itc-children` — indented container with left border line
- `.itc-av` — avatar circle, `.itc-name/.itc-desg` — text
- `.itc-td` — department tag, `.itc-tb` — branch tag
- `.itc-tog` — collapse/expand button
- `.itc-hidden` — hides children
