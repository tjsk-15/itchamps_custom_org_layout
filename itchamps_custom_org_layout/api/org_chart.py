"""
ITChamps Custom Org Layout — Server API
Returns a flat employee list with reports_to relationships.
The client builds the tree. Filters: department, branch.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_org_chart_data(company: str, department: str = "", branch: str = "") -> dict:
    if not company:
        frappe.throw(_("Company is required"))

    fields = [
        "name", "employee_name", "designation", "department",
        "branch", "reports_to", "image", "status",
    ]

    # Always fetch ALL employees so reports_to links resolve correctly
    all_employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=fields,
        order_by="employee_name asc",
        limit_page_length=0,
    )

    emp_map = {e.name: e for e in all_employees}

    # Serialise
    employees = []
    for e in all_employees:
        mgr_name = ""
        if e.reports_to and e.reports_to in emp_map:
            mgr_name = emp_map[e.reports_to].employee_name
        employees.append({
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "department": e.department or "",
            "branch": e.branch or "",
            "reports_to": e.reports_to or "",
            "reports_to_name": mgr_name,
            "image": e.image or "",
        })

    # Filter options (from full set, before filtering)
    all_depts = sorted(set(e["department"] for e in employees if e["department"]))
    all_branches = sorted(set(e["branch"] for e in employees if e["branch"]))

    # Apply filters for the visible set
    visible = employees
    if department:
        visible = [e for e in visible if e["department"] == department]
    if branch:
        visible = [e for e in visible if e["branch"] == branch]

    # When filtering, also include any manager in the chain up to the root
    # so the tree stays connected
    if department or branch:
        visible_ids = set(e["id"] for e in visible)
        # Walk up the chain for each visible employee
        to_add = set()
        for e in visible:
            mgr_id = e["reports_to"]
            while mgr_id and mgr_id in emp_map and mgr_id not in visible_ids and mgr_id not in to_add:
                to_add.add(mgr_id)
                mgr_id = emp_map[mgr_id].reports_to or ""

        if to_add:
            for eid in to_add:
                e = emp_map[eid]
                mgr_name = ""
                if e.reports_to and e.reports_to in emp_map:
                    mgr_name = emp_map[e.reports_to].employee_name
                visible.append({
                    "id": e.name,
                    "name": e.employee_name,
                    "designation": e.designation or "",
                    "department": e.department or "",
                    "branch": e.branch or "",
                    "reports_to": e.reports_to or "",
                    "reports_to_name": mgr_name,
                    "image": e.image or "",
                })

    return {
        "employees": visible,
        "filters": {"departments": all_depts, "branches": all_branches},
    }
