/**
 * ITChamps Custom Org Layout
 * Overrides the default HRMS Organizational Chart page with:
 *   - Group-by dropdown (Department / Branch / Hierarchy)
 *   - Color-coded nodes per group
 *   - Compact tree view
 *   - Modern dashboard styling with search, legend, stats
 */

frappe.provide("itchamps_org_chart");

// ──────────────────────────────────────────────
// COLOR PALETTE — up to 20 distinct group colors
// ──────────────────────────────────────────────
itchamps_org_chart.COLORS = [
	"#4C6EF5", "#F76707", "#0CA678", "#E64980", "#7950F2",
	"#1098AD", "#D6336C", "#5C940D", "#E8590C", "#1C7ED6",
	"#AE3EC9", "#2B8A3E", "#F59F00", "#C92A2A", "#087F5B",
	"#845EF7", "#FF922B", "#20C997", "#FA5252", "#3B5BDB"
];

itchamps_org_chart.color_map = {};
itchamps_org_chart.color_index = 0;

itchamps_org_chart.get_color = function (group_name) {
	if (!group_name) return "#868E96";
	if (!itchamps_org_chart.color_map[group_name]) {
		itchamps_org_chart.color_map[group_name] =
			itchamps_org_chart.COLORS[itchamps_org_chart.color_index % itchamps_org_chart.COLORS.length];
		itchamps_org_chart.color_index++;
	}
	return itchamps_org_chart.color_map[group_name];
};

// ──────────────────────────────────────────────
// MAIN PAGE SETUP — runs when the page loads
// ──────────────────────────────────────────────
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});

	wrapper.org_chart_page = page;

	// Build the toolbar
	itchamps_org_chart.setup_toolbar(page);

	// Build the main container
	$(page.body).html(`
		<div class="itc-org-dashboard">
			<div class="itc-org-stats-bar" id="itc-stats-bar"></div>
			<div class="itc-org-legend" id="itc-legend"></div>
			<div class="itc-org-search-wrapper">
				<input type="text" class="form-control itc-org-search"
					   id="itc-search" placeholder="${__("Search employees...")}">
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
	// Refresh when navigating back to the page
	if (wrapper.org_chart_page && wrapper.org_chart_page._group_by) {
		itchamps_org_chart.load_chart(wrapper.org_chart_page);
	}
};

// ──────────────────────────────────────────────
// TOOLBAR — company selector + group-by dropdown
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
			itchamps_org_chart.load_chart(page);
		},
	});

	// Group-by dropdown
	page.group_by_field = page.add_field({
		fieldname: "group_by",
		label: __("Group By"),
		fieldtype: "Select",
		options: [
			__("Hierarchy"),
			__("Department"),
			__("Branch"),
		].join("\n"),
		default: __("Hierarchy"),
		change: function () {
			itchamps_org_chart.load_chart(page);
		},
	});
};

// ──────────────────────────────────────────────
// DATA LOADING
// ──────────────────────────────────────────────
itchamps_org_chart.load_chart = function (page) {
	const company = page.company_field?.get_value() ||
					frappe.defaults.get_default("company");
	const group_by = page.group_by_field?.get_value() || "Hierarchy";

	if (!company) {
		$("#itc-chart-container").html(
			`<div class="itc-empty-state">${__("Please select a company")}</div>`
		);
		return;
	}

	page._group_by = group_by;

	// Reset color map on reload
	itchamps_org_chart.color_map = {};
	itchamps_org_chart.color_index = 0;

	$("#itc-chart-container").html(
		`<div class="itc-loading"><span class="text-muted">${__("Loading...")}</span></div>`
	);

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: { company: company, group_by: group_by },
		callback: function (r) {
			if (r.message) {
				itchamps_org_chart.render(r.message, group_by);
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
// RENDERING
// ──────────────────────────────────────────────
itchamps_org_chart.render = function (data, group_by) {
	const { employees, stats } = data;

	if (!employees || employees.length === 0) {
		$("#itc-chart-container").html(
			`<div class="itc-empty-state">${__("No employees found")}</div>`
		);
		$("#itc-stats-bar").html("");
		$("#itc-legend").html("");
		return;
	}

	// ── Stats bar ──
	itchamps_org_chart.render_stats(stats);

	if (group_by === "Hierarchy") {
		itchamps_org_chart.render_hierarchy(employees);
	} else {
		itchamps_org_chart.render_grouped(employees, group_by);
	}

	// ── Legend ──
	itchamps_org_chart.render_legend();
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
// HIERARCHY VIEW (tree)
// ──────────────────────────────────────────────
itchamps_org_chart.render_hierarchy = function (employees) {
	// Build a lookup
	const map = {};
	employees.forEach(e => { map[e.name] = { ...e, children: [] }; });
	const roots = [];
	employees.forEach(e => {
		if (e.reports_to && map[e.reports_to]) {
			map[e.reports_to].children.push(map[e.name]);
		} else {
			roots.push(map[e.name]);
		}
	});

	let html = '<div class="itc-tree">';
	roots.forEach(root => {
		html += itchamps_org_chart.render_tree_node(root);
	});
	html += "</div>";
	$("#itc-chart-container").html(html);

	// Bind expand/collapse
	$(".itc-node-toggle").on("click", function (e) {
		e.stopPropagation();
		const $children = $(this).closest(".itc-tree-node").children(".itc-tree-children");
		$children.toggleClass("itc-collapsed");
		$(this).toggleClass("itc-rotated");
	});

	// Bind card click to open employee
	$(".itc-node-card").on("click", function () {
		const emp_id = $(this).data("employee");
		if (emp_id) frappe.set_route("app", "employee", emp_id);
	});
};

itchamps_org_chart.render_tree_node = function (node) {
	const group_name = node.department || node.branch || "Unassigned";
	const color = itchamps_org_chart.get_color(group_name);
	const has_children = node.children && node.children.length > 0;
	const abbr = itchamps_org_chart.get_abbr(node.employee_name);
	const image_html = node.image
		? `<img class="itc-avatar-img" src="${node.image}" alt="${frappe.utils.escape_html(node.employee_name)}">`
		: `<span class="itc-avatar-abbr" style="background:${color}">${abbr}</span>`;

	let html = `<div class="itc-tree-node">
		<div class="itc-node-card" data-employee="${node.name}" data-group="${frappe.utils.escape_html(group_name)}">
			<div class="itc-node-color-bar" style="background:${color}"></div>
			${has_children ? '<span class="itc-node-toggle">&#9662;</span>' : ""}
			<div class="itc-node-avatar">${image_html}</div>
			<div class="itc-node-info">
				<div class="itc-node-name">${frappe.utils.escape_html(node.employee_name)}</div>
				<div class="itc-node-designation">${frappe.utils.escape_html(node.designation || "")}</div>
				<span class="itc-node-badge" style="background:${color}20; color:${color}">
					${frappe.utils.escape_html(group_name)}
				</span>
			</div>
		</div>`;

	if (has_children) {
		html += '<div class="itc-tree-children">';
		node.children.forEach(child => {
			html += itchamps_org_chart.render_tree_node(child);
		});
		html += "</div>";
	}

	html += "</div>";
	return html;
};

// ──────────────────────────────────────────────
// GROUPED VIEW (by Department or Branch)
// ──────────────────────────────────────────────
itchamps_org_chart.render_grouped = function (employees, group_by) {
	const field = group_by === "Department" ? "department" : "branch";
	const groups = {};

	employees.forEach(emp => {
		const key = emp[field] || "Unassigned";
		if (!groups[key]) groups[key] = [];
		groups[key].push(emp);
	});

	// Sort groups alphabetically
	const sorted_keys = Object.keys(groups).sort((a, b) =>
		a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
	);

	let html = '<div class="itc-grouped-view">';

	sorted_keys.forEach(group_name => {
		const color = itchamps_org_chart.get_color(group_name);
		const members = groups[group_name];

		html += `<div class="itc-group-section">
			<div class="itc-group-header" style="border-left: 4px solid ${color}">
				<span class="itc-group-title">${frappe.utils.escape_html(group_name)}</span>
				<span class="itc-group-count">${members.length} ${__("employees")}</span>
			</div>
			<div class="itc-group-grid">`;

		members.forEach(emp => {
			const abbr = itchamps_org_chart.get_abbr(emp.employee_name);
			const image_html = emp.image
				? `<img class="itc-avatar-img" src="${emp.image}" alt="${frappe.utils.escape_html(emp.employee_name)}">`
				: `<span class="itc-avatar-abbr" style="background:${color}">${abbr}</span>`;

			html += `<div class="itc-group-card" data-employee="${emp.name}" data-group="${frappe.utils.escape_html(group_name)}">
				<div class="itc-node-color-bar" style="background:${color}"></div>
				<div class="itc-node-avatar">${image_html}</div>
				<div class="itc-node-info">
					<div class="itc-node-name">${frappe.utils.escape_html(emp.employee_name)}</div>
					<div class="itc-node-designation">${frappe.utils.escape_html(emp.designation || "")}</div>
					${emp.reports_to_name ? `<div class="itc-node-reports-to">${__("Reports to")}: ${frappe.utils.escape_html(emp.reports_to_name)}</div>` : ""}
				</div>
			</div>`;
		});

		html += `</div></div>`;
	});

	html += "</div>";
	$("#itc-chart-container").html(html);

	// Bind card click
	$(".itc-group-card").on("click", function () {
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
		$(".itc-node-card, .itc-group-card, .itc-tree-node, .itc-group-section").show();
		return;
	}

	// Grouped view
	$(".itc-group-card").each(function () {
		const text = $(this).text().toLowerCase();
		$(this).toggle(text.includes(query));
	});
	// Hide empty groups
	$(".itc-group-section").each(function () {
		const visible = $(this).find(".itc-group-card:visible").length;
		$(this).toggle(visible > 0);
	});

	// Tree view
	$(".itc-node-card").each(function () {
		const text = $(this).text().toLowerCase();
		const $node = $(this).closest(".itc-tree-node");
		if (text.includes(query)) {
			$node.show();
			$node.parents(".itc-tree-children").removeClass("itc-collapsed").show();
			$node.parents(".itc-tree-node").show();
		} else {
			$node.hide();
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
