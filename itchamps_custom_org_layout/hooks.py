app_name = "itchamps_custom_org_layout"
app_title = "ITChamps Custom Org Layout"
app_publisher = "ITChamps"
app_description = "Custom Org Chart with Department/Branch Grouping, color-coded nodes, compact tree view, and modern dashboard style."
app_email = "tjs.kutnikar@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext", "hrms"]

# Only load JS/CSS on the organizational chart page, not globally.
# Using page_js/page_css ensures it loads once, on the right page.
page_js = {
    "organizational-chart": "public/js/custom_org_chart.js"
}

page_css = {
    "organizational-chart": "public/css/custom_org_chart.css"
}
