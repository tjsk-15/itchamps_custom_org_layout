# ITChamps Custom Org Layout — Project Context

> Reference for future Claude sessions. Last updated: 2026-03-20.

## What This App Does

Overrides HRMS Organizational Chart page with a **vertical indented tree**.
Each employee = a card row. Reportees indented below manager with left-border
connector line. Cards show avatar, name, designation, department tag (colored),
branch tag (gray). Managers have collapse/expand ± button.

**Filters:** Department + Branch dropdowns in toolbar. No search field.

## CRITICAL ARCHITECTURE NOTES

1. **Styles are INLINE in JS** — injected via `<style id="itc-styles">`.
   External CSS file is empty. Frappe Cloud wasn't serving it.

2. **hooks.py uses `app_include_js` ONLY** — NOT `page_js`.
   - `app_include_js` loads the script globally, so `on_page_load` is
     registered BEFORE the page loads. Since our app loads after HRMS,
     our handler overrides HRMS's.
   - `page_js` runs AFTER the page has already loaded and `on_page_load`
     has already fired, so our handler never executes.
   - Do NOT use both — causes double execution and toolbar fields vanish.

3. **Vertical layout, not horizontal tree** — 84 employees with only 1
   manager means ~83 root nodes. Horizontal tree overflows. Vertical
   indented list fits all employees without scrolling.

## Directory Structure

```
itchamps_custom_org_layout/
├── pyproject.toml                        ← setuptools, no setup.py/cfg
├── MANIFEST.in / README.md / license.txt
├── itchamps_custom_org_layout/
│   ├── __init__.py / hooks.py / modules.txt
│   ├── patches.txt / patches/__init__.py
│   ├── api/__init__.py + org_chart.py
│   ├── public/js/custom_org_chart.js     ← JS + ALL STYLES
│   ├── public/css/custom_org_chart.css   ← Empty placeholder
│   └── itchamps_custom_org_layout/__init__.py
```

## hooks.py

```python
app_include_js = ["/assets/itchamps_custom_org_layout/js/custom_org_chart.js"]
```
NO `page_js`, NO `app_include_css` (styles are in JS).

## API: `get_org_chart_data(company, department="", branch="")`

Returns `{ employees: [...], departments: [...], branches: [...] }`.
Each employee: `{id, name, designation, department, branch, reports_to, image}`.
When filtered, walks up reports_to chain to keep tree connected.

## JS Architecture

- IIFE, injects `<style id="itc-styles">` on first run
- Sets `frappe.pages["organizational-chart"].on_page_load`
- Toolbar: Company (Link), Department (Select), Branch (Select)
- `doLoad()` → API call → `doRender()` builds tree from flat list
- Tree: recursive `nodeH()` → `.itc-card` + `.itc-children`
- Collapse: `.itc-tog` toggles `.itc-hidden` on `.itc-children`
- Click card → `frappe.set_route("app","employee", id)`

## CSS Classes (all in JS string)

- `.itc-card` — flex row, left color bar
- `.itc-children` — indented container, left border line
- `.itc-av` — avatar, `.itc-name/.itc-desg` — text
- `.itc-td` — dept tag (colored), `.itc-tb` — branch tag (gray)
- `.itc-tog` — expand/collapse button, `.itc-hidden` — hides children
