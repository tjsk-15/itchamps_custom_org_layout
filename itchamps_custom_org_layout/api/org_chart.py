"""
ITChamps Custom Org Layout — Server API
Simple: returns flat employee list + filter options.
Client builds the tree.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_org_chart_data(company, department="", branch=""):
    if not company:
        frappe.throw(_("Company is required"))

    employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=[
            "name", "employee_name", "designation", "department",
            "branch", "reports_to", "image",
        ],
        order_by="employee_name asc",
        limit_page_length=0,
    )

    emp_map = {e.name: e for e in employees}

    # Build serialized list
    result = []
    for e in employees:
        result.append({
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "department": e.department or "",
            "branch": e.branch or "",
            "reports_to": e.reports_to or "",
            "image": e.image or "",
        })

    # Filter options from full unfiltered set
    all_depts = sorted(set(e["department"] for e in result if e["department"]))
    all_branches = sorted(set(e["branch"] for e in result if e["branch"]))

    # Apply filters
    visible = result
    if department:
        visible = [e for e in visible if e["department"] == department]
    if branch:
        visible = [e for e in visible if e["branch"] == branch]

    # When filtering, walk up reports_to chain to keep tree connected
    if department or branch:
        visible_ids = set(e["id"] for e in visible)
        extras = set()
        for e in list(visible):
            mgr_id = e["reports_to"]
            while mgr_id and mgr_id in emp_map and mgr_id not in visible_ids and mgr_id not in extras:
                extras.add(mgr_id)
                mgr_id = emp_map[mgr_id].reports_to or ""
        if extras:
            for eid in extras:
                em = emp_map[eid]
                visible.append({
                    "id": em.name,
                    "name": em.employee_name,
                    "designation": em.designation or "",
                    "department": em.department or "",
                    "branch": em.branch or "",
                    "reports_to": em.reports_to or "",
                    "image": em.image or "",
                })

    return {
        "employees": visible,
        "departments": all_depts,
        "branches": all_branches,
    }
