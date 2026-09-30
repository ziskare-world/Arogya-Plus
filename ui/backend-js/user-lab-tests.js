import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("lab-tests.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Diagnostic Lab & Pathology");

let allTests = [];
let myBookings = [];
let currentCategory = "All";
let searchQuery = "";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
};

const toStatusBadge = (status = "scheduled") => {
  const s = String(status).toLowerCase();
  if (s === "completed") return '<span class="badge badge-green">Completed</span>';
  if (s === "processing") return '<span class="badge badge-yellow">Analyzing</span>';
  if (s === "sample_collected") return '<span class="badge badge-blue">Sample Collected</span>';
  if (s === "cancelled") return '<span class="badge badge-red">Cancelled</span>';
  return '<span class="badge badge-cyan">Scheduled</span>';
};

const renderCatalog = () => {
  const gridEl = document.getElementById("test-cards-grid");
  if (!gridEl) return;

  const filtered = allTests.filter((test) => {
    const matchesCat = currentCategory === "All" || test.category === currentCategory;
    const matchesQuery =
      !searchQuery ||
      `${test.name} ${test.code} ${test.description} ${test.category}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  if (!filtered.length) {
    gridEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-400);grid-column:1 / -1;">No tests found matching "${escapeHtml(searchQuery || currentCategory)}".</div>`;
    return;
  }

  gridEl.innerHTML = filtered
    .map(
      (test) => `
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;padding:18px;border:1px solid var(--border-color, #334155);transition:transform .2s ease,box-shadow .2s ease;" onmouseenter="this.style.transform='translateY(-3px)'" onmouseleave="this.style.transform='none'">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <span class="badge badge-blue">${escapeHtml(test.category)}</span>
            <code style="font-size:0.75rem;color:var(--text-400);">${escapeHtml(test.code)}</code>
          </div>
          <h4 style="margin:0 0 6px;font-size:1.1rem;font-weight:700;">${escapeHtml(test.name)}</h4>
          <p style="font-size:0.85rem;color:var(--text-400);margin:0 0 14px;line-height:1.4;">${escapeHtml(test.description || "Comprehensive clinical diagnostic evaluation.")}</p>

          <div style="background:var(--bg-panel, #0f172a);padding:10px 12px;border-radius:6px;font-size:0.8rem;margin-bottom:14px;">
            <div style="margin-bottom:4px;">⏱️ <strong>Turnaround:</strong> ${test.turnaroundHours || 24} hours</div>
            <div>🩸 <strong>Specimen:</strong> ${escapeHtml(test.sampleRequired || "Blood Specimen")}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border-color, #334155);padding-top:12px;">
          <div>
            <div style="font-size:0.75rem;color:var(--text-400);text-transform:uppercase;">Price</div>
            <div style="font-size:1.25rem;font-weight:800;color:var(--green, #22c55e);">₹${test.price}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openBookModal('${test._id}')">Book Test</button>
        </div>
      </div>
    `
    )
    .join("");
};

const renderMyBookings = () => {
  const tbodyEl = document.getElementById("my-bookings-tbody");
  const countEl = document.getElementById("my-bookings-count");
  if (countEl) countEl.textContent = String(myBookings.length);
  if (!tbodyEl) return;

  if (!myBookings.length) {
    tbodyEl.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-400);padding:30px;">
          You have no lab bookings yet. <a href="javascript:void(0)" onclick="switchTab('catalog')" style="color:var(--blue);text-decoration:underline;">Browse available tests</a> to schedule one.
        </td>
      </tr>`;
    return;
  }

  tbodyEl.innerHTML = myBookings
    .map(
      (b) => `
      <tr>
        <td><code>LAB-${b._id.toString().slice(-6).toUpperCase()}</code></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(b.testName)}</div>
          <div style="font-size:0.75rem;color:var(--text-400);">${escapeHtml(b.hospitalName || "Central Lab")}</div>
        </td>
        <td><span class="badge badge-blue">${escapeHtml(b.category || "General")}</span></td>
        <td>
          <div>${formatDate(b.bookingDate)}</div>
          <div style="font-size:0.75rem;color:var(--text-400);">${escapeHtml(b.slotTime)}</div>
        </td>
        <td>${b.collectionType === "home_collection" ? "🏠 Home Collection" : "🏥 Clinic Visit"}</td>
        <td>${toStatusBadge(b.status)}</td>
        <td>
          <a href="/api/lab-tests/bookings/${b._id}/report" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:4px;">
            📄 View Report
          </a>
        </td>
      </tr>
    `
    )
    .join("");
};

window.switchTab = (tab) => {
  const catalogContent = document.getElementById("tab-catalog-content");
  const myContent = document.getElementById("tab-my-content");
  const catalogBtn = document.getElementById("tab-btn-catalog");
  const myBtn = document.getElementById("tab-btn-my");

  if (tab === "catalog") {
    if (catalogContent) catalogContent.style.display = "block";
    if (myContent) myContent.style.display = "none";
    if (catalogBtn) {
      catalogBtn.className = "btn btn-primary";
    }
    if (myBtn) {
      myBtn.className = "btn btn-outline";
    }
  } else {
    if (catalogContent) catalogContent.style.display = "none";
    if (myContent) myContent.style.display = "block";
    if (catalogBtn) {
      catalogBtn.className = "btn btn-outline";
    }
    if (myBtn) {
      myBtn.className = "btn btn-primary";
    }
    loadMyBookings();
  }
};

window.filterCategory = (cat, btnEl) => {
  currentCategory = cat;
  const pills = document.querySelectorAll(".cat-pill");
  pills.forEach((p) => {
    p.className = "btn btn-sm btn-ghost cat-pill";
  });
  if (btnEl) btnEl.className = "btn btn-sm btn-primary cat-pill";
  renderCatalog();
};

window.onSearchTest = (val) => {
  searchQuery = val.trim();
  renderCatalog();
};

window.openBookModal = (testId) => {
  const test = allTests.find((t) => String(t._id) === String(testId));
  if (!test) return;

  const modal = document.getElementById("book-test-modal");
  if (!modal) return;

  document.getElementById("modal-test-id").value = test._id;
  document.getElementById("modal-test-name").textContent = test.name;
  document.getElementById("modal-test-details").textContent = `Price: ₹${test.price} • Category: ${test.category} • Specimen: ${test.sampleRequired || "Blood"}`;

  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("book-date");
  if (dateInput) {
    dateInput.min = today;
    dateInput.value = today;
  }

  modal.style.display = "flex";
};

window.closeBookModal = () => {
  const modal = document.getElementById("book-test-modal");
  if (modal) modal.style.display = "none";
  const form = document.getElementById("book-test-form");
  if (form) form.reset();
};

window.toggleAddressField = (val) => {
  const addrRow = document.getElementById("home-address-row");
  if (addrRow) {
    addrRow.style.display = val === "home_collection" ? "block" : "none";
  }
};

window.submitBookTest = async (e) => {
  e.preventDefault();
  const testId = document.getElementById("modal-test-id")?.value;
  const bookingDate = document.getElementById("book-date")?.value;
  const slotTime = document.getElementById("book-slot")?.value;
  const collectionType = document.getElementById("book-collection")?.value;
  const sampleAddress = document.getElementById("book-address")?.value.trim();
  const notes = document.getElementById("book-notes")?.value.trim();

  const submitBtn = document.getElementById("btn-submit-booking");
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await apiRequest("/api/lab-tests/book", {
      method: "POST",
      body: JSON.stringify({ testId, bookingDate, slotTime, collectionType, sampleAddress, notes })
    });

    toast("Diagnostic test successfully booked!", "success");
    closeBookModal();
    if (res.booking) {
      myBookings.unshift(res.booking);
    }
    switchTab("my");
  } catch (err) {
    toast(err.message || "Failed to book diagnostic test", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

const loadCatalog = async () => {
  try {
    const res = await apiRequest("/api/lab-tests");
    allTests = res.tests || [];
    renderCatalog();
  } catch (err) {
    toast("Failed to load diagnostic catalog", "error");
  }
};

const loadMyBookings = async () => {
  try {
    const res = await apiRequest("/api/lab-tests/my-bookings");
    myBookings = res.bookings || [];
    renderMyBookings();
  } catch (err) {
    toast("Failed to load your lab reports", "error");
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["patient", "admin", "super-admin"],
    onDenied: () => toast("Please login as patient", "error")
  });
  if (!session.allowed) return;

  await Promise.all([loadCatalog(), loadMyBookings()]);
};

init();
