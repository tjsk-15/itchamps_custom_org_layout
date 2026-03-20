/**
 * ITChamps Custom Org Chart
 * Top-down tree. Each employee = card. Lines connect manager to reportees.
 * Filters: Department dropdown, Branch dropdown. No search field.
 * ALL STYLES INJECTED INLINE to avoid Frappe asset caching issues.
 */

(function () {

// ── Inject styles once ──
if (!document.getElementById("itc-org-styles")) {
	var styleEl = document.createElement("style");
	styleEl.id = "itc-org-styles";
	styleEl.textContent = [
		// Wrapper
		".itc-wrap { padding: 10px 0 40px; }",
		".itc-scroll { overflow-x: auto; padding: 20px; }",
		".itc-empty { text-align:center; padding:80px 20px; color:#718096; font-size:14px; }",

		// Reset tree lists
		".itc-tree, .itc-tree ul { list-style:none; margin:0; padding:0; }",

		// Tree layout
		".itc-tree { display:flex; justify-content:center; }",
		".itc-tree ul { display:flex; justify-content:center; padding-top:20px; position:relative; }",

		// Vertical line from parent down to children rail
		".itc-tree ul::before { content:''; position:absolute; top:0; left:50%; width:2px; height:20px; background:#cbd5e0; }",

		// Each node
		".itc-tree li { display:flex; flex-direction:column; align-items:center; position:relative; padding:20px 10px 0; }",

		// Vertical line up from child to rail
		".itc-tree li::before { content:''; position:absolute; top:0; left:50%; width:2px; height:20px; background:#cbd5e0; }",

		// Horizontal rail connecting siblings
		".itc-tree li::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:#cbd5e0; }",

		// First child: rail only right half
		".itc-tree li:first-child::after { left:50%; }",
		// Last child: rail only left half
		".itc-tree li:last-child::after { right:50%; }",
		// Only child: no rail
		".itc-tree li:only-child::after { display:none; }",

		// Root nodes: no connectors above
		".itc-tree > li::before { display:none; }",
		".itc-tree > li::after { display:none; }",
		// Root-level ul: no connector above
		".itc-tree > li > ul::before { content:''; position:absolute; top:0; left:50%; width:2px; height:20px; background:#cbd5e0; }",

		// ── Card ──
		".itc-card { width:170px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 10px 10px; text-align:center; cursor:pointer; position:relative; box-shadow:0 1px 3px rgba(0,0,0,.06); transition: box-shadow .15s, transform .15s; }",
		".itc-card:hover { box-shadow:0 4px 14px rgba(0,0,0,.1); transform:translateY(-2px); }",

		// Accent top border
		".itc-card-accent { position:absolute; top:0; left:0; right:0; height:3px; border-radius:8px 8px 0 0; }",

		// Avatar
		".itc-av { width:44px; height:44px; border-radius:50%; margin:0 auto 6px; overflow:hidden; display:flex; align-items:center; justify-content:center; color:#fff; font-size:15px; font-weight:700; }",
		".itc-av img { width:100%; height:100%; object-fit:cover; }",

		// Text
		".itc-cname { font-size:11px; font-weight:700; color:#1a202c; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",
		".itc-cdesg { font-size:10px; color:#718096; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }",

		// Tags
		".itc-tag { display:inline-block; font-size:8px; font-weight:600; padding:1px 5px; border-radius:3px; margin:1px; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle; }",
		".itc-tag-d { border:1px solid; }",
		".itc-tag-b { background:#f1f3f5; color:#718096; }",

		// Expand/collapse button
		".itc-toggle { display:block; margin:6px auto 0; width:22px; height:22px; border-radius:50%; border:1px solid #cbd5e0; background:#fff; color:#718096; font-size:13px; line-height:20px; text-align:center; cursor:pointer; padding:0; }",
		".itc-toggle:hover { background:#f7fafc; }",

		// Collapsed: hide children
		".itc-tree li.collapsed > ul { display:none; }",

		// Dark mode
		"[data-theme=dark] .itc-card { background:#1a1a2e; border-color:#2d2d44; }",
		"[data-theme=dark] .itc-cname { color:#e2e8f0; }",
		"[data-theme=dark] .itc-toggle { background:#1a1a2e; border-color:#2d2d44; }",
		"[data-theme=dark] .itc-tree li::before, [data-theme=dark] .itc-tree li::after, [data-theme=dark] .itc-tree ul::before { background:#2d2d44; }",
		"[data-theme=dark] .itc-tag-b { background:rgba(255,255,255,.08); }",

		// Responsive
		"@media (max-width:768px) { .itc-card { width:130px; padding:8px 6px; } .itc-av { width:34px; height:34px; font-size:12px; } .itc-cname { font-size:10px; } .itc-tree li { padding:16px 4px 0; } }",
	].join("\n");
	document.head.appendChild(styleEl);
}

// ── Colors ──
var COLORS = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"];
var cmap = {}, cidx = 0;
function dcolor(d) {
	if (!d) return "#868E96";
	if (!cmap[d]) { cmap[d] = COLORS[cidx++ % COLORS.length]; }
	return cmap[d];
}

function esc(s) { return frappe.utils.escape_html(s || ""); }
function abbr(n) {
	if (!n) return "?";
	var p = n.split(" ");
	return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : n.substring(0,2).toUpperCase();
}

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

	// Company
	page._company = page.add_field({
		fieldname: "company", label: __("Company"), fieldtype: "Link",
		options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
		change: function () {
			if (page._dept) page._dept.set_value(__("All Departments"));
			if (page._branch) page._branch.set_value(__("All Branches"));
			load(page);
		},
	});

	// Department
	page._dept = page.add_field({
		fieldname: "department", label: __("Department"), fieldtype: "Select",
		options: __("All Departments"), default: __("All Departments"),
		change: function () { load(page); },
	});

	// Branch
	page._branch = page.add_field({
		fieldname: "branch", label: __("Branch"), fieldtype: "Select",
		options: __("All Branches"), default: __("All Branches"),
		change: function () { load(page); },
	});

	$(page.body).html('<div class="itc-wrap"><div class="itc-scroll"><div class="itc-empty">' + __("Loading...") + '</div></div></div>');

	load(page);
};

frappe.pages["organizational-chart"].on_page_show = function (wrapper) {
	if (wrapper.org_chart_page) load(wrapper.org_chart_page);
};

// ────────────────────────────────────
// LOAD
// ────────────────────────────────────
function load(page) {
	var company = page._company ? page._company.get_value() : frappe.defaults.get_default("company");
	if (!company) {
		$(".itc-scroll").html('<div class="itc-empty">' + __("Select a company") + '</div>');
		return;
	}

	var dept = (page._dept ? page._dept.get_value() : "") || "";
	var branch = (page._branch ? page._branch.get_value() : "") || "";
	if (dept === __("All Departments")) dept = "";
	if (branch === __("All Branches")) branch = "";

	cmap = {}; cidx = 0;
	$(".itc-scroll").html('<div class="itc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: { company: company, department: dept, branch: branch },
		callback: function (r) {
			if (!r.message) return;
			var d = r.message;

			// Update filter options
			if (d.departments && page._dept) {
				page._dept.df.options = [__("All Departments")].concat(d.departments).join("\n");
				page._dept.refresh();
			}
			if (d.branches && page._branch) {
				page._branch.df.options = [__("All Branches")].concat(d.branches).join("\n");
				page._branch.refresh();
			}

			render(d.employees);
		},
		error: function () {
			$(".itc-scroll").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		},
	});
}

// ────────────────────────────────────
// RENDER TREE
// ────────────────────────────────────
function render(employees) {
	if (!employees || !employees.length) {
		$(".itc-scroll").html('<div class="itc-empty">' + __("No employees found") + '</div>');
		return;
	}

	// Build lookup
	var map = {};
	var i, e;
	for (i = 0; i < employees.length; i++) {
		e = employees[i];
		map[e.id] = { d: e, ch: [] };
	}

	// Parent-child
	var roots = [];
	for (i = 0; i < employees.length; i++) {
		e = employees[i];
		if (e.reports_to && map[e.reports_to]) {
			map[e.reports_to].ch.push(map[e.id]);
		} else {
			roots.push(map[e.id]);
		}
	}

	// Sort
	function sortN(node) {
		node.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
		for (var j = 0; j < node.ch.length; j++) sortN(node.ch[j]);
	}
	for (i = 0; i < roots.length; i++) sortN(roots[i]);

	// Build HTML
	var html = '<ul class="itc-tree">';
	for (i = 0; i < roots.length; i++) {
		html += nodeHTML(roots[i]);
	}
	html += '</ul>';

	$(".itc-scroll").html(html);

	// Events
	$(".itc-scroll").off("click", ".itc-card").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});

	$(".itc-scroll").off("click", ".itc-toggle").on("click", ".itc-toggle", function (ev) {
		ev.stopPropagation();
		var $li = $(this).closest("li");
		var cnt = $li.data("cnt") || 0;
		$li.toggleClass("collapsed");
		$(this).text($li.hasClass("collapsed") ? "+" + cnt : "\u2212");
	});
}

function nodeHTML(node) {
	var d = node.d;
	var col = dcolor(d.department);
	var hasKids = node.ch.length > 0;

	var av;
	if (d.image) {
		av = '<div class="itc-av"><img src="' + d.image + '"></div>';
	} else {
		av = '<div class="itc-av" style="background:' + col + '">' + abbr(d.name) + '</div>';
	}

	var tags = '';
	if (d.department) {
		tags += '<span class="itc-tag itc-tag-d" style="color:' + col + ';border-color:' + col + '">' + esc(d.department) + '</span>';
	}
	if (d.branch) {
		tags += '<span class="itc-tag itc-tag-b">' + esc(d.branch) + '</span>';
	}

	var toggle = '';
	if (hasKids) {
		toggle = '<button class="itc-toggle">\u2212</button>';
	}

	var h = '<li data-cnt="' + node.ch.length + '">';
	h += '<div class="itc-card" data-id="' + d.id + '">';
	h += '<div class="itc-card-accent" style="background:' + col + '"></div>';
	h += av;
	h += '<div class="itc-cname">' + esc(d.name) + '</div>';
	h += '<div class="itc-cdesg">' + esc(d.designation) + '</div>';
	h += tags;
	h += toggle;
	h += '</div>';

	if (hasKids) {
		h += '<ul>';
		for (var j = 0; j < node.ch.length; j++) {
			h += nodeHTML(node.ch[j]);
		}
		h += '</ul>';
	}

	h += '</li>';
	return h;
}

})();
