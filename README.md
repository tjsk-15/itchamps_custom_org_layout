# ITChamps Custom Org Layout

A custom Frappe app that overrides the default HRMS Organizational Chart with a modern, color-coded, compact dashboard.

## Features

- **Group by Department or Branch** — dropdown selector to toggle views
- **Color-coded nodes** — each department/branch gets a unique color
- **Compact tree view** — collapsible hierarchy with minimal whitespace
- **Modern dashboard** — stats bar, search, color legend
- **Dark mode support** — works with Frappe's built-in dark theme
- **Responsive** — works on desktop and mobile

## Installation

### On Frappe Cloud

1. Push this app to a GitHub repository
2. In Frappe Cloud dashboard, go to your bench → Apps → Add App
3. Enter your GitHub repo URL
4. Install the app on your site

### Local Development

```bash
bench get-app https://github.com/YOUR_ORG/itchamps_custom_org_layout.git
bench --site your-site.localhost install-app itchamps_custom_org_layout
bench build
bench restart
```

## Requirements

- Frappe Framework v15+
- ERPNext
- HRMS (Frappe HR)

## License

MIT
