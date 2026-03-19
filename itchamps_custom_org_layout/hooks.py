app_name = "itchamps_custom_org_layout"
app_title = "ITChamps Custom Org Layout"
app_publisher = "ITChamps"
app_description = "Custom Org Chart with Department/Branch Grouping, color-coded nodes, compact tree view, and modern dashboard style."
app_email = "tjs.kutnikar@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext", "hrms"]

# --- Include custom JS/CSS in desk ---
app_include_js = [
    "/assets/itchamps_custom_org_layout/js/custom_org_chart.js"
]

app_include_css = [
    "/assets/itchamps_custom_org_layout/css/custom_org_chart.css"
]

# --- Override the HRMS Organizational Chart page ---
page_js = {
    "organizational-chart": "public/js/custom_org_chart.js"
}

# --- Fixtures (export any Custom Fields if needed) ---
# fixtures = []

# --- Patches ---
# patches = []
