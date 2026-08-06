import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("storage.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Hospital Storage Drive");

const state = {
  hospitalFolderRoot: "",
  currentFolder: "",
  parentFolder: "",
  items: [],
  stats: {},
  activeCategory: "all",
  searchQuery: "",
  viewMode: "grid",
  itemToDelete: null,
  selectedPaths: new Set(),
  selectedFileToUpload: null
};

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sanitizeFolderName = (name = "Hospital") =>
  String(name).trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "Hospital_Storage";

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
  const backBtn = document.getElementById("back-folder-btn");

  const isAtHospitalRoot =
    !state.currentFolder ||
    state.currentFolder === state.hospitalFolderRoot ||
    state.currentFolder.toLowerCase() === state.hospitalFolderRoot.toLowerCase();

  if (backBtn) {
    if (!isAtHospitalRoot) {
      backBtn.style.display = "inline-flex";
      backBtn.disabled = false;
      backBtn.title = `Go back to ${state.parentFolder || state.hospitalDisplayName}`;
    } else {
      backBtn.style.display = "none";
      backBtn.disabled = true;
    }
  }

  if (!container) return;

  const parts = state.currentFolder ? state.currentFolder.split("/") : [];
  const rootLabel = `🏥 ${state.hospitalDisplayName || "Hospital Storage"}`;
  let html = `<span class="crumb-link" data-folder="${escapeHtml(state.hospitalFolderRoot)}">${escapeHtml(rootLabel)}</span>`;
  
  let currentPath = "";
  parts.forEach((part, index) => {
    if (!part) return;
    currentPath += (currentPath ? "/" : "") + part;
    if (index === 0 && part.toLowerCase() === state.hospitalFolderRoot.toLowerCase()) {
      return; // Skip duplicating root
    }
    html += ` <span style="color:var(--text-500)">/</span> <span class="crumb-link" data-folder="${escapeHtml(
      currentPath
    )}">${escapeHtml(part)}</span>`;
  });

  container.innerHTML = html;

  container.querySelectorAll(".crumb-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const folder = e.currentTarget.dataset.folder || state.hospitalFolderRoot;
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
  const maxQuotaBytes = 5 * 1024 * 1024 * 1024;
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

const updateSelectionUI = () => {
  const btn = document.getElementById("download-selected-btn");
  const count = state.selectedPaths.size;
  if (!btn) return;

  if (count > 0) {
    btn.style.display = "inline-flex";
    btn.textContent = `📦 Download ${count} Selected (ZIP)`;
  } else {
    btn.style.display = "none";
  }

  const selectAllCb = document.getElementById("select-all-checkbox");
  if (selectAllCb) {
    const filtered = getFilteredItems();
    selectAllCb.checked = filtered.length > 0 && filtered.every((item) => state.selectedPaths.has(item.relativePath));
  }
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
      const isChecked = state.selectedPaths.has(item.relativePath);

      let thumbHtml = `<div class="file-icon-placeholder">${icon}</div>`;
      if (isPhoto && item.url) {
        thumbHtml = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(
          item.name
        )}" class="file-thumb-img" loading="lazy" onerror="this.outerHTML='<div class=\\'file-icon-placeholder\\'>📷</div>'">`;
      }

      return `
        <div class="file-card" data-path="${escapeHtml(item.relativePath)}" data-is-folder="${item.isFolder}">
          <div style="position:absolute;top:8px;left:8px;z-index:10">
            <input type="checkbox" class="item-checkbox" data-path="${escapeHtml(item.relativePath)}" ${isChecked ? "checked" : ""} style="cursor:pointer;width:16px;height:16px">
          </div>
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
                  )}">📂 Open</button>
                  <a class="file-action-btn" href="/api/admin/storage/download-zip?folder=${encodeURIComponent(
                    item.relativePath
                  )}" download target="_blank" title="Download folder content as ZIP">📦 ZIP</a>`
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
        <td colspan="6" style="text-align:center;padding:32px;color:var(--text-500)">No items in this folder.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const icon = getCategoryIcon(item.category, item.isFolder);
      const isPhoto = item.category === "photo";
      const isChecked = state.selectedPaths.has(item.relativePath);

      return `
        <tr>
          <td style="text-align:center">
            <input type="checkbox" class="item-checkbox" data-path="${escapeHtml(item.relativePath)}" ${isChecked ? "checked" : ""} style="cursor:pointer;width:16px;height:16px">
          </td>
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
                    )}">Open</button>
                    <a class="btn btn-outline btn-sm" href="/api/admin/storage/download-zip?folder=${encodeURIComponent(
                      item.relativePath
                    )}" download target="_blank">📦 ZIP</a>`
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
  container.querySelectorAll(".item-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const path = e.target.dataset.path;
      if (e.target.checked) {
        state.selectedPaths.add(path);
      } else {
        state.selectedPaths.delete(path);
      }
      updateSelectionUI();
    });
  });

  container.querySelectorAll(".open-folder-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const folderPath = e.currentTarget.dataset.path || state.hospitalFolderRoot;
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
    btn.addEventListener("click", (e) => {
      const path = e.currentTarget.dataset.path;
      openDeleteConfirmModal(path);
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

  updateSelectionUI();
};

const loadStorageData = async (folderPath = "") => {
  const reqFolder = folderPath || state.hospitalFolderRoot;
  try {
    const res = await apiRequest(`/api/admin/storage?folder=${encodeURIComponent(reqFolder)}`);
    if (res.success) {
      state.currentFolder = res.currentFolder || state.hospitalFolderRoot;
      state.parentFolder = res.parentFolder || "";
      state.items = res.items || [];
      state.stats = res.stats || {};
      renderDrive();
    }
  } catch (err) {
    toast(err.message || "Failed to load hospital storage", "error");
  }
};

const openLightbox = (url, name, meta) => {
  const modal = document.getElementById("image-lightbox-modal");
  const titleEl = document.getElementById("lightbox-title");
  const imgEl = document.getElementById("lightbox-img");
  const metaEl = document.getElementById("lightbox-meta");
  const downloadLink = document.getElementById("lightbox-download-link");

  if (!modal) return;
  if (titleEl) titleEl.textContent = name || "Photo Preview";
  if (imgEl) imgEl.src = url;
  if (metaEl) metaEl.textContent = meta || "-";
  if (downloadLink) {
    downloadLink.href = url;
    downloadLink.download = name || "photo.png";
  }

  modal.style.display = "flex";
};

const closeLightbox = () => {
  const modal = document.getElementById("image-lightbox-modal");
  if (modal) modal.style.display = "none";
};

const openUploadModal = () => {
  const modal = document.getElementById("upload-file-modal");
  const fileInfo = document.getElementById("selected-file-info");
  const submitBtn = document.getElementById("submit-upload-btn");
  const fileInput = document.getElementById("file-picker-input");

  state.selectedFileToUpload = null;
  if (fileInput) fileInput.value = "";
  if (fileInfo) {
    fileInfo.style.display = "none";
    fileInfo.textContent = "";
  }
  if (submitBtn) submitBtn.disabled = true;

  if (modal) modal.style.display = "flex";
};

const closeUploadModal = () => {
  const modal = document.getElementById("upload-file-modal");
  if (modal) modal.style.display = "none";
};

const openNewFolderModal = () => {
  const modal = document.getElementById("new-folder-modal");
  const input = document.getElementById("new-folder-name-input");
  if (input) input.value = "";
  if (modal) modal.style.display = "flex";
};

const closeNewFolderModal = () => {
  const modal = document.getElementById("new-folder-modal");
  if (modal) modal.style.display = "none";
};

const openDeleteConfirmModal = (relativePath) => {
  const modal = document.getElementById("delete-confirm-modal");
  const nameEl = document.getElementById("delete-item-name");
  const pathEl = document.getElementById("delete-item-path");

  state.itemToDelete = relativePath;
  const fileName = relativePath.split("/").pop();

  if (nameEl) nameEl.textContent = fileName;
  if (pathEl) pathEl.textContent = `Path: storage/${relativePath}`;

  if (modal) modal.style.display = "flex";
};

const closeDeleteConfirmModal = () => {
  const modal = document.getElementById("delete-confirm-modal");
  state.itemToDelete = null;
  if (modal) modal.style.display = "none";
};

const handleFileUpload = async () => {
  if (!state.selectedFileToUpload) {
    toast("Please select a file to upload", "warn");
    return;
  }

  const submitBtn = document.getElementById("submit-upload-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Data = reader.result;
      await apiRequest("/api/admin/storage/upload", {
        method: "POST",
        body: JSON.stringify({
          folder: state.currentFolder || state.hospitalFolderRoot,
          filename: state.selectedFileToUpload.name,
          contentBase64: base64Data
        })
      });

      toast(`File "${state.selectedFileToUpload.name}" uploaded to hospital storage`, "success");
      closeUploadModal();
      await loadStorageData(state.currentFolder);
    } catch (err) {
      toast(err.message || "Failed to upload file", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Upload File";
      }
    }
  };

  reader.onerror = () => {
    toast("Could not read file data", "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Upload File";
    }
  };

  reader.readAsDataURL(state.selectedFileToUpload);
};

const setupEventListeners = () => {
  // Search Bar
  const searchInput = document.getElementById("drive-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderDrive();
    });
  }

  // Filter Chips
  document.querySelectorAll(".drive-filters .filter-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      document.querySelectorAll(".drive-filters .filter-chip").forEach((c) => c.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.activeCategory = e.currentTarget.dataset.category || "all";
      renderDrive();
    });
  });

  // View switchers
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

  // Back button
  const backBtn = document.getElementById("back-folder-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (state.parentFolder) {
        loadStorageData(state.parentFolder);
      } else {
        loadStorageData(state.hospitalFolderRoot);
      }
    });
  }

  // Select all checkbox
  const selectAllCb = document.getElementById("select-all-checkbox");
  if (selectAllCb) {
    selectAllCb.addEventListener("change", (e) => {
      const filtered = getFilteredItems();
      if (e.target.checked) {
        filtered.forEach((item) => state.selectedPaths.add(item.relativePath));
      } else {
        filtered.forEach((item) => state.selectedPaths.delete(item.relativePath));
      }
      renderDrive();
    });
  }

  // Upload modal triggers & cross close button
  const uploadBtn = document.getElementById("upload-file-btn");
  const closeUploadBtn = document.getElementById("close-upload-modal-btn");
  const cancelUploadBtn = document.getElementById("cancel-upload-btn");
  const submitUploadBtn = document.getElementById("submit-upload-btn");
  const dropzone = document.getElementById("modal-dropzone");
  const filePicker = document.getElementById("file-picker-input");

  if (uploadBtn) uploadBtn.addEventListener("click", openUploadModal);
  if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadModal);
  if (cancelUploadBtn) cancelUploadBtn.addEventListener("click", closeUploadModal);

  if (dropzone && filePicker) {
    dropzone.addEventListener("click", () => filePicker.click());

    filePicker.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        state.selectedFileToUpload = e.target.files[0];
        const info = document.getElementById("selected-file-info");
        if (info) {
          info.style.display = "block";
          info.textContent = `Selected: ${state.selectedFileToUpload.name} (${(state.selectedFileToUpload.size / 1024).toFixed(1)} KB)`;
        }
        if (submitUploadBtn) submitUploadBtn.disabled = false;
      }
    });
  }

  if (submitUploadBtn) {
    submitUploadBtn.addEventListener("click", handleFileUpload);
  }

  // Folder creation modal
  const newFolderBtn = document.getElementById("new-folder-btn");
  const closeFolderBtn = document.getElementById("close-folder-modal-btn");
  const cancelFolderBtn = document.getElementById("cancel-folder-btn");
  const createFolderSubmitBtn = document.getElementById("create-folder-submit-btn");

  if (newFolderBtn) newFolderBtn.addEventListener("click", openNewFolderModal);
  if (closeFolderBtn) closeFolderBtn.addEventListener("click", closeNewFolderModal);
  if (cancelFolderBtn) cancelFolderBtn.addEventListener("click", closeNewFolderModal);

  if (createFolderSubmitBtn) {
    createFolderSubmitBtn.addEventListener("click", async () => {
      const input = document.getElementById("new-folder-name-input");
      const folderName = input?.value?.trim();
      if (!folderName) {
        toast("Please enter a folder name", "warn");
        return;
      }

      try {
        await apiRequest("/api/admin/storage/folder", {
          method: "POST",
          body: JSON.stringify({
            folder: state.currentFolder || state.hospitalFolderRoot,
            folderName
          })
        });

        toast(`Folder "${folderName}" created successfully`, "success");
        closeNewFolderModal();
        await loadStorageData(state.currentFolder);
      } catch (err) {
        toast(err.message || "Failed to create folder", "error");
      }
    });
  }

  // Lightbox modal close
  const closeLightboxBtn = document.getElementById("close-lightbox-btn");
  if (closeLightboxBtn) closeLightboxBtn.addEventListener("click", closeLightbox);

  // Delete confirm modal events
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const confirmDeleteBtn = document.getElementById("confirm-delete-submit-btn");

  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener("click", closeDeleteConfirmModal);

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!state.itemToDelete) return;

      try {
        await apiRequest("/api/admin/storage/item", {
          method: "DELETE",
          body: JSON.stringify({ relativePath: state.itemToDelete })
        });

        toast("Item deleted from hospital storage", "success");
        closeDeleteConfirmModal();
        await loadStorageData(state.currentFolder);
      } catch (err) {
        toast(err.message || "Failed to delete item", "error");
      }
    });
  }
};

const init = async () => {
  const session = ensureSession({
    allowedRoles: ["admin", "super-admin"],
    onDenied: () => toast("Please login as hospital admin", "error")
  });
  if (!session.allowed) return;

  const hospitalName = session.user?.hospitalName || "General Hospital";
  state.hospitalDisplayName = hospitalName;
  state.hospitalFolderRoot = sanitizeFolderName(hospitalName);

  const titleEl = document.getElementById("hospital-storage-title");
  if (titleEl) {
    titleEl.textContent = `🏥 ${hospitalName} - Storage Drive`;
  }

  setupEventListeners();
  await loadStorageData(state.hospitalFolderRoot);
};

init();
