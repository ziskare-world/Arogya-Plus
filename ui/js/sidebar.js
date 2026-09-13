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
    settings: `<svg ${base}><path d="M12 2C6.48 2 2 6.48 2 12c0 2.8 1.09 5.33 2.9 7.22L2 22l3.02-2.86C7.02 20.95 9.38 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-2.31 0-4.44-.77-6.13-2.05l-.43-.32-1.79 1.34.48-2.13c-1.31-1.58-2.13-3.58-2.13-5.74 0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9z"></path></svg>`,
    whatsapp: `<svg ${base}><path d="M20.52 3.48a11.69 11.69 0 0 0-8.33-3.45c-6.41 0-11.62 5.22-11.62 11.64 0 2.08.55 4.05 1.5 5.76L.04 22.45l5.81-1.54c1.66.91 3.57 1.44 5.58 1.44 6.41 0 11.62-5.22 11.62-11.64 0-3.13-1.26-5.97-3.53-8.23zM12.2 19.71c-1.84 0-3.61-.5-5.15-1.36l-.37-.22-3.45 0.92 0.92-3.36-.24-.39c-.88-1.44-1.38-3.1-1.38-4.87 0-5.34 4.34-9.69 9.68-9.69 2.56 0 5 .99 6.82 2.8a9.58 9.58 0 0 1 2.81 6.8c0 5.34-4.34 9.69-9.68 9.69zm5.44-7.44c-.3-.15-1.78-.88-2.05-.97-.27-.09-.47-.15-.66.15-.19.3-.73.97-.9 1.17-.17.2-.34.23-.63.08-.3-.15-1.27-.46-2.42-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.66-1.61-.9-2.21-.23-.55-.46-.48-.66-.49h-.56c-.19 0-.5.07-.76.38-.26.3-1.01 1-1.01 2.44s1.03 2.85 1.18 3.05c.15.2 2.04 3.13 4.95 4.39.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.78-.73 2.03-1.44.25-.71.25-1.32.17-1.44-.08-.12-.3-.19-.63-.34z"></path></svg>`,
    logout: `<svg ${base}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>`
  };

  return icons[name] || icons.chart;
};

export function injectSidebar(activePage) {
  const existingSidebar = document.getElementById("sidebar");
  if (existingSidebar) {
    existingSidebar.remove();
  }

  // Ensure AI Bot Assistant is active on all pages with sidebar
  try {
    import("./ai-chat-widget.js")
      .then((mod) => {
        if (mod && typeof mod.initAiChatWidget === "function") {
          mod.initAiChatWidget();
        }
      })
      .catch(() => {});
  } catch (e) {}

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
  const isSuperPath = path.includes("/super-admin/") || path.includes("/super_admin/") || path.includes("/super/");
  const isAdminPath = path.includes("/admin/");

  if (isSuperPath) {
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
  } else if (isAdminPath) {
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
      { href: "insurance.html", icon: "shield", label: "Insurance Claims" },
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
      <a href="javascript:void(0)" class="nav-item" style="color:var(--red-light)" onclick="if(window.logoutUser){window.logoutUser('/login');}else{try{localStorage.removeItem('smart_hospital_token');localStorage.removeItem('smart_hospital_user');localStorage.removeItem('smart_hospital_auth_notice');sessionStorage.clear();}catch(e){}window.location.href='/login?logout=true';}"><span class="nav-icon">${iconSvg("logout")}</span><span class="nav-label">Log Out</span></a>
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
