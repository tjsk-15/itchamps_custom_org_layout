/**
 * ITChamps Custom Org Layout
 * Hierarchy: Department → Manager → Employees
 * Filters: Branch, Department, Manager
 * Features: color-coded departments, collapsible sections, search, stats, dark mode
 */

frappe.provide("itchamps_org_chart");

// ──────────────────────────────────────────────
// COLOR PALETTE — up to 20 distinct department colors
// ──────────────────────────────────────────────
itchamps_org_chart.COLORS = [
	"#4C6EF5", "#F76707", "#0CA678", "#E64980", "#7950F2",
	"#1098AD", "#D6336C", "#5C940D", "#E8590C", "#1C7ED6",
	"#AE3EC9", "#2B8A3E", "#F59F00", "#C92A2A", "#087F5B",
	"#845EF7", "#FF922B", "#20C997", "#FA5252", "#3B5BDB"
];

itchamps_org_chart.color_map = {};
itchamps_org_chart.color_index = 0;

itchamps_org_chart.get_color = function (dept_name) {
	if (!dept_name || dept_name === "Unassigned") return "#868E96";
	if (!itchamps_org_chart.color_map[dept_name]) {
		itchamps_org_chart.color_map[dept_name] =
			itchamps_org_chart.COLORS[itchamps_org_chart.color_index % itchamps_org_chart.COLORS.length];
		itchamps_org_chart.color_index++;
	}
	return itchamps_org_chart.color_map[dept_name];
};

// ──────────────────────────────────────────────
// MAIN PAGE SETUP
// ──────────────────────────────────────────────
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});

	wrapper.org_chart_page = page;

	// Build toolbar with filters
	itchamps_org_chart.setup_toolbar(page);

	// Build main container
	$(page.body).html(`
		<div class="itc-org-dashboard">
			<div class="itc-org-stats-bar" id="itc-stats-bar"></div>
			<div class="itc-org-legend" id="itc-legend"></div>
			<div class="itc-org-search-wrapper">
				<input type="text" class="form-control itc-org-search"
					   id="itc-search" placeholder="${__("Search employees, managers, departments...")}">
			</div>
			<div class="itc-org-chart-container" id="itc-chart-container">
				<div class="itc-loading">
					<span class="text-muted">${__("Loading organizational chart...")}</span>
				</div>
			</div>
		</div>
	`);

	// Bind search
	$("#itc-search").on("input", frappe.utils.debounce(function () {
		itchamps_org_chart.filter_nodes($(this).val());
	}, 300));

	// Initial load
	itchamps_org_chart.load_chart(page);
};

frappe.pages["organizational-chart"].on_page_show = function (wrapper) {
	if (wrapper.org_chart_page) {
		itchamps_org_chart.load_chart(wrapper.org_chart_page);
	}
};

// ──────────────────────────────────────────────
// TOOLBAR — Company + Filter dropdowns
// ──────────────────────────────────────────────
itchamps_org_chart.setup_toolbar = function (page) {
	// Company selector
	page.company_field = page.add_field({
		fieldname: "company",
		label: __("Company"),
		fieldtype: "Link",
		options: "Company",
		default: frappe.defaults.get_default("company"),
		reqd: 1,
		change: function () {
			// Reset filters when company changes
			itchamps_org_chart.reset_filters(page);
			itchamps_org_chart.load_chart(page);
		},
	});

	// Branch filter
	page.branch_field = page.add_field({
		fieldname: "branch",
		label: __("Branch"),
		fieldtype: "Select",
		options: [__("All Branches")].join("\n"),
		default: __("All Branches"),
		change: function () {
			itchamps_org_chart.load_chart(page);
		},
	});

	// Department filter
	page.department_field = page.add_field({
		fieldname: "department",
		label: __("Department"),
		fieldtype: "Select",
		options: [__("All Departments")].join("\n"),
		default: __("All Departments"),
		change: function () {
			itchamps_org_chart.load_chart(page);
		},
	});

	// Manager filter
	page.manager_field = page.add_field({
		fieldname: "manager",
		label: __("Manager"),
		fieldtype: "Select",
		options: [__("All Managers")].join("\n"),
		default: __("All Managers"),
		change: function () {
			itchamps_org_chart.load_chart(page);
		},
	});
};

itchamps_org_chart.reset_filters = function (page) {
	if (page.branch_field) page.branch_field.set_value(__("All Branches"));
	if (page.department_field) page.department_field.set_value(__("All Departments"));
	if (page.manager_field) page.manager_field.set_value(__("All Managers"));
};

itchamps_org_chart.update_filter_options = function (page, filters) {
	if (!filters) return;

	// Branch options
	if (page.branch_field && filters.branches) {
		let branch_opts = [__("All Branches")].concat(filters.branches);
		page.branch_field.df.options = branch_opts.join("\n");
		page.branch_field.refresh();
	}

	// Department options
	if (page.department_field && filters.departments) {
		let dept_opts = [__("All Departments")].concat(filters.departments);
		page.department_field.df.options = dept_opts.join("\n");
		page.department_field.refresh();
	}

	// Manager options
	if (page.manager_field && filters.managers) {
		let mgr_opts = [__("All Managers")];
		itchamps_org_chart._manager_map = {};
		filters.managers.forEach(function (m) {
			mgr_opts.push(m.name + " (" + m.id + ")");
			itchamps_org_chart._manager_map[m.name + " (" + m.id + ")"] = m.id;
		});
		page.manager_field.df.options = mgr_opts.join("\n");
		page.manager_field.refresh();
	}
};

// ──────────────────────────────────────────────
// DATA LOADING
// ──────────────────────────────────────────────
itchamps_org_chart.load_chart = function (page) {
	const company = page.company_field?.get_value() ||
					frappe.defaults.get_default("company");

	if (!company) {
		$("#itc-chart-container").html(
			`<div class="itc-empty-state">${__("Please select a company")}</div>`
		);
		return;
	}

	// Read filter values
	let branch = page.branch_field?.get_value() || "";
	let department = page.department_field?.get_value() || "";
	let manager = page.manager_field?.get_value() || "";

	// Convert "All X" back to empty
	if (branch === __("All Branches")) branch = "";
	if (department === __("All Departments")) department = "";
	if (manager === __("All Managers")) {
		manager = "";
	} else if (itchamps_org_chart._manager_map && itchamps_org_chart._manager_map[manager]) {
		manager = itchamps_org_chart._manager_map[manager];
	}

	// Reset colors
	itchamps_org_chart.color_map = {};
	itchamps_org_chart.color_index = 0;

	$("#itc-chart-container").html(
		`<div class="itc-loading"><span class="text-muted">${__("Loading...")}</span></div>`
	);

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: {
			company: company,
			branch: branch,
			department: department,
			manager: manager,
		},
		callback: function (r) {
			if (r.message) {
				itchamps_org_chart.update_filter_options(page, r.message.filters);
				itchamps_org_chart.render(r.message);
			}
		},
		error: function () {
			$("#itc-chart-container").html(
				`<div class="itc-empty-state">${__("Error loading chart data")}</div>`
			);
		},
	});
};

// ──────────────────────────────────────────────
// RENDERING — Department → Manager → Employees
// ──────────────────────────────────────────────
itchamps_org_chart.render = function (data) {
	const { departments, stats } = data;

	if (!departments || departments.length === 0) {
		$("#itc-chart-container").html(
			`<div class="itc-empty-state">${__("No employees found")}</div>`
		);
		$("#itc-stats-bar").html("");
		$("#itc-legend").html("");
		return;
	}

	// Stats bar
	itchamps_org_chart.render_stats(stats);

	// Render departments
	let html = '<div class="itc-dept-view">';

	departments.forEach(function (dept) {
		const color = itchamps_org_chart.get_color(dept.name);

		html += `<div class="itc-dept-section" data-department="${frappe.utils.escape_html(dept.name)}">`;

		// Department header (collapsible)
		html += `<div class="itc-dept-header" style="border-left: 4px solid ${color}">
			<div class="itc-dept-header-left">
				<span class="itc-dept-toggle">&#9662;</span>
				<span class="itc-dept-icon" style="background: ${color}20; color: ${color}">
					&#9733;
				</span>
				<span class="itc-dept-title">${frappe.utils.escape_html(dept.name)}</span>
			</div>
			<span class="itc-dept-count">${dept.employee_count} ${__("employees")}</span>
		</div>`;

		html += '<div class="itc-dept-body">';

		// Managers and their reports
		dept.managers.forEach(function (mgr_group) {
			const mgr = mgr_group.manager;
			const reports = mgr_group.reports;

			html += '<div class="itc-manager-section">';

			// Manager card
			html += itchamps_org_chart.render_manager_card(mgr, color, reports.length);

			// Direct reports
			if (reports.length > 0) {
				html += '<div class="itc-reports-list">';
				reports.forEach(function (emp) {
					html += itchamps_org_chart.render_employee_card(emp, color);
				});
				html += '</div>';
			}

			html += '</div>';
		});

		// Unmanaged employees
		if (dept.unmanaged && dept.unmanaged.length > 0) {
			html += `<div class="itc-unmanaged-section">
				<div class="itc-unmanaged-header">
					<span class="itc-unmanaged-label">${__("No Manager Assigned")}</span>
					<span class="itc-unmanaged-count">${dept.unmanaged.length}</span>
				</div>
				<div class="itc-reports-list">`;

			dept.unmanaged.forEach(function (emp) {
				html += itchamps_org_chart.render_employee_card(emp, color);
			});

			html += '</div></div>';
		}

		html += '</div></div>';
	});

	html += '</div>';
	$("#itc-chart-container").html(html);

	// Legend
	itchamps_org_chart.render_legend();

	// Bind events
	itchamps_org_chart.bind_events();
};

// ── Manager card ──
itchamps_org_chart.render_manager_card = function (mgr, color, report_count) {
	const abbr = itchamps_org_chart.get_abbr(mgr.employee_name);
	const image_html = mgr.image
		? `<img class="itc-avatar-img" src="${mgr.image}" alt="${frappe.utils.escape_html(mgr.employee_name)}">`
		: `<span class="itc-avatar-abbr" style="background:${color}">${abbr}</span>`;

	return `<div class="itc-manager-card" data-employee="${mgr.name}"
				 data-name="${frappe.utils.escape_html(mgr.employee_name)}"
				 data-department="${frappe.utils.escape_html(mgr.department)}">
		<div class="itc-node-color-bar" style="background:${color}"></div>
		<div class="itc-manager-toggle">${report_count > 0 ? '&#9662;' : ''}</div>
		<div class="itc-node-avatar itc-avatar-manager">${image_html}</div>
		<div class="itc-node-info">
			<div class="itc-node-name">${frappe.utils.escape_html(mgr.employee_name)}</div>
			<div class="itc-node-designation">${frappe.utils.escape_html(mgr.designation)}</div>
			${mgr.branch ? `<span class="itc-node-badge itc-branch-badge">${frappe.utils.escape_html(mgr.branch)}</span>` : ''}
		</div>
		<div class="itc-manager-meta">
			<span class="itc-manager-role-badge" style="background:${color}15; color:${color}; border: 1px solid ${color}40">
				${__("Manager")}
			</span>
			${report_count > 0 ? `<span class="itc-report-count">${report_count} ${__("reports")}</span>` : ''}
		</div>
	</div>`;
};

// ── Employee card ──
itchamps_org_chart.render_employee_card = function (emp, color) {
	const abbr = itchamps_org_chart.get_abbr(emp.employee_name);
	const image_html = emp.image
		? `<img class="itc-avatar-img" src="${emp.image}" alt="${frappe.utils.escape_html(emp.employee_name)}">`
		: `<span class="itc-avatar-abbr" style="background:${color}90">${abbr}</span>`;

	return `<div class="itc-employee-card" data-employee="${emp.name}"
				 data-name="${frappe.utils.escape_html(emp.employee_name)}"
				 data-department="${frappe.utils.escape_html(emp.department)}">
		<div class="itc-node-color-bar" style="background:${color}80"></div>
		<div class="itc-node-avatar">${image_html}</div>
		<div class="itc-node-info">
			<div class="itc-node-name">${frappe.utils.escape_html(emp.employee_name)}</div>
			<div class="itc-node-designation">${frappe.utils.escape_html(emp.designation)}</div>
			${emp.branch ? `<span class="itc-node-badge itc-branch-badge">${frappe.utils.escape_html(emp.branch)}</span>` : ''}
		</div>
	</div>`;
};

// ── Stats bar ──
itchamps_org_chart.render_stats = function (stats) {
	if (!stats) { $("#itc-stats-bar").html(""); return; }
	let html = "";
	for (const [label, value] of Object.entries(stats)) {
		html += `<div class="itc-stat-card">
			<div class="itc-stat-value">${value}</div>
			<div class="itc-stat-label">${__(label)}</div>
		</div>`;
	}
	$("#itc-stats-bar").html(html);
};

// ── Legend ──
itchamps_org_chart.render_legend = function () {
	let html = "";
	for (const [name, color] of Object.entries(itchamps_org_chart.color_map)) {
		html += `<span class="itc-legend-item">
			<span class="itc-legend-dot" style="background:${color}"></span>
			${frappe.utils.escape_html(name)}
		</span>`;
	}
	$("#itc-legend").html(html);
};

// ──────────────────────────────────────────────
// EVENT BINDINGS
// ──────────────────────────────────────────────
itchamps_org_chart.bind_events = function () {
	// Department header collapse/expand
	$(".itc-dept-header").on("click", function () {
		const $body = $(this).siblings(".itc-dept-body");
		$body.toggleClass("itc-collapsed");
		$(this).find(".itc-dept-toggle").toggleClass("itc-rotated");
	});

	// Manager section collapse/expand
	$(".itc-manager-toggle").on("click", function (e) {
		e.stopPropagation();
		const $reports = $(this).closest(".itc-manager-card").siblings(".itc-reports-list");
		$reports.toggleClass("itc-collapsed");
		$(this).toggleClass("itc-rotated");
	});

	// Click card to open employee
	$(".itc-manager-card, .itc-employee-card").on("click", function (e) {
		// Don't navigate if clicking the toggle
		if ($(e.target).hasClass("itc-manager-toggle")) return;
		const emp_id = $(this).data("employee");
		if (emp_id) frappe.set_route("app", "employee", emp_id);
	});
};

// ──────────────────────────────────────────────
// SEARCH / FILTER
// ──────────────────────────────────────────────
itchamps_org_chart.filter_nodes = function (query) {
	query = (query || "").toLowerCase().trim();

	if (!query) {
		// Show everything, uncollapse
		$(".itc-dept-section, .itc-manager-section, .itc-manager-card, .itc-employee-card, .itc-unmanaged-section").show();
		$(".itc-dept-body, .itc-reports-list").removeClass("itc-collapsed");
		$(".itc-dept-toggle, .itc-manager-toggle").removeClass("itc-rotated");
		return;
	}

	// Filter employee cards
	$(".itc-employee-card").each(function () {
		const text = $(this).text().toLowerCase();
		$(this).toggle(text.includes(query));
	});

	// Filter manager cards — show if manager matches OR has visible reports
	$(".itc-manager-section").each(function () {
		const $mgr = $(this).find(".itc-manager-card");
		const mgr_text = $mgr.text().toLowerCase();
		const $reports = $(this).find(".itc-employee-card:visible");
		const show = mgr_text.includes(query) || $reports.length > 0;
		$(this).toggle(show);

		// Expand reports if searching
		if (show) {
			$(this).find(".itc-reports-list").removeClass("itc-collapsed");
		}
	});

	// Filter unmanaged sections
	$(".itc-unmanaged-section").each(function () {
		const visible = $(this).find(".itc-employee-card:visible").length;
		$(this).toggle(visible > 0);
	});

	// Filter department sections — show if has visible managers or unmanaged
	$(".itc-dept-section").each(function () {
		const header_text = $(this).find(".itc-dept-title").text().toLowerCase();
		const has_visible_managers = $(this).find(".itc-manager-section:visible").length > 0;
		const has_visible_unmanaged = $(this).find(".itc-unmanaged-section:visible").length > 0;
		const show = header_text.includes(query) || has_visible_managers || has_visible_unmanaged;
		$(this).toggle(show);

		// Expand department if searching
		if (show) {
			$(this).find(".itc-dept-body").removeClass("itc-collapsed");
			$(this).find(".itc-dept-toggle").removeClass("itc-rotated");
		}
	});
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
itchamps_org_chart.get_abbr = function (name) {
	if (!name) return "?";
	const parts = name.split(" ");
	if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	return name.substring(0, 2).toUpperCase();
};
