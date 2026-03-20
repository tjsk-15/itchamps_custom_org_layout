# ITChamps Custom Org Layout — Project Context

> Reference for future Claude sessions. Last updated: 2026-03-20.

## What This App Does

Overrides HRMS Organizational Chart page with a **vertical indented tree**.
Filters: Department + Branch dropdowns. No search field.

## CRITICAL ARCHITECTURE — READ THIS FIRST

### How HRMS's Org Chart Page Works
HRMS registers `frappe.pages["organizational-chart"].on_page_load` in its own
page JS file (`hrms/hr/page/organizational_chart/organizational_chart.js`).
Inside `on_page_load`, it binds `$(wrapper).bind("show", ...)` which loads
`hierarchy-chart.bundle.js` and renders the default org chart.

### How Our Override Works
1. We use `page_js` in hooks.py — this injects our JS **after** HRMS's page JS loads.
2. We CANNOT just set `on_page_load` because it already fired.
3. Instead, we **override `on_page_load`** to intercept future loads AND **unbind
   HRMS's "show" event** to replace it with our own.
4. For the case where the page is already visible, we detect it and call setup
   immediately via setTimeout.

### Why NOT app_include_js
`app_include_js` loads our script BEFORE HRMS's page JS. HRMS's page JS then
overwrites our `on_page_load`. So `app_include_js` does NOT work.

### Why NOT app_include_js + page_js together
Double execution — toolbar fields get created twice and break.

### Styles Are INLINE in JS
Frappe Cloud wasn't serving the external CSS file. All styles injected via
`<style id="itc-styles">` in the JS. External CSS file is empty placeholder.

## hooks.py

```python
page_js = {"organizational-chart": "public/js/custom_org_chart.js"}
```
Nothing else. No app_include_js, no app_include_css.

## Directory Structure

```
itchamps_custom_org_layout/
├── pyproject.toml (setuptools, no setup.py/cfg)
├── MANIFEST.in / README.md / license.txt
├── itchamps_custom_org_layout/
│   ├── __init__.py / hooks.py / modules.txt
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py + org_chart.py
│   ├── public/js/custom_org_chart.js (JS + ALL STYLES)
│   ├── public/css/custom_org_chart.css (empty)
│   └── itchamps_custom_org_layout/__init__.py (must exist)
```

## API: `get_org_chart_data(company, department="", branch="")`

Returns `{ employees, departments, branches }`.
Filters server-side. Walks up reports_to chain when filtered to keep tree connected.

## JS Architecture

- IIFE with inline style injection
- Overrides `frappe.pages["organizational-chart"].on_page_load`
- In the new on_page_load: creates page, unbinds HRMS show event, binds our `itc_setup`
- `itc_setup()`: clears HRMS content, adds Company/Department/Branch fields, calls `doLoad()`
- `doLoad()` → API → `doRender()` builds tree from flat list
- Recursive `nodeH()` → `.itc-card` + `.itc-children`
- Collapse: `.itc-tog` toggles `.itc-hidden`
