"""
ITChamps Custom Org Layout — Server API
Returns employee data structured as Department → Manager → Employees,
with optional filtering by branch, department, and manager.
"""

import frappe
from frappe import _


@frappe.whitelist()
def get_org_chart_data(
    company: str,
    branch: str = "",
    department: str = "",
    manager: str = "",
) -> dict:
    """
    Fetch active employees for the given company and return them
    structured for Department → Manager → Employees hierarchy.

    Args:
        company: The company to filter by
        branch: Optional branch filter
        department: Optional department filter
        manager: Optional manager (reports_to) filter

    Returns:
        dict with keys: departments (list of dept objects), stats (dict), filters (dict)
    """
    if not company:
        frappe.throw(_("Company is required"))

    # ── Build filters ──
    filters = {"company": company, "status": "Active"}
    if branch:
        filters["branch"] = branch
    if department:
        filters["department"] = department

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
        filters=filters,
        fields=fields,
        order_by="employee_name asc",
        limit_page_length=0,
    )

    # ── Build employee map ──
    emp_map = {e.name: e for e in employees}

    # ── If manager filter is set, keep only that manager's direct reports + the manager ──
    if manager:
        filtered = [e for e in employees if e.reports_to == manager or e.name == manager]
        employees = filtered

    # ── Identify managers: employees who have at least one direct report ──
    manager_ids = set()
    for emp in employees:
        if emp.reports_to and emp.reports_to in emp_map:
            manager_ids.add(emp.reports_to)

    # ── Group: Department → Manager → Employees ──
    dept_tree = {}
    unmanaged = {}  # employees with no manager

    for emp in employees:
        dept_name = emp.department or "Unassigned"

        if dept_name not in dept_tree:
            dept_tree[dept_name] = {}

        if emp.name in manager_ids:
            # This person is a manager — ensure they have a slot
            if emp.name not in dept_tree[dept_name]:
                dept_tree[dept_name][emp.name] = {
                    "manager": emp,
                    "reports": [],
                }
            else:
                dept_tree[dept_name][emp.name]["manager"] = emp

        if emp.reports_to and emp.reports_to in emp_map:
            mgr = emp_map[emp.reports_to]
            mgr_dept = mgr.department or "Unassigned"
            if mgr_dept not in dept_tree:
                dept_tree[mgr_dept] = {}
            if emp.reports_to not in dept_tree[mgr_dept]:
                dept_tree[mgr_dept][emp.reports_to] = {
                    "manager": mgr,
                    "reports": [],
                }
            # Don't add the manager as their own report
            if emp.name != emp.reports_to:
                dept_tree[mgr_dept][emp.reports_to]["reports"].append(emp)
        elif emp.name not in manager_ids:
            # No manager and not a manager themselves
            if dept_name not in unmanaged:
                unmanaged[dept_name] = []
            unmanaged[dept_name].append(emp)

    # ── Build structured output ──
    departments_out = []
    all_dept_names = sorted(
        set(list(dept_tree.keys()) + list(unmanaged.keys())),
        key=lambda x: (x == "Unassigned", x),
    )

    for dept_name in all_dept_names:
        managers_list = []

        # Managers with their reports
        if dept_name in dept_tree:
            for mgr_id, data in sorted(
                dept_tree[dept_name].items(),
                key=lambda x: x[1]["manager"].employee_name,
            ):
                mgr = data["manager"]
                reports = sorted(data["reports"], key=lambda e: e.employee_name)
                managers_list.append({
                    "manager": _serialize_emp(mgr, emp_map),
                    "reports": [_serialize_emp(r, emp_map) for r in reports],
                })

        # Unmanaged employees
        unmanaged_list = []
        if dept_name in unmanaged:
            unmanaged_list = [
                _serialize_emp(e, emp_map)
                for e in sorted(unmanaged[dept_name], key=lambda e: e.employee_name)
            ]

        emp_count = sum(
            1 + len(m["reports"]) for m in managers_list
        ) + len(unmanaged_list)

        departments_out.append({
            "name": dept_name,
            "managers": managers_list,
            "unmanaged": unmanaged_list,
            "employee_count": emp_count,
        })

    # ── Stats ──
    all_employees = frappe.get_all(
        "Employee",
        filters={"company": company, "status": "Active"},
        fields=["name", "department", "branch", "designation", "reports_to"],
        limit_page_length=0,
    )
    stats = _build_stats(all_employees)

    # ── Available filter values ──
    available_filters = _get_filters(company, all_employees)

    return {
        "departments": departments_out,
        "stats": stats,
        "filters": available_filters,
    }


def _serialize_emp(emp, emp_map) -> dict:
    """Convert employee record to a clean dict for the frontend."""
    reports_to_name = ""
    if emp.get("reports_to") and emp.reports_to in emp_map:
        reports_to_name = emp_map[emp.reports_to].employee_name
    return {
        "name": emp.name,
        "employee_name": emp.employee_name,
        "designation": emp.designation or "",
        "department": emp.department or "",
        "branch": emp.branch or "",
        "reports_to": emp.reports_to or "",
        "reports_to_name": reports_to_name,
        "image": emp.image or "",
    }


def _build_stats(employees: list) -> dict:
    """Build summary statistics."""
    departments = set()
    branches = set()
    managers = set()

    for emp in employees:
        if emp.get("department"):
            departments.add(emp["department"])
        if emp.get("branch"):
            branches.add(emp["branch"])
        if emp.get("reports_to"):
            managers.add(emp["reports_to"])

    return {
        "Total Employees": len(employees),
        "Departments": len(departments),
        "Branches": len(branches),
        "Managers": len(managers),
    }


def _get_filters(company: str, employees: list) -> dict:
    """Return available filter options for the company."""
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

    # Managers: employees who have at least one direct report
    manager_ids = set()
    for emp in employees:
        if emp.get("reports_to"):
            manager_ids.add(emp["reports_to"])

    manager_names = []
    if manager_ids:
        manager_records = frappe.get_all(
            "Employee",
            filters={"name": ("in", list(manager_ids)), "status": "Active"},
            fields=["name", "employee_name"],
            order_by="employee_name asc",
            limit_page_length=0,
        )
        manager_names = [
            {"id": m.name, "name": m.employee_name} for m in manager_records
        ]

    return {
        "departments": [d.name for d in departments],
        "branches": [b.name for b in branches],
        "managers": manager_names,
    }
