import { toast } from "../js/utils.js";
import { injectSidebar, renderTopbar } from "../js/sidebar.js";
import { apiRequest, ensureSession } from "../js/api-client.js";

window.toast = toast;
injectSidebar("storage.html");
document.getElementById("topbar-container").innerHTML = renderTopbar("Hospital Storage Explorer");

const folderListEl = document.getElementById("folder-list-container");
const fileGridEl = document.getElementById("file-grid-container");
const currentFolderTitleEl = document.getElementById("current-folder-title");
const searchInputEl = document.getElementById("file-search-input");

const statTotalFilesEl = document.getElementById("stat-total-files");
const statHospitalFoldersEl = document.getElementById("stat-hospital-folders");
const statTotalSizeEl = document.getElementById("stat-total-size");

const uploadFormEl = document.getElementById("storage-upload-form");
const uploadHospitalEl = document.getElementById("upload-hospital");
const uploadFileInputEl = document.getElementById("upload-file-input");

let allStorageFiles = [];
let activeFolderFilter = "all";

async function fetchStorageFiles() {
  try {
    const res = await apiRequest("/api/admin/storage/files");
    if (res.success) {
      allStorageFiles = res.data || [];
      renderStats(res);
      renderFolderList();
      renderFileGrid();
    }
  } catch (err) {
    console.error("Failed to load storage files:", err);
    toast("Failed to load storage files", "error");
  }
}

function renderStats(res) {
  if (statTotalFilesEl) statTotalFilesEl.textContent = String(res.count || 0);
  if (statHospitalFoldersEl) statHospitalFoldersEl.textContent = String(res.hospitalCount || 0);

  const totalBytes = allStorageFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
  if (statTotalSizeEl) statTotalSizeEl.textContent = (totalBytes / 1024).toFixed(1) + " KB";
}

function renderFolderList() {
  if (!folderListEl) return;

  const folders = [...new Set(allStorageFiles.map(f => f.hospitalFolder))];

  let html = `
    <div class="folder-item ${activeFolderFilter === 'all' ? 'active' : ''}" onclick="selectFolder('all')">
      📁 All Hospital Folders (${allStorageFiles.length})
    </div>
  `;

  folders.forEach(f => {
    const count = allStorageFiles.filter(item => item.hospitalFolder === f).length;
    html += `
      <div class="folder-item ${activeFolderFilter === f ? 'active' : ''}" onclick="selectFolder('${f}')">
        🏥 ${f.replace(/_/g, " ")} (${count})
      </div>
    `;
  });

  folderListEl.innerHTML = html;
}

window.selectFolder = function (folderName) {
  activeFolderFilter = folderName;
  if (currentFolderTitleEl) {
    currentFolderTitleEl.textContent = folderName === 'all' ? 'All Hospital Files' : `Hospital: ${folderName.replace(/_/g, " ")}`;
  }
  renderFolderList();
  renderFileGrid();
};

function renderFileGrid() {
  if (!fileGridEl) return;

  const query = String(searchInputEl?.value || "").toLowerCase().trim();

  let filtered = allStorageFiles;
  if (activeFolderFilter !== "all") {
    filtered = filtered.filter(f => f.hospitalFolder === activeFolderFilter);
  }

  if (query) {
    filtered = filtered.filter(f => f.filename.toLowerCase().includes(query) || f.hospitalFolder.toLowerCase().includes(query));
  }

  if (filtered.length === 0) {
    fileGridEl.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:30px;">No files found in storage.</div>`;
    return;
  }

  fileGridEl.innerHTML = filtered.map(f => {
    const icon = f.fileType === 'image' ? '🖼️' : (f.fileType === 'pdf' ? '📄' : '📁');
    return `
      <div class="file-card">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="file-icon">${icon}</div>
          <div style="flex:1;overflow:hidden;">
            <div class="file-name" title="${f.filename}">${f.filename}</div>
            <div class="file-meta">Folder: ${f.hospitalFolder.replace(/_/g, " ")}</div>
          </div>
        </div>
        <div class="file-meta" style="margin-top:4px;">Size: ${f.sizeKb} | ${new Date(f.updatedAt).toLocaleDateString()}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <a href="${f.url}" target="_blank" class="btn btn-outline btn-sm" style="flex:1;text-align:center;text-decoration:none;">View / Download</a>
          <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.hospitalFolder}', '${f.filename}')">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

window.deleteFile = async function (folder, filename) {
  if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

  try {
    const res = await apiRequest(`/api/admin/storage/files/${folder}/${filename}`, "DELETE");
    if (res.success) {
      toast("File deleted from disk", "success");
      fetchStorageFiles();
    }
  } catch (err) {
    toast(err.message || "Failed to delete file", "error");
  }
};

if (searchInputEl) {
  searchInputEl.oninput = renderFileGrid;
}

if (uploadFormEl) {
  uploadFormEl.onsubmit = async (e) => {
    e.preventDefault();

    const hospitalName = uploadHospitalEl.value.trim();
    const file = uploadFileInputEl.files[0];

    if (!hospitalName || !file) {
      toast("Please specify hospital name and select a file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = {
          hospitalName: hospitalName,
          fileName: file.name,
          fileData: reader.result
        };

        const res = await apiRequest("/api/admin/storage/upload", "POST", payload);
        if (res.success) {
          toast("File uploaded cleanly into storage subfolder!", "success");
          document.getElementById("upload-modal").classList.add("hidden");
          uploadFormEl.reset();
          fetchStorageFiles();
        }
      } catch (err) {
        toast(err.message || "Upload failed", "error");
      }
    };

    reader.readAsDataURL(file);
  };
}

window.refreshStorageFiles = fetchStorageFiles;

ensureSession({
  allowedRoles: ["admin", "super-admin"]
}).then(() => {
  fetchStorageFiles();
});
