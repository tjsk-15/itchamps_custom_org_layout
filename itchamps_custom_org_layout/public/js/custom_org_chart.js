/**
 * ITChamps Custom Org Layout
 *
 * Top-down org tree with CSS connector lines.
 * Each employee is a card. Children hang below their manager via vertical/horizontal lines.
 * Filters: Department dropdown, Branch dropdown (no free-text search).
 */

frappe.provide("itchamps_org");

// ── Dept colors ──
itchamps_org.COLORS = [
	"#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2",
	"#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9",
	"#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"
];
itchamps_org._cm = {};
itchamps_org._ci = 0;
itchamps_org.dcolor = function (d) {
	if (!d) return "#868E96";
	if (!itchamps_org._cm[d]) {
		itchamps_org._cm[d] = itchamps_org.COLORS[itchamps_org._ci++ % itchamps_org.COLORS.length];
	}
	return itchamps_org._cm[d];
};

// ────────────────────────────────────
// PAGE INIT
// ────────────────────────────────────
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});
	wrapper.org_chart_page = page;

	itchamps_org.toolbar(page);

	$(page.body).html(
		'<div class="itc-wrap">' +
			'<div class="itc-tree-scroll">' +
				'<div class="itc-tree" id="itc-tree">' +
					'<div class="itc-loader">' + __("Loading...") + '</div>' +
				'</div>' +
			'</div>' +
		'</div>'
	);

	itchamps_org.load(page);
};

frappe.pages["organizational-chart"].on_page_show = function (wrapper) {
	if (wrapper.org_chart_page) itchamps_org.load(wrapper.org_chart_page);
};

// ────────────────────────────────────
// TOOLBAR — dropdowns only
// ────────────────────────────────────
itchamps_org.toolbar = function (page) {
	page._company = page.add_field({
		fieldname: "company", label: __("Company"), fieldtype: "Link",
		options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
		change: function () {
			itchamps_org._reset(page);
			itchamps_org.load(page);
		},
	});
	page._dept = page.add_field({
		fieldname: "department", label: __("Department"), fieldtype: "Select",
		options: __("All Departments"), default: __("All Departments"),
		change: function () { itchamps_org.load(page); },
	});
	page._branch = page.add_field({
		fieldname: "branch", label: __("Branch"), fieldtype: "Select",
		options: __("All Branches"), default: __("All Branches"),
		change: function () { itchamps_org.load(page); },
	});
};

itchamps_org._reset = function (page) {
	if (page._dept) page._dept.set_value(__("All Departments"));
	if (page._branch) page._branch.set_value(__("All Branches"));
};

itchamps_org._set_options = function (page, f) {
	if (!f) return;
	if (f.departments && page._dept) {
		page._dept.df.options = [__("All Departments")].concat(f.departments).join("\n");
		page._dept.refresh();
	}
	if (f.branches && page._branch) {
		page._branch.df.options = [__("All Branches")].concat(f.branches).join("\n");
		page._branch.refresh();
	}
};

// ────────────────────────────────────
// LOAD DATA
// ────────────────────────────────────
itchamps_org.load = function (page) {
	var company = page._company ? page._company.get_value() : frappe.defaults.get_default("company");
	if (!company) {
		$("#itc-tree").html('<div class="itc-empty">' + __("Select a company") + '</div>');
		return;
	}

	var dept = page._dept ? page._dept.get_value() : "";
	var branch = page._branch ? page._branch.get_value() : "";
	if (dept === __("All Departments")) dept = "";
	if (branch === __("All Branches")) branch = "";

	itchamps_org._cm = {};
	itchamps_org._ci = 0;

	$("#itc-tree").html('<div class="itc-loader">' + __("Loading...") + '</div>');

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: { company: company, department: dept, branch: branch },
		callback: function (r) {
			if (!r.message) return;
			itchamps_org._set_options(page, r.message.filters);
			itchamps_org.render(r.message.employees);
		},
		error: function () {
			$("#itc-tree").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		},
	});
};

// ────────────────────────────────────
// BUILD TREE & RENDER
// ────────────────────────────────────
itchamps_org.render = function (employees) {
	if (!employees || employees.length === 0) {
		$("#itc-tree").html('<div class="itc-empty">' + __("No employees found") + '</div>');
		return;
	}

	// Build lookup
	var map = {};
	var i, e;
	for (i = 0; i < employees.length; i++) {
		e = employees[i];
		map[e.id] = { data: e, children: [] };
	}

	// Build parent-child
	var roots = [];
	for (i = 0; i < employees.length; i++) {
		e = employees[i];
		if (e.reports_to && map[e.reports_to]) {
			map[e.reports_to].children.push(map[e.id]);
		} else {
			roots.push(map[e.id]);
		}
	}

	// Sort children alphabetically
	function sortChildren(node) {
		node.children.sort(function (a, b) {
			return a.data.name.localeCompare(b.data.name);
		});
		for (var j = 0; j < node.children.length; j++) {
			sortChildren(node.children[j]);
		}
	}
	for (i = 0; i < roots.length; i++) {
		sortChildren(roots[i]);
	}

	// Render HTML
	var html = '<ul class="itc-level itc-root">';
	for (i = 0; i < roots.length; i++) {
		html += itchamps_org.node_html(roots[i]);
	}
	html += '</ul>';

	$("#itc-tree").html(html);

	// Click to open employee
	$("#itc-tree").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});

	// Toggle expand/collapse on the button
	$("#itc-tree").on("click", ".itc-expand-btn", function (ev) {
		ev.stopPropagation();
		var $li = $(this).closest("li.itc-node");
		$li.toggleClass("itc-collapsed");
		var count = $li.data("child-count") || 0;
		if ($li.hasClass("itc-collapsed")) {
			$(this).text("+" + count);
		} else {
			$(this).text("\u2212");
		}
	});
};

itchamps_org.node_html = function (node) {
	var d = node.data;
	var color = itchamps_org.dcolor(d.department);
	var abbr = itchamps_org.abbr(d.name);
	var hasKids = node.children.length > 0;

	var avatar;
	if (d.image) {
		avatar = '<img class="itc-card-img" src="' + d.image + '" alt="' + esc(d.name) + '">';
	} else {
		avatar = '<div class="itc-card-abbr" style="background:' + color + '">' + abbr + '</div>';
	}

	var html = '<li class="itc-node" data-child-count="' + node.children.length + '">';
	html += '<div class="itc-card" data-id="' + d.id + '" style="--card-accent:' + color + '">';
	html += avatar;
	html += '<div class="itc-card-name">' + esc(d.name) + '</div>';
	html += '<div class="itc-card-desg">' + esc(d.designation) + '</div>';

	// Tags
	if (d.department) {
		html += '<span class="itc-dept-tag" style="background:' + color + '20;color:' + color + '">' + esc(d.department) + '</span>';
	}
	if (d.branch) {
		html += '<span class="itc-branch-tag">' + esc(d.branch) + '</span>';
	}

	// Expand/collapse button
	if (hasKids) {
		html += '<button class="itc-expand-btn" title="' + __("Toggle") + '">\u2212</button>';
	}

	html += '</div>'; // end card

	if (hasKids) {
		html += '<ul class="itc-level">';
		for (var j = 0; j < node.children.length; j++) {
			html += itchamps_org.node_html(node.children[j]);
		}
		html += '</ul>';
	}

	html += '</li>';
	return html;
};

// ────────────────────────────────────
// HELPERS
// ────────────────────────────────────
itchamps_org.abbr = function (n) {
	if (!n) return "?";
	var p = n.split(" ");
	return p.length >= 2
		? (p[0][0] + p[p.length - 1][0]).toUpperCase()
		: n.substring(0, 2).toUpperCase();
};

function esc(s) {
	return frappe.utils.escape_html(s || "");
}
