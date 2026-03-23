/**
 * ITChamps Custom Org Chart
 * Flat list with in-page department/branch filter dropdowns.
 * This script is loaded via page_js AFTER HRMS's own page JS.
 * It overrides the "show" event to replace HRMS's org chart entirely.
 */

(function () {

// ── Inject styles ──
if (!document.getElementById("itc-styles")) {
	var s = document.createElement("style");
	s.id = "itc-styles";
	s.textContent = `
.itc-page { padding: 16px 16px 40px; max-width: 1000px; margin: 0 auto; }
.itc-empty { text-align: center; padding: 60px 20px; color: #718096; }
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
.itc-card {
	display: flex; align-items: center; gap: 10px;
	background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
	padding: 10px 14px; margin-bottom: 6px; cursor: pointer;
	position: relative; overflow: hidden;
	transition: box-shadow .12s, border-color .12s;
}
.itc-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,.08); border-color: #4C6EF5; }
.itc-bar { position:absolute; left:0; top:0; bottom:0; width:4px; }
.itc-av {
	width:38px; height:38px; border-radius:50%; flex-shrink:0;
	display:flex; align-items:center; justify-content:center;
	color:#fff; font-size:13px; font-weight:700; overflow:hidden;
}
.itc-av img { width:100%; height:100%; object-fit:cover; }
.itc-info { flex:1; min-width:0; }
.itc-name { font-size:13px; font-weight:600; color:#1a202c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.itc-desg { font-size:11px; color:#718096; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.itc-tags { display:flex; gap:4px; margin-top:3px; flex-wrap:wrap; }
.itc-tag { font-size:10px; font-weight:600; padding:2px 8px; border-radius:4px; white-space:nowrap; }
.itc-td { color:#fff; }
.itc-tb { background:#f1f3f5; color:#718096; border:1px solid #e2e8f0; }
[data-theme=dark] .itc-card { background:#1a1a2e; border-color:#2d2d44; }
[data-theme=dark] .itc-card:hover { box-shadow:0 3px 10px rgba(0,0,0,.3); }
[data-theme=dark] .itc-name { color:#e2e8f0; }
[data-theme=dark] .itc-select { background-color:#1a1a2e; color:#e2e8f0; border-color:#2d2d44; }
[data-theme=dark] .itc-tb { background:rgba(255,255,255,.08); }
`;
	document.head.appendChild(s);
}

// ── Colors ──
var PAL = ["#4C6EF5","#E8590C","#0CA678","#E64980","#7950F2","#1098AD","#D6336C","#5C940D","#1C7ED6","#AE3EC9","#2B8A3E","#F59F00","#C92A2A","#087F5B","#845EF7"];
var cm = {}, ci = 0;
function dcol(d) {
	if (!d) return "#868E96";
	if (!cm[d]) cm[d] = PAL[ci++ % PAL.length];
	return cm[d];
}
function esc(s) { return frappe.utils.escape_html(s || ""); }
function abr(n) {
	if (!n) return "?";
	var p = n.split(" ");
	return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : n.substring(0,2).toUpperCase();
}

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

	if (!wrapper._itc_filters_done) {
		wrapper._itc_filters_done = true;

		// Keep company in toolbar (needs Frappe Link autocomplete)
		page._co = page.add_field({
			fieldname: "company", label: __("Company"), fieldtype: "Link",
			options: "Company", default: frappe.defaults.get_default("company"), reqd: 1,
			change: function () { doLoad(page); }
		});

		// Render page shell with in-body filter bar
		$(page.body || page.main).html(
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
			'</div>'
		);

		// Filter change → client-side re-render (no extra API call)
		$(page.body || page.main).on("change", "#itc-dept-sel, #itc-branch-sel", function () {
			applyFilters();
		});
	} else {
		if (!document.getElementById("itc-page")) {
			$(page.body || page.main).html(
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
				'</div>'
			);
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

	cm = {}; ci = 0;
	$("#itc-list").html('<div class="itc-empty">' + __("Loading...") + '</div>');

	frappe.call({
		method: "itchamps_custom_org_layout.api.org_chart.get_org_chart_data", // ← changed
		args: { company: co },
		callback: function (r) {
			if (!r.message) return;
			_allEmps = r.message.employees || [];
			_allEmps.sort(function (a, b) { return a.name.localeCompare(b.name); });

			populateDropdowns(r.message.departments || [], r.message.branches || []);
			applyFilters();
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
// APPLY FILTERS (client-side)
// ────────────────────────────
function applyFilters() {
	var dept = $("#itc-dept-sel").val() || "";
	var branch = $("#itc-branch-sel").val() || "";

	var filtered = _allEmps.filter(function (e) {
		return (!dept || e.department === dept) && (!branch || e.branch === branch);
	});

	var count = filtered.length;
	$("#itc-count").text(count + " " + (count === 1 ? __("employee") : __("employees")));

	if (!filtered.length) {
		$("#itc-list").html('<div class="itc-empty">' + __("No employees found") + '</div>');
		return;
	}

	var html = '';
	for (var i = 0; i < filtered.length; i++) html += cardH(filtered[i]);
	$("#itc-list").html(html);

	$("#itc-list").off("click", ".itc-card").on("click", ".itc-card", function () {
		var id = $(this).data("id");
		if (id) frappe.set_route("app", "employee", id);
	});
}

// ────────────────────────────
// CARD HTML
// ────────────────────────────
function cardH(d) {
	var col = dcol(d.department);
	var av;
	if (d.image) {
		av = '<div class="itc-av"><img src="' + d.image + '"></div>';
	} else {
		av = '<div class="itc-av" style="background:' + col + '">' + abr(d.name) + '</div>';
	}
	var tags = '<div class="itc-tags">';
	if (d.department) tags += '<span class="itc-tag itc-td" style="background:' + col + '">' + esc(d.department) + '</span>';
	if (d.branch) tags += '<span class="itc-tag itc-tb">' + esc(d.branch) + '</span>';
	tags += '</div>';

	var h = '<div class="itc-card" data-id="' + d.id + '">';
	h += '<div class="itc-bar" style="background:' + col + '"></div>';
	h += av;
	h += '<div class="itc-info"><div class="itc-name">' + esc(d.name) + '</div>';
	h += '<div class="itc-desg">' + esc(d.designation) + '</div>' + tags + '</div>';
	h += '</div>';
	return h;
}

})();
