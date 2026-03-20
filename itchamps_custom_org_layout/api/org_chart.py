"""
ITChamps Custom Org Layout — Server API
Groups employees by their reporting manager.
Each employee and manager carries a department tag.
Supports filtering by department and branch.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_org_chart_data(
    company: str,
    department: str = "",
    branch: str = "",
) -> dict:
    if not company:
        frappe.throw(_("Company is required"))

    fields = [
        "name", "employee_name", "designation", "department",
        "branch", "reports_to", "image", "status",
    ]

    employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=fields,
        order_by="employee_name asc",
        limit_page_length=0,
    )

    emp_map = {e.name: e for e in employees}

    # ── Apply filters (after fetching all, so manager names resolve) ──
    filtered = employees
    if department:
        filtered = [e for e in filtered if e.department == department]
    if branch:
        filtered = [e for e in filtered if e.branch == branch]

    filtered_ids = {e.name for e in filtered}

    # ── Group by manager ──
    # manager_id → list of direct reports
    manager_groups = {}
    no_manager = []

    for emp in filtered:
        mgr_id = emp.reports_to
        if mgr_id and mgr_id in emp_map:
            if mgr_id not in manager_groups:
                manager_groups[mgr_id] = []
            manager_groups[mgr_id].append(emp)
        else:
            no_manager.append(emp)

    # ── Build output ──
    groups = []

    # Sort managers alphabetically by name
    sorted_mgr_ids = sorted(
        manager_groups.keys(),
        key=lambda mid: emp_map[mid].employee_name,
    )

    for mgr_id in sorted_mgr_ids:
        mgr = emp_map[mgr_id]
        reports = sorted(manager_groups[mgr_id], key=lambda e: e.employee_name)
        groups.append({
            "type": "manager",
            "manager": _serialize(mgr),
            "reports": [_serialize(r) for r in reports],
        })

    # Unmanaged group at the end
    if no_manager:
        groups.append({
            "type": "unmanaged",
            "manager": None,
            "reports": [_serialize(e) for e in sorted(no_manager, key=lambda e: e.employee_name)],
        })

    # ── Stats (always from full unfiltered set) ──
    all_depts = sorted(set(e.department for e in employees if e.department))
    all_branches = sorted(set(e.branch for e in employees if e.branch))
    all_mgr_ids = sorted(
        set(e.reports_to for e in employees if e.reports_to and e.reports_to in emp_map),
        key=lambda mid: emp_map[mid].employee_name,
    )

    stats = {
        "Showing": sum(len(g["reports"]) for g in groups) + sum(1 for g in groups if g["manager"]),
        "Total Employees": len(employees),
        "Departments": len(all_depts),
        "Branches": len(all_branches),
        "Managers": len(all_mgr_ids),
    }

    available_filters = {
        "departments": all_depts,
        "branches": all_branches,
    }

    return {
        "groups": groups,
        "stats": stats,
        "filters": available_filters,
    }


def _serialize(emp) -> dict:
    return {
        "id": emp.name,
        "name": emp.employee_name,
        "designation": emp.designation or "",
        "department": emp.department or "",
        "branch": emp.branch or "",
        "image": emp.image or "",
    }
