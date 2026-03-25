/**
 * ITChamps Custom Org Chart
 * Current Codebase 2 architecture (Frappe page override) +
 * Nusrath 1 tree/hierarchy rendering (reports_to tree with depth-based palette).
 */

(function () {

// ── Inject styles ──
if (!document.getElementById("itc-styles")) {
	var s = document.createElement("style");
	s.id = "itc-styles";
	s.textContent = `
.itc-page { padding: 16px 16px 40px; margin: 0 auto; }
.itc-empty { text-align: center; padding: 60px 20px; color: #718096; }

/* ── Filter bar ── */
.itc-filter-bar {
	display: flex; gap: 10px; flex-wrap: wrap;
	margin-bottom: 16px; align-items: center;
}
.itc-filter-bar label { font-size: 11px; font-weight: 600; color: #718096; margin-bottom: 2px; display: block; }
.itc-filter-wrap { display: flex; flex-direction: column; }
.itc-select {
	height: 32px; padding: 0 28px 0 10px; border: 1px solid #d1d5db;
	border-radius: 6px; font-size: 12px; color: #374151; background: #fff;
	appearance: none; -webkit-appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E");
	background-repeat: no-repeat; background-position: right 10px center;
	cursor: pointer; min-width: 180px;
}
.itc-select:focus { outline: none; border-color: #4C6EF5; box-shadow: 0 0 0 2px rgba(76,110,245,.15); }
.itc-count { font-size: 12px; color: #718096; margin-left: auto; align-self: flex-end; padding-bottom: 4px; }

/* ── Tree ── */
.org-wrap { display: flex; justify-content: center; padding: 10px 0 30px; overflow-x: auto; }
.org-node { display: inline-flex; flex-direction: column; align-items: center; }
.itc-card {
	border-radius: 8px; padding: 12px 18px; min-width: 130px; max-width: 190px;
	text-align: center; cursor: pointer; border: 1.5px solid; box-sizing: border-box;
	transition: filter .15s;
}
.itc-card:hover { filter: brightness(.93); }
.org-card-name { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.org-card-info { font-size: 11px; line-height: 1.4; }
.org-vline { width: 1px; height: 20px; background: #ccc; flex-shrink: 0; }
.org-children { display: flex; }
.org-child-wrap {
	display: flex; flex-direction: column; align-items: center;
	padding: 20px 12px 0; position: relative;
}
.org-child-wrap::before {
	content: ''; position: absolute; top: 0; left: 0; right: 0;
	height: 1px; background: #ccc;
}
.org-child-wrap:first-child::before { left: 50%; }
.org-child-wrap:last-child::before  { right: 50%; }
.org-child-wrap:only-child::before  { display: none; }
.org-child-wrap::after {
	content: ''; position: absolute; top: 0; left: 50%;
	width: 1px; height: 20px; background: #ccc;
}
`;
	document.head.appendChild(s);
}

// ── Depth-based palette (from Nusrath 1) ──
var PALETTE = [
	{ bg: '#ede9fc', bd: '#7c3aed', tx: '#5b21b6' },
	{ bg: '#d1fae5', bd: '#059669', tx: '#065f46' },
	{ bg: '#fee2e2', bd: '#dc2626', tx: '#991b1b' },
	{ bg: '#dbeafe', bd: '#2563eb', tx: '#1e40af' },
	{ bg: '#fef3c7', bd: '#d97706', tx: '#92400e' },
	{ bg: '#fce7f3', bd: '#db2777', tx: '#9d174d' },
];

function paletteFor(depth, sibIdx) {
	if (depth === 0) return PALETTE[0];
	if (depth === 1) return PALETTE[1 + (sibIdx % (PALETTE.length - 1))];
	return PALETTE[3];
}

function esc(s) { return frappe.utils.escape_html(s || ""); }

// ────────────────────────────
// OVERRIDE: Replace HRMS page
// ────────────────────────────
var _orig_on_page_load = frappe.pages["organizational-chart"].on_page_load;
frappe.pages["organizational-chart"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Organizational Chart"),
		single_column: true,
	});
	wrapper.itc_page = page;

	$(wrapper).off("show").on("show", function () {
		itc_setup(wrapper);
	});
};

var cur_page = window.cur_page;
if (cur_page && cur_page.page && cur_page.page.label === "organizational-chart") {
	setTimeout(function () {
		var wrapper = document.querySelector('[data-page-container="organizational-chart"]')
			|| document.querySelector('.page-container[data-page="organizational-chart"]');
		if (wrapper) itc_setup(wrapper);
	}, 100);
}

// ────────────────────────────
// SETUP
// ────────────────────────────
function itc_setup(wrapper) {
	var page = wrapper.itc_page;
	if (!page) {
		page = wrapper.page || null;
		if (!page) {
			$(wrapper).find(".page-body").html('');
			page = frappe.ui.make_app_page({
				parent: wrapper,
				title: __("Organizational Chart"),
				single_column: true,
			});
			wrapper.itc_page = page;
		}
	}

	var pageHTML =
		'<div class="itc-page" id="itc-page">' +
		'<div class="itc-filter-bar" id="itc-filter-bar">' +
		'<div class="itc-filter-wrap">' +
		'<label>' + __("Department") + '</label>' +
		'<select class="itc-select" id="itc-dept-sel"><option value="">' + __("All Departments") + '</option></select>' +
		'</div>' +
		'<div class="itc-filter-wrap">' +
		'<label>' + __("Branch") + '</label>' +
		'<select class="itc-select" id="itc-branch-sel"><option value="">' + __("All Branches") + '</option></select>' +
		'</div>' +
		'<span class="itc-count" id="itc-count"></span>' +
		'</div>' +
		'<div id="itc-list"><div class="itc-empty">' + __("Loading...") + '</div></div>' +
		'</div>';

	if (!wrapper._itc_filters_done) {
		wrapper._itc_filters_done = true;

		// Company selector in toolbar
		page._co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { doLoad(page); }
		});

		$(page.body || page.main).html(pageHTML);

		// Filter change → re-render tree client-side
		$(page.body || page.main).on("change", "#itc-dept-sel, #itc-branch-sel", function () {
			renderTree();
		});
	} else {
		if (!document.getElementById("itc-page")) {
			$(page.body || page.main).html(pageHTML);
		}
	}

	doLoad(page);
}

// ────────────────────────────
// LOAD (API call)
// ────────────────────────────
var _allEmps = [];

function doLoad(page) {
	var co = page._co ? page._co.get_value() : frappe.defaults.get_default("company");
	if (!co) {
		$("#itc-list").html('<div class="itc-empty">' + __("Select a company") + '</div>');
		return;
	}

	$("#itc-list").html('<div class="itc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data",
		args: { company: co },
		callback: function (r) {
			if (!r.message) return;
			_allEmps = r.message.employees || [];

			populateDropdowns(r.message.departments || [], r.message.branches || []);
			renderTree();
		},
		error: function () {
			$("#itc-list").html('<div class="itc-empty">' + __("Error loading data") + '</div>');
		}
	});
}

// ────────────────────────────
// POPULATE DROPDOWNS
// ────────────────────────────
function populateDropdowns(depts, branches) {
	var $dept = $("#itc-dept-sel");
	var $branch = $("#itc-branch-sel");
	var selDept = $dept.val();
	var selBranch = $branch.val();

	$dept.html('<option value="">' + __("All Departments") + '</option>');
	for (var i = 0; i < depts.length; i++) {
		$dept.append('<option value="' + esc(depts[i]) + '">' + esc(depts[i]) + '</option>');
	}
	$dept.val(selDept);

	$branch.html('<option value="">' + __("All Branches") + '</option>');
	for (var j = 0; j < branches.length; j++) {
		$branch.append('<option value="' + esc(branches[j]) + '">' + esc(branches[j]) + '</option>');
	}
	$branch.val(selBranch);
}

// ────────────────────────────
// FILTER — preserves ancestor chain (from Nusrath 1)
// ────────────────────────────
function getFilteredEmps() {
	var dept   = $("#itc-dept-sel").val()   || "";
	var branch = $("#itc-branch-sel").val() || "";
	if (!dept && !branch) return _allEmps;

	var empMap = {};
	_allEmps.forEach(function (e) { empMap[e.id] = e; });

	var included = {};
	function addWithAncestors(id) {
		if (included[id]) return;
		included[id] = true;
		var e = empMap[id];
		if (e && e.reports_to && empMap[e.reports_to]) addWithAncestors(e.reports_to);
	}
	_allEmps.forEach(function (e) {
		if ((!dept || e.department === dept) && (!branch || e.branch === branch)) {
			addWithAncestors(e.id);
		}
	});
	return _allEmps.filter(function (e) { return included[e.id]; });
}

// ────────────────────────────
// RENDER TREE (from Nusrath 1)
// ────────────────────────────
function renderTree() {
	var el = document.getElementById("itc-list");
	if (!el) return;

	var emps = getFilteredEmps();

	// Update count
	$("#itc-count").text(emps.length + " " + (emps.length === 1 ? __("employee") : __("employees")));

	if (!emps || !emps.length) {
		el.innerHTML = '<div class="itc-empty">' + __("No employees found") + '</div>';
		return;
	}

	// Build tree map
	var map = {}, i, e;
	for (i = 0; i < emps.length; i++) { e = emps[i]; map[e.id] = { d: e, ch: [] }; }
	var roots = [];
	for (i = 0; i < emps.length; i++) {
		e = emps[i];
		if (e.reports_to && map[e.reports_to]) { map[e.reports_to].ch.push(map[e.id]); }
		else { roots.push(map[e.id]); }
	}

	// Sort children alphabetically
	function srt(n) {
		n.ch.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });
		for (var j = 0; j < n.ch.length; j++) srt(n.ch[j]);
	}
	for (i = 0; i < roots.length; i++) srt(roots[i]);
	roots.sort(function (a, b) { return a.d.name.localeCompare(b.d.name); });

	// Render HTML
	var html = '<div class="org-wrap">';
	for (i = 0; i < roots.length; i++) html += nodeH(roots[i], 0, i);
	html += '</div>';
	el.innerHTML = html;

	// Click → navigate to employee
	el.addEventListener("click", function (ev) {
		var card = ev.target.closest && ev.target.closest(".itc-card");
		if (card && card.dataset.id) frappe.set_route("app", "employee", card.dataset.id);
	});
}

// ────────────────────────────
// NODE HTML — recursive (from Nusrath 1)
// ────────────────────────────
function nodeH(node, depth, sibIdx) {
	var d = node.d, kids = node.ch, c = paletteFor(depth, sibIdx);
	var parts = [d.designation, d.department, d.branch].filter(function (v) { return !!v; });

	var h = '<div class="org-node">';
	h += '<div class="itc-card" data-id="' + esc(d.id) + '"'
		+ ' style="background:' + c.bg + ';border-color:' + c.bd + ';color:' + c.tx + '">';
	h += '<div class="org-card-name">' + esc(d.name) + '</div>';
	if (parts.length) h += '<div class="org-card-info">' + esc(parts.join(" \u00b7 ")) + '</div>';
	h += '</div>';

	if (kids.length > 0) {
		h += '<div class="org-vline"></div><div class="org-children">';
		for (var j = 0; j < kids.length; j++) {
			h += '<div class="org-child-wrap">' + nodeH(kids[j], depth + 1, j) + '</div>';
		}
		h += '</div>';
	}
	h += '</div>';
	return h;
}

})();
