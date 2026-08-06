/* =========================================
   sidebar.js - injects shared sidebar HTML
   ========================================= */

const iconSvg = (name, className = "icon-svg") => {
  const base =
    `class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

  const icons = {
    hospital: `<svg ${base}><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M12 7v6"></path><path d="M9 10h6"></path><path d="M10 21v-4h4v4"></path></svg>`,
    chart: `<svg ${base}><path d="M4 20h16"></path><path d="M7 16v-4"></path><path d="M12 16V8"></path><path d="M17 16v-7"></path></svg>`,
    users: `<svg ${base}><path d="M16 19a4 4 0 0 0-8 0"></path><circle cx="12" cy="10" r="3"></circle><path d="M20 19a3 3 0 0 0-3-3"></path><path d="M4 19a3 3 0 0 1 3-3"></path></svg>`,
    logs: `<svg ${base}><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path></svg>`,
    dashboard: `<svg ${base}><rect x="4" y="4" width="7" height="7" rx="1"></rect><rect x="13" y="4" width="7" height="5" rx="1"></rect><rect x="13" y="11" width="7" height="9" rx="1"></rect><rect x="4" y="13" width="7" height="7" rx="1"></rect></svg>`,
    calendar: `<svg ${base}><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M3 10h18"></path></svg>`,
    doctor: `<svg ${base}><circle cx="12" cy="8" r="3"></circle><path d="M6 20a6 6 0 0 1 12 0"></path><path d="M18 6v4"></path><path d="M16 8h4"></path></svg>`,
    alert: `<svg ${base}><path d="M12 4 3 20h18z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path></svg>`,
    card: `<svg ${base}><rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M3 10h18"></path><path d="M7 14h4"></path></svg>`,
    report: `<svg ${base}><path d="M4 20h16"></path><path d="M7 20v-6"></path><path d="M12 20v-9"></path><path d="M17 20v-4"></path></svg>`,
    clock: `<svg ${base}><circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path></svg>`,
    prescription: `<svg ${base}><rect x="6" y="3" width="12" height="18" rx="2"></rect><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>`,
    home: `<svg ${base}><path d="M4 11 12 4l8 7"></path><path d="M6 10v10h12V10"></path></svg>`,
    search: `<svg ${base}><circle cx="11" cy="11" r="6"></circle><path d="m20 20-4.5-4.5"></path></svg>`,
    ambulance: `<svg ${base}><rect x="3" y="8" width="14" height="8" rx="1"></rect><path d="M17 10h2l2 2v4h-4"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle><path d="M10 9v4"></path><path d="M8 11h4"></path></svg>`,
    folder: `<svg ${base}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    records: `<svg ${base}><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path></svg>`,
    billing: `<svg ${base}><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16"></path><path d="M8 15h4"></path></svg>`,
    shield: `<svg ${base}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    profile: `<svg ${base}><circle cx="12" cy="8" r="3"></circle><path d="M6 20a6 6 0 0 1 12 0"></path></svg>`,
    logout: `<svg ${base}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>`
  };

  return icons[name] || icons.chart;
};

export function injectSidebar(activePage) {
  const existingSidebar = document.getElementById("sidebar");
  if (existingSidebar) {
    existingSidebar.remove();
  }

  const isInSubfolder =
    location.pathname.includes("/admin/") ||
    location.pathname.includes("/doctor/") ||
    location.pathname.includes("/user/") ||
    location.pathname.includes("/super-admin/") ||
    location.pathname.includes("/super_admin/") ||
    location.pathname.toLowerCase().includes("super");
  const prefix = isInSubfolder ? "../" : "";

  let nav = [];
  const path = location.pathname.toLowerCase();
  const user = getStoredUser();

  if (
    path.includes("super") ||
    path.includes("super_admin") ||
    path.includes("super-admin") ||
    (user && user.role && String(user.role).toLowerCase().includes("super"))
  ) {
    nav = [
      { href: "dashboard.html", icon: "chart", label: "Overview" },
      { href: "hospital-info.html", icon: "hospital", label: "Hospital Info & Beds" },
      { href: "admins.html", icon: "users", label: "Hospitals" },
      { href: "storage.html", icon: "folder", label: "Storage Drive" },
      { href: "mfa-setup.html", icon: "shield", label: "Passkey MFA" },
      { href: "appointments.html", icon: "calendar", label: "Appointments" },
      { href: "doctors.html", icon: "doctor", label: "Doctors" },
      { href: "patients.html", icon: "users", label: "Patients" },
      { href: "emergency.html", icon: "alert", label: "Emergency" },
      { href: "payments.html", icon: "card", label: "Payments" },
      { href: "reports.html", icon: "report", label: "Reports" },
      { href: "settings.html", icon: "settings", label: "Settings" },
      { href: "system-logs.html", icon: "logs", label: "System Logs" }
    ];
  } else if (path.includes("/admin/")) {
    nav = [
      { href: "dashboard.html", icon: "dashboard", label: "Dashboard" },
      { href: "hospital-info.html", icon: "hospital", label: "Hospital Info & Beds" },
      { href: "appointments.html", icon: "calendar", label: "Appointments" },
      { href: "doctors.html", icon: "doctor", label: "Doctors" },
      { href: "patients.html", icon: "users", label: "Patients" },
      { href: "storage.html", icon: "folder", label: "Storage Drive" },
      { href: "mfa-setup.html", icon: "shield", label: "Passkey MFA" },
      { href: "emergency.html", icon: "alert", label: "Emergency" },
      { href: "ambulance.html", icon: "ambulance", label: "Ambulance" },
      { href: "payments.html", icon: "card", label: "Payments" },
      { href: "reports.html", icon: "report", label: "Reports" }
    ];
  } else if (path.includes("/doctor/")) {
    nav = [
      { href: "dashboard.html", icon: "chart", label: "Doctor Dash" },
      { href: "appointments.html", icon: "clock", label: "Schedule" },
      { href: "patients.html", icon: "users", label: "My Patients" },
      { href: "prescriptions.html", icon: "prescription", label: "Prescriptions" }
    ];
  } else if (path.includes("/user/")) {
    nav = [
      { href: "dashboard.html", icon: "home", label: "Home" },
      { href: "appointments.html", icon: "calendar", label: "My Appointments" },
      { href: "doctors.html", icon: "search", label: "Find Doctor" },
      { href: "ambulance-booking.html", icon: "ambulance", label: "Ambulance Booking" },
      { href: "medical-records.html", icon: "records", label: "My Medical Records" },
      { href: "prescriptions.html", icon: "prescription", label: "Prescriptions" },
      { href: "payments.html", icon: "billing", label: "Billing" },
      { href: "profile.html", icon: "profile", label: "My Profile" }
    ];
  } else {
    // Universal fallback for Super Admin / Admin
    nav = [
      { href: "dashboard.html", icon: "chart", label: "Overview" },
      { href: "hospital-info.html", icon: "hospital", label: "Hospital Info & Beds" },
      { href: "admins.html", icon: "users", label: "Hospitals" },
      { href: "storage.html", icon: "folder", label: "Storage Drive" },
      { href: "mfa-setup.html", icon: "shield", label: "Passkey MFA" },
      { href: "appointments.html", icon: "calendar", label: "Appointments" },
      { href: "doctors.html", icon: "doctor", label: "Doctors" },
      { href: "patients.html", icon: "users", label: "Patients" },
      { href: "emergency.html", icon: "alert", label: "Emergency" },
      { href: "payments.html", icon: "card", label: "Payments" },
      { href: "reports.html", icon: "report", label: "Reports" },
      { href: "settings.html", icon: "settings", label: "Settings" },
      { href: "system-logs.html", icon: "logs", label: "System Logs" }
    ];
  }

  let html = `<aside class="sidebar" id="sidebar">
    <div class="sidebar-logo"><div class="logo-icon">${iconSvg("hospital")}</div><div class="logo-text">Arogya Plus</div></div>
    <nav class="sidebar-nav">`;

  nav.forEach((item) => {
    const active = item.href === activePage ? "active" : "";
    html += `<a href="${item.href}" class="nav-item ${active}">
      <span class="nav-icon">${iconSvg(item.icon)}</span>
      <span class="nav-label">${item.label}</span>
    </a>`;
  });

  html += `</nav>
    <div class="sidebar-footer">
      <a href="${prefix}login.html" class="nav-item" style="color:var(--red-light)" onclick="localStorage.removeItem('smart_hospital_token');localStorage.removeItem('smart_hospital_user');sessionStorage.removeItem('arogya_user');"><span class="nav-icon">${iconSvg("logout")}</span><span class="nav-label">Log Out</span></a>
      <button class="collapse-btn" onclick="document.getElementById('sidebar').classList.toggle('collapsed')">
        <span class="collapse-icon">&#9664;</span><span class="collapse-label">Collapse</span>
      </button>
    </div>
  </aside>`;

  const target = document.querySelector(".app-layout") || document.body;
  target.insertAdjacentHTML("afterbegin", html);
}

const parseStoredJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

const getStoredUser = () => {
  const localUser = parseStoredJson(localStorage.getItem("smart_hospital_user"));
  if (localUser && localUser.name) {
    return {
      name: localUser.name,
      email: localUser.email || "",
      role: localUser.role || "User"
    };
  }

  const sessionUser = parseStoredJson(sessionStorage.getItem("arogya_user"));
  if (sessionUser && sessionUser.name) {
    return {
      name: sessionUser.name,
      email: sessionUser.email || "",
      role: sessionUser.role || "User"
    };
  }

  return {
    name: "User",
    email: "",
    role: "Staff"
  };
};

export function renderTopbar(title) {
  const u = getStoredUser();
  const initials =
    u.name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const secondLine = u.email || u.role || "Staff";

  return `<header class="topbar">
    <div class="topbar-title">${title}</div>
    <div class="topbar-search">
      <span class="topbar-search-icon">${iconSvg("search", "icon-svg icon-svg-sm")}</span>
      <input type="text" placeholder="Search..."/>
    </div>
    <div class="user-menu">
      <div class="user-avatar" style="background:var(--grad-blue)">${initials}</div>
      <div><div class="user-name">${u.name}</div><div class="user-role">${secondLine}</div></div>
    </div>
  </header>`;
}
