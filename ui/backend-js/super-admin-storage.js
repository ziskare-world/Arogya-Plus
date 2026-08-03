import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("storage.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Storage Drive");

const state = {
  currentFolder: "",
  parentFolder: "",
  items: [],
  stats: {},
  activeCategory: "all",
  searchQuery: "",
  viewMode: "grid",
  selectedFile: null
};

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getCategoryIcon = (category, isFolder) => {
  if (isFolder) return "📁";
  if (category === "photo") return "📷";
  if (category === "document") return "📄";
  if (category === "audio") return "🎵";
  if (category === "video") return "🎥";
  if (category === "archive") return "📦";
  if (category === "code") return "💻";
  return "📎";
};

const formatDateTime = (isoStr) => {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const renderBreadcrumbs = () => {
  const container = document.getElementById("drive-breadcrumbs");
  if (!container) return;

  const parts = state.currentFolder ? state.currentFolder.split("/") : [];
  let html = `<span class="crumb-link" data-folder="">Storage Root</span>`;
  let currentPath = "";

  parts.forEach((part) => {
    if (!part) return;
    currentPath += (currentPath ? "/" : "") + part;
    html += ` <span style="color:var(--text-500)">/</span> <span class="crumb-link" data-folder="${escapeHtml(
      currentPath
    )}">${escapeHtml(part)}</span>`;
  });

  container.innerHTML = html;

  container.querySelectorAll(".crumb-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const folder = e.currentTarget.dataset.folder || "";
      loadStorageData(folder);
    });
  });
};

const renderStats = () => {
  const quotaUsedEl = document.getElementById("quota-used-text");
  const quotaItemsEl = document.getElementById("quota-items-text");
  const quotaPctEl = document.getElementById("quota-pct-text");
  const quotaFillEl = document.getElementById("quota-fill-bar");
  const countPhotosEl = document.getElementById("count-photos");
  const countDocsEl = document.getElementById("count-docs");
  const countFoldersEl = document.getElementById("count-folders");

  const totalBytes = state.stats.totalSizeBytes || 0;
  const maxQuotaBytes = 5 * 1024 * 1024 * 1024; // 5 GB default visual threshold
  const pct = Math.min(100, Math.max(1, Math.round((totalBytes / maxQuotaBytes) * 100)));

  if (quotaUsedEl) quotaUsedEl.textContent = `${state.stats.formattedTotalSize || "0 B"} Used`;
  if (quotaItemsEl) quotaItemsEl.textContent = `${state.stats.totalItems || 0} items stored`;
  if (quotaPctEl) quotaPctEl.textContent = `${pct}% of 5GB`;
  if (quotaFillEl) quotaFillEl.style.width = `${pct}%`;

  if (countPhotosEl) countPhotosEl.textContent = `📷 ${state.stats.photoCount || 0} Photos`;
  if (countDocsEl) countDocsEl.textContent = `📄 ${state.stats.documentCount || 0} Docs`;
  if (countFoldersEl) countFoldersEl.textContent = `📁 ${state.stats.folderCount || 0} Folders`;
};

const getFilteredItems = () => {
  return state.items.filter((item) => {
    const matchesCategory =
      state.activeCategory === "all" ||
      (state.activeCategory === "folder" && item.isFolder) ||
      item.category === state.activeCategory;

    const matchesSearch =
      !state.searchQuery ||
      item.name.toLowerCase().includes(state.searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });
};

const renderGridView = (filtered) => {
  const container = document.getElementById("drive-grid-container");
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-500)">
        <div style="font-size:2.5rem;margin-bottom:8px">📂</div>
        <div style="font-weight:600">No files or folders found</div>
        <div style="font-size:.8rem">Upload a file or create a folder to get started.</div>
      </div>`;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const isPhoto = item.category === "photo";
      const icon = getCategoryIcon(item.category, item.isFolder);

      let thumbHtml = `<div class="file-icon-placeholder">${icon}</div>`;
      if (isPhoto && item.url) {
        thumbHtml = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(
          item.name
        )}" class="file-thumb-img" loading="lazy" onerror="this.outerHTML='<div class=\\'file-icon-placeholder\\'>📷</div>'">`;
      }

      return `
        <div class="file-card" data-path="${escapeHtml(item.relativePath)}" data-is-folder="${item.isFolder}">
          <div class="file-thumb-box" ${item.isFolder ? `style="cursor:pointer"` : ""}>
            ${thumbHtml}
          </div>
          <div class="file-card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="file-card-meta">
            <span>${escapeHtml(item.formattedSize)}</span>
            <span>${escapeHtml(item.category.toUpperCase())}</span>
          </div>
          <div class="file-actions">
            ${
              item.isFolder
                ? `<button class="file-action-btn open-folder-btn" data-path="${escapeHtml(
                    item.relativePath
                  )}">📂 Open</button>`
                : `${
                    isPhoto
                      ? `<button class="file-action-btn preview-btn" data-url="${escapeHtml(
                          item.url
                        )}" data-name="${escapeHtml(item.name)}" data-meta="${escapeHtml(
                          item.formattedSize
                        )}">👁️ Preview</button>`
                      : ""
                  }
                  <a class="file-action-btn" href="${escapeHtml(
                    item.url
                  )}" download target="_blank">⬇️ Download</a>`
            }
            <button class="file-action-btn delete-btn" data-path="${escapeHtml(
              item.relativePath
            )}">🗑️</button>
          </div>
        </div>`;
    })
    .join("");

  attachItemEvents(container);
};

const renderListView = (filtered) => {
  const tbody = document.getElementById("drive-list-tbody");
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:32px;color:var(--text-500)">No items in this folder.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const icon = getCategoryIcon(item.category, item.isFolder);
      const isPhoto = item.category === "photo";

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:1.2rem">${icon}</span>
              ${
                item.isFolder
                  ? `<span class="crumb-link open-folder-btn" data-path="${escapeHtml(
                      item.relativePath
                    )}" style="font-weight:600">${escapeHtml(item.name)}</span>`
                  : `<span style="font-weight:500;color:var(--text-100)">${escapeHtml(
                      item.name
                    )}</span>`
              }
            </div>
          </td>
          <td><span class="badge ${item.isFolder ? "badge-yellow" : "badge-cyan"}">${escapeHtml(
        item.category
      )}</span></td>
          <td>${escapeHtml(item.formattedSize)}</td>
          <td>${escapeHtml(formatDateTime(item.modifiedAt))}</td>
          <td style="text-align:right">
            <div style="display:inline-flex;gap:6px">
              ${
                item.isFolder
                  ? `<button class="btn btn-outline btn-sm open-folder-btn" data-path="${escapeHtml(
                      item.relativePath
                    )}">Open</button>`
                  : `${
                      isPhoto
                        ? `<button class="btn btn-outline btn-sm preview-btn" data-url="${escapeHtml(
                            item.url
                          )}" data-name="${escapeHtml(item.name)}" data-meta="${escapeHtml(
                            item.formattedSize
                          )}">Preview</button>`
                        : ""
                    }
                    <a class="btn btn-outline btn-sm" href="${escapeHtml(
                      item.url
                    )}" download target="_blank">Download</a>`
              }
              <button class="btn btn-danger btn-sm delete-btn" data-path="${escapeHtml(
                item.relativePath
              )}">Delete</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  attachItemEvents(tbody);
};

const attachItemEvents = (container) => {
  container.querySelectorAll(".open-folder-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const folderPath = e.currentTarget.dataset.path || "";
      loadStorageData(folderPath);
    });
  });

  container.querySelectorAll(".preview-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.dataset.url;
      const name = e.currentTarget.dataset.name;
      const meta = e.currentTarget.dataset.meta;
      openLightbox(url, name, meta);
    });
  });

  container.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const path = e.currentTarget.dataset.path;
      if (!confirm(`Are you sure you want to delete "${path}"?`)) return;

      try {
        await apiRequest("/api/admin/storage/item", {
          method: "DELETE",
          body: JSON.stringify({ relativePath: path })
        });
        toast("Item deleted successfully", "success");
        loadStorageData(state.currentFolder);
      } catch (err) {
        toast(err.message || "Failed to delete item", "error");
      }
    });
  });
};

const renderDrive = () => {
  renderBreadcrumbs();
  renderStats();
  const filtered = getFilteredItems();

  if (state.viewMode === "grid") {
    document.getElementById("drive-grid-container").style.display = "grid";
    document.getElementById("drive-list-container").style.display = "none";
    renderGridView(filtered);
  } else {
    document.getElementById("drive-grid-container").style.display = "none";
    document.getElementById("drive-list-container").style.display = "block";
    renderListView(filtered);
  }
};

const loadStorageData = async (folderPath = "") => {
  try {
    const res = await apiRequest(`/api/admin/storage?folder=${encodeURIComponent(folderPath)}`);
    if (res.success) {
      state.currentFolder = res.currentFolder || "";
      state.parentFolder = res.parentFolder || "";
      state.items = res.items || [];
      state.stats = res.stats || {};
      renderDrive();
    }
  } catch (err) {
    toast(err.message || "Failed to load storage drive", "error");
  }
};

const openLightbox = (url, name, meta) => {
  const modal = document.getElementById("image-lightbox-modal");
  const img = document.getElementById("lightbox-img");
  const title = document.getElementById("lightbox-title");
  const metaEl = document.getElementById("lightbox-meta");
  const download = document.getElementById("lightbox-download-link");

  if (!modal || !img) return;

  img.src = url;
  if (title) title.textContent = name || "Photo Preview";
  if (metaEl) metaEl.textContent = meta || "";
  if (download) download.href = url;

  modal.style.display = "flex";
};

const setupEventHandlers = () => {
  // Filter Chips
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.activeCategory = e.currentTarget.dataset.category || "all";
      renderDrive();
    });
  });

  // View Switchers
  const btnGrid = document.getElementById("btn-grid-view");
  const btnList = document.getElementById("btn-list-view");

  if (btnGrid && btnList) {
    btnGrid.addEventListener("click", () => {
      btnGrid.classList.add("active");
      btnList.classList.remove("active");
      state.viewMode = "grid";
      renderDrive();
    });

    btnList.addEventListener("click", () => {
      btnList.classList.add("active");
      btnGrid.classList.remove("active");
      state.viewMode = "list";
      renderDrive();
    });
  }

  // Live Search Input
  const searchInput = document.getElementById("drive-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderDrive();
    });
  }

  // Lightbox Close
  const closeLightboxBtn = document.getElementById("close-lightbox-btn");
  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener("click", () => {
      document.getElementById("image-lightbox-modal").style.display = "none";
    });
  }

  // New Folder Modal
  const newFolderBtn = document.getElementById("new-folder-btn");
  const newFolderModal = document.getElementById("new-folder-modal");
  const cancelFolderBtn = document.getElementById("cancel-folder-btn");
  const createFolderSubmitBtn = document.getElementById("create-folder-submit-btn");
  const newFolderNameInput = document.getElementById("new-folder-name-input");

  if (newFolderBtn && newFolderModal) {
    newFolderBtn.addEventListener("click", () => {
      newFolderNameInput.value = "";
      newFolderModal.style.display = "flex";
    });

    cancelFolderBtn.addEventListener("click", () => {
      newFolderModal.style.display = "none";
    });

    createFolderSubmitBtn.addEventListener("click", async () => {
      const folderName = newFolderNameInput.value.trim();
      if (!folderName) {
        toast("Please enter a valid folder name", "warn");
        return;
      }

      try {
        await apiRequest("/api/admin/storage/folder", {
          method: "POST",
          body: JSON.stringify({
            folder: state.currentFolder,
            folderName
          })
        });
        toast("Folder created successfully", "success");
        newFolderModal.style.display = "none";
        loadStorageData(state.currentFolder);
      } catch (err) {
        toast(err.message || "Failed to create folder", "error");
      }
    });
  }

  // Upload File Modal & Dropzone
  const uploadFileBtn = document.getElementById("upload-file-btn");
  const uploadFileModal = document.getElementById("upload-file-modal");
  const cancelUploadBtn = document.getElementById("cancel-upload-btn");
  const submitUploadBtn = document.getElementById("submit-upload-btn");
  const modalDropzone = document.getElementById("modal-dropzone");
  const filePickerInput = document.getElementById("file-picker-input");
  const selectedFileInfo = document.getElementById("selected-file-info");

  if (uploadFileBtn && uploadFileModal) {
    uploadFileBtn.addEventListener("click", () => {
      state.selectedFile = null;
      submitUploadBtn.disabled = true;
      selectedFileInfo.style.display = "none";
      uploadFileModal.style.display = "flex";
    });

    cancelUploadBtn.addEventListener("click", () => {
      uploadFileModal.style.display = "none";
    });

    modalDropzone.addEventListener("click", () => {
      filePickerInput.click();
    });

    filePickerInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        state.selectedFile = file;
        selectedFileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        selectedFileInfo.style.display = "block";
        submitUploadBtn.disabled = false;
      }
    });

    submitUploadBtn.addEventListener("click", async () => {
      if (!state.selectedFile) return;

      submitUploadBtn.disabled = true;
      submitUploadBtn.textContent = "Uploading...";

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const contentBase64 = reader.result;
          await apiRequest("/api/admin/storage/upload", {
            method: "POST",
            body: JSON.stringify({
              folder: state.currentFolder,
              filename: state.selectedFile.name,
              contentBase64
            })
          });
          toast("File uploaded successfully to Storage Drive", "success");
          uploadFileModal.style.display = "none";
          loadStorageData(state.currentFolder);
        } catch (err) {
          toast(err.message || "Failed to upload file", "error");
        } finally {
          submitUploadBtn.disabled = false;
          submitUploadBtn.textContent = "Upload File";
        }
      };
      reader.readAsDataURL(state.selectedFile);
    });
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["super-admin", "admin"],
    onDenied: () => toast("Please login as super admin or admin", "error")
  });
  if (!session.allowed) return;

  setupEventHandlers();
  await loadStorageData("");
};

init();
