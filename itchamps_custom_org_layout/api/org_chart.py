"""
ITChamps Custom Org Layout — Server API
Returns employee data for the org chart, with optional grouping by Department or Branch.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_org_chart_data(company: str, group_by: str = "Hierarchy") -> dict:
    """
    Fetch all active employees for the given company and return them
    along with summary statistics.

    Args:
        company: The company to filter by
        group_by: One of "Hierarchy", "Department", or "Branch"

    Returns:
        dict with keys: employees (list), stats (dict)
    """
    if not company:
        frappe.throw(_("Company is required"))

    # ── Fetch employees ──
    fields = [
        "name",
        "employee_name",
        "designation",
        "department",
        "branch",
        "reports_to",
        "image",
        "company",
        "status",
    ]

    employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=fields,
        order_by="employee_name asc",
        limit_page_length=0,  # return all
    )

    # ── Enrich with reports_to name ──
    emp_map = {e.name: e.employee_name for e in employees}
    for emp in employees:
        emp["reports_to_name"] = emp_map.get(emp.get("reports_to"), "")

    # ── Build stats ──
    stats = _build_stats(employees, group_by)

    return {"employees": employees, "stats": stats}


def _build_stats(employees: list, group_by: str) -> dict:
    """Build summary statistics for the stats bar."""
    stats = {"Total Employees": len(employees)}

    departments = set()
    branches = set()
    designations = set()

    for emp in employees:
        if emp.get("department"):
            departments.add(emp["department"])
        if emp.get("branch"):
            branches.add(emp["branch"])
        if emp.get("designation"):
            designations.add(emp["designation"])

    stats["Departments"] = len(departments)
    stats["Branches"] = len(branches)
    stats["Designations"] = len(designations)

    if group_by == "Department":
        stats["Groups Shown"] = len(departments) + (
            1 if any(not e.get("department") for e in employees) else 0
        )
    elif group_by == "Branch":
        stats["Groups Shown"] = len(branches) + (
            1 if any(not e.get("branch") for e in employees) else 0
        )

    return stats


@frappe.whitelist()
def get_chart_filters(company: str) -> dict:
    """
    Return available departments and branches for the given company.
    Useful for advanced filtering in future versions.
    """
    if not company:
        return {"departments": [], "branches": []}

    departments = frappe.get_all(
        "Department",
        filters={"company": company, "disabled": 0},
        fields=["name"],
        order_by="name asc",
        limit_page_length=0,
    )

    branches = frappe.get_all(
        "Branch",
        fields=["name"],
        order_by="name asc",
        limit_page_length=0,
    )

    return {
        "departments": [d.name for d in departments],
        "branches": [b.name for b in branches],
    }
