app_name = "itchamps_custom_org_layout"
app_title = "ITChamps Custom Org Layout"
app_publisher = "ITChamps"
app_description = "Custom Org Chart override for HRMS."
app_email = "tjs.kutnikar@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext", "hrms"]

# page_js runs AFTER the HRMS page's own JS has loaded.
# Our script detects the page wrapper and rebuilds it immediately.
page_js = {
    "organizational-chart": "public/js/custom_org_chart.js"
}
