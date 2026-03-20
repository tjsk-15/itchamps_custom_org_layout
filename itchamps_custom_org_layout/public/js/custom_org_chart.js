/**
 * ITChamps Custom Org Layout
 *
 * Layout: Manager-centric groups
 *   Each manager shown as a header card, direct reports as a grid below.
 *   Employees without a manager collected in an "Unassigned" group.
 *   Department and Branch shown as small tags on every card.
 *
 * Toolbar filters: Department, Branch (+ Company selector).
 */

frappe.provide("itchamps_org_chart");

// ── Colors keyed by department ──
itchamps_org_chart.PALETTE = [
	"#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2",
	"#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9",
	"#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7",
	"#FF922B","#20C997","#FA5252","#3B5BDB","#F76707"
];
itchamps_org_chart._cmap = {};
itchamps_org_chart._cidx = 0;
itchamps_org_chart.dept_color = function (d) {
	if (!d) return "#868E96";
	if (!itchamps_org_chart._cmap[d]) {
		itchamps_org_chart._cmap[d] =
			itchamps_org_chart.PALETTE[itchamps_org_chart._cidx++ % itchamps_org_chart.PALETTE.length];
	}
	return itchamps_org_chart._cmap[d];
};

// ────────────────────────────────────────
// PAGE INIT
// ────────────────────────────────────────
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});
	wrapper.org_chart_page = page;

	itchamps_org_chart.add_toolbar(page);

	$(page.body).html(`
		<div class="itc-dash">
			<div class="itc-stats" id="itc-stats"></div>
			<div class="itc-search-wrap">
				<input type="text" class="form-control itc-search"
					id="itc-search" placeholder="${__("Search by name, designation, department...")}">
			</div>
			<div class="itc-chart" id="itc-chart">
				<div class="itc-loader">${__("Loading...")}</div>
			</div>
		</div>
	`);

	$("#itc-search").on("input", frappe.utils.debounce(function () {
		itchamps_org_chart.search($(this).val());
	}, 250));

	itchamps_org_chart.load(page);
};

frappe.pages["organizational-chart"].on_page_show = function (wrapper) {
	if (wrapper.org_chart_page) itchamps_org_chart.load(wrapper.org_chart_page);
};

// ────────────────────────────────────────
// TOOLBAR
// ────────────────────────────────────────
itchamps_org_chart.add_toolbar = function (page) {
	page._f_company = page.add_field({
		fieldname: "company", label: __("Company"), fieldtype: "Link",
		options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
		change() {
			itchamps_org_chart._reset_filters(page);
			itchamps_org_chart.load(page);
		},
	});
	page._f_dept = page.add_field({
		fieldname: "department", label: __("Department"), fieldtype: "Select",
		options: __("All Departments"), default: __("All Departments"),
		change() { itchamps_org_chart.load(page); },
	});
	page._f_branch = page.add_field({
		fieldname: "branch", label: __("Branch"), fieldtype: "Select",
		options: __("All Branches"), default: __("All Branches"),
		change() { itchamps_org_chart.load(page); },
	});
};

itchamps_org_chart._reset_filters = function (page) {
	page._f_dept?.set_value(__("All Departments"));
	page._f_branch?.set_value(__("All Branches"));
};

itchamps_org_chart._sync_filter_options = function (page, f) {
	if (!f) return;
	if (f.departments) {
		page._f_dept.df.options = [__("All Departments")].concat(f.departments).join("\n");
		page._f_dept.refresh();
	}
	if (f.branches) {
		page._f_branch.df.options = [__("All Branches")].concat(f.branches).join("\n");
		page._f_branch.refresh();
	}
};

// ────────────────────────────────────────
// DATA LOAD
// ────────────────────────────────────────
itchamps_org_chart.load = function (page) {
	const company = page._f_company?.get_value() || frappe.defaults.get_default("company");
	if (!company) {
		$("#itc-chart").html(`<div class="itc-empty">${__("Please select a company")}</div>`);
		return;
	}

	let dept = page._f_dept?.get_value() || "";
	let branch = page._f_branch?.get_value() || "";
	if (dept === __("All Departments")) dept = "";
	if (branch === __("All Branches")) branch = "";

	itchamps_org_chart._cmap = {};
	itchamps_org_chart._cidx = 0;

	$("#itc-chart").html(`<div class="itc-loader">${__("Loading...")}</div>`);

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: { company, department: dept, branch },
		callback(r) {
			if (!r.message) return;
			itchamps_org_chart._sync_filter_options(page, r.message.filters);
			itchamps_org_chart.paint(r.message);
		},
		error() {
			$("#itc-chart").html(`<div class="itc-empty">${__("Error loading data")}</div>`);
		},
	});
};

// ────────────────────────────────────────
// RENDER
// ────────────────────────────────────────
itchamps_org_chart.paint = function (data) {
	const { groups, stats } = data;

	// Stats
	itchamps_org_chart.paint_stats(stats);

	if (!groups || groups.length === 0) {
		$("#itc-chart").html(`<div class="itc-empty">${__("No employees found")}</div>`);
		return;
	}

	let h = "";
	groups.forEach(function (g) {
		if (g.type === "manager" && g.manager) {
			h += itchamps_org_chart.html_manager_group(g.manager, g.reports);
		} else {
			h += itchamps_org_chart.html_unmanaged_group(g.reports);
		}
	});

	$("#itc-chart").html(h);

	// ── Events ──
	$(".itc-mgr-header").on("click", function () {
		$(this).closest(".itc-mgr-group").toggleClass("itc-closed");
	});
	$(".itc-card").on("click", function (e) {
		if ($(e.target).closest(".itc-mgr-toggle").length) return;
		const id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});
};

itchamps_org_chart.paint_stats = function (s) {
	if (!s) { $("#itc-stats").html(""); return; }
	let h = "";
	for (const [k, v] of Object.entries(s)) {
		h += `<div class="itc-stat"><span class="itc-stat-num">${v}</span><span class="itc-stat-lbl">${__(k)}</span></div>`;
	}
	$("#itc-stats").html(h);
};

// ── Manager group ──
itchamps_org_chart.html_manager_group = function (mgr, reports) {
	const color = itchamps_org_chart.dept_color(mgr.department);
	const count = reports.length;

	let h = `<div class="itc-mgr-group" data-dept="${frappe.utils.escape_html(mgr.department)}">`;

	// Manager header row
	h += `<div class="itc-mgr-header" style="--dept-color:${color}">
		<div class="itc-mgr-toggle">&#9662;</div>
		${itchamps_org_chart.html_avatar(mgr, color, true)}
		<div class="itc-mgr-info">
			<a class="itc-mgr-name" data-id="${mgr.id}">${esc(mgr.name)}</a>
			<span class="itc-mgr-desg">${esc(mgr.designation)}</span>
		</div>
		<div class="itc-mgr-tags">
			${itchamps_org_chart.html_dept_tag(mgr.department, color)}
			${mgr.branch ? `<span class="itc-tag itc-tag-branch">${esc(mgr.branch)}</span>` : ""}
		</div>
		<span class="itc-mgr-count">${count} ${count === 1 ? __("report") : __("reports")}</span>
	</div>`;

	// Reports grid
	h += `<div class="itc-report-grid">`;
	reports.forEach(function (emp) {
		h += itchamps_org_chart.html_emp_card(emp);
	});
	h += `</div></div>`;
	return h;
};

// ── Unmanaged group ──
itchamps_org_chart.html_unmanaged_group = function (reports) {
	let h = `<div class="itc-mgr-group itc-unmanaged-group">`;
	h += `<div class="itc-mgr-header itc-unmanaged-header">
		<div class="itc-mgr-toggle">&#9662;</div>
		<div class="itc-mgr-info">
			<span class="itc-mgr-name itc-muted">${__("No Reporting Manager")}</span>
		</div>
		<span class="itc-mgr-count">${reports.length} ${__("employees")}</span>
	</div>`;
	h += `<div class="itc-report-grid">`;
	reports.forEach(function (emp) {
		h += itchamps_org_chart.html_emp_card(emp);
	});
	h += `</div></div>`;
	return h;
};

// ── Single employee card ──
itchamps_org_chart.html_emp_card = function (emp) {
	const color = itchamps_org_chart.dept_color(emp.department);
	return `<div class="itc-card" data-id="${emp.id}" style="--dept-color:${color}">
		${itchamps_org_chart.html_avatar(emp, color, false)}
		<div class="itc-card-body">
			<div class="itc-card-name">${esc(emp.name)}</div>
			<div class="itc-card-desg">${esc(emp.designation)}</div>
			<div class="itc-card-tags">
				${itchamps_org_chart.html_dept_tag(emp.department, color)}
				${emp.branch ? `<span class="itc-tag itc-tag-branch">${esc(emp.branch)}</span>` : ""}
			</div>
		</div>
	</div>`;
};

// ── Avatar helper ──
itchamps_org_chart.html_avatar = function (emp, color, big) {
	const cls = big ? "itc-avatar itc-avatar-lg" : "itc-avatar";
	if (emp.image) {
		return `<div class="${cls}"><img src="${emp.image}" alt="${esc(emp.name)}"></div>`;
	}
	const abbr = itchamps_org_chart.abbr(emp.name);
	return `<div class="${cls}" style="background:${color}"><span>${abbr}</span></div>`;
};

// ── Department tag ──
itchamps_org_chart.html_dept_tag = function (dept, color) {
	if (!dept) return "";
	return `<span class="itc-tag itc-tag-dept" style="--tag-color:${color}">${esc(dept)}</span>`;
};

// ────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────
itchamps_org_chart.search = function (q) {
	q = (q || "").toLowerCase().trim();
	if (!q) {
		$(".itc-mgr-group").show().removeClass("itc-closed");
		$(".itc-card").show();
		return;
	}

	$(".itc-mgr-group").each(function () {
		const $g = $(this);
		const header_match = $g.find(".itc-mgr-header").text().toLowerCase().includes(q);

		// Filter individual cards
		let visible_cards = 0;
		$g.find(".itc-card").each(function () {
			const match = $(this).text().toLowerCase().includes(q);
			$(this).toggle(match);
			if (match) visible_cards++;
		});

		$g.toggle(header_match || visible_cards > 0);
		if (header_match || visible_cards > 0) {
			$g.removeClass("itc-closed");
		}
	});
};

// ────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────
itchamps_org_chart.abbr = function (n) {
	if (!n) return "?";
	const p = n.split(" ");
	return p.length >= 2
		? (p[0][0] + p[p.length - 1][0]).toUpperCase()
		: n.substring(0, 2).toUpperCase();
};

function esc(s) { return frappe.utils.escape_html(s || ""); }
