app_name = "itchamps_custom_org_layout"
app_title = "ITChamps Custom Org Layout"
app_publisher = "ITChamps"
app_description = "Custom Org Chart override for HRMS."
app_email = "tjs.kutnikar@gmail.com"
app_license = "MIT"
required_apps = ["frappe", "erpnext", "hrms"]

# Load JS globally via app_include_js so it registers on_page_load
# BEFORE the page actually loads. This overrides HRMS's own handler.
# Do NOT also use page_js — that causes double execution.
app_include_js = [
    "/assets/itchamps_custom_org_layout/js/custom_org_chart.js"
]
