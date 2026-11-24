const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PHOTOS_FILE = path.join("/tmp", "photos.json");
const BLOB_PREFIX = "otter-alert/";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const STATIC_DIR = process.env.VERCEL ? process.cwd() : __dirname;

if (!process.env.VERCEL && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(STATIC_DIR));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("id-ID") : "-";
}

function getBlobSdk() {
  if (!BLOB_TOKEN) {
    return null;
  }
  try {
    return require("@vercel/blob");
  } catch (error) {
    console.warn("Vercel Blob SDK tidak tersedia:", error.message);
    return null;
  }
}

async function uploadToBlob(filename, buffer) {
  const blob = getBlobSdk();
  if (!blob) {
    return null;
  }
  try {
    const result = await blob.put(BLOB_PREFIX + filename, buffer, {
      access: "public",
      token: BLOB_TOKEN,
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return result.url || null;
  } catch (error) {
    console.error("Gagal upload ke Vercel Blob:", error.message);
    return null;
  }
}

async function listBlobPhotos() {
  const blob = getBlobSdk();
  if (!blob) {
    return [];
  }
  try {
    const result = await blob.list({
      prefix: BLOB_PREFIX,
      token: BLOB_TOKEN,
      limit: 100,
    });
    return (result.blobs || []).map((item) => ({
      filename: item.pathname.slice(BLOB_PREFIX.length),
      url: item.url,
      createdAt: item.uploadedAt,
      sizeKB: (item.size / 1024).toFixed(1),
      source: "blob",
    }));
  } catch (error) {
    console.error("Gagal membaca Vercel Blob:", error.message);
    return [];
  }
}

async function readPhotoStore() {
  try {
    const raw = await fsp.readFile(PHOTOS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch (error) {
    return [];
  }
}

async function writePhotoStore(photos) {
  await fsp.mkdir(path.dirname(PHOTOS_FILE), { recursive: true });
  await fsp.writeFile(PHOTOS_FILE, JSON.stringify(photos), "utf8");
}

async function collectPhotos() {
  const byFilename = new Map();

  const stored = await readPhotoStore();
  stored.forEach((photo) => {
    if (photo.filename) {
      byFilename.set(photo.filename, { ...photo, source: photo.source || "tmp" });
    }
  });

  const blobs = await listBlobPhotos();
  blobs.forEach((blob) => {
    const current = byFilename.get(blob.filename);
    byFilename.set(
      blob.filename,
      current ? { ...current, url: blob.url || current.url, source: "blob" } : blob,
    );
  });

  if (!process.env.VERCEL) {
    try {
      const files = await fsp.readdir(UPLOADS_DIR);
      const localPhotos = await Promise.all(
        files
          .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
          .map(async (file) => {
            const stats = await fsp.stat(path.join(UPLOADS_DIR, file));
            return {
              filename: file,
              url: `/uploads/${file}`,
              createdAt: stats.mtime.toISOString(),
              sizeKB: (stats.size / 1024).toFixed(1),
              source: "local",
            };
          }),
      );
      localPhotos.forEach((photo) => {
        if (!byFilename.has(photo.filename)) {
          byFilename.set(photo.filename, photo);
        }
      });
    } catch (error) {
      console.warn("Gagal membaca folder uploads lokal:", error.message);
    }
  }

  return Array.from(byFilename.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

app.post("/api/upload-photo", async (req, res) => {
  try {
    const { image, playerName } = req.body || {};
    if (typeof image !== "string" || !image) {
      return res.status(400).json({ success: false, message: "Data gambar tidak ditemukan." });
    }

    const rawName = typeof playerName === "string" ? playerName.trim() : "";
    const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20) || "Pemain";
    const match = image.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    const rawExt = match ? match[1].toLowerCase() : "png";
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;
    const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    const base64Data = match ? match[2].replace(/\s/g, "") : image;
    const buffer = Buffer.from(base64Data, "base64");

    if (!buffer.length) {
      return res.status(400).json({ success: false, message: "Data gambar tidak valid." });
    }

    const timestamp = Date.now();
    const filename = `foto-${cleanName}-${timestamp}.${ext}`;
    const blobUrl = await uploadToBlob(filename, buffer);

    const record = {
      filename,
      playerName: cleanName,
      image,
      mimeType,
      sizeKB: (buffer.length / 1024).toFixed(1),
      createdAt: new Date(timestamp).toISOString(),
      url: blobUrl || "",
      source: blobUrl ? "blob" : "tmp",
    };

    const photos = await readPhotoStore();
    photos.push(record);
    await writePhotoStore(photos);

    if (!process.env.VERCEL) {
      try {
        await fsp.mkdir(UPLOADS_DIR, { recursive: true });
        await fsp.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      } catch (error) {
        console.warn("Gagal menulis file lokal:", error.message);
      }
    }

    return res.json({
      success: true,
      filename,
      url: blobUrl || `/uploads/${filename}`,
      stored: blobUrl ? "blob" : "tmp",
    });
  } catch (error) {
    console.error("Error saving photo:", error);
    return res.status(500).json({ success: false, message: "Gagal menyimpan foto di server." });
  }
});

app.get("/admin-photos", async (req, res) => {
  try {
    const photos = await collectPhotos();
    const cardsHTML =
      photos.length === 0
        ? `<div class="empty-state">Belum ada foto tersimpan di server. Ambil foto di Bilik Photobooth terlebih dahulu!</div>`
        : photos
            .map((photo) => {
              const photoUrl = photo.url || photo.image || "";
              const sourceLabel =
                photo.source === "blob"
                  ? "Vercel Blob"
                  : photo.source === "tmp"
                    ? "Cache /tmp"
                    : "File lokal";
              return `
          <div class="photo-card">
            <div class="photo-preview">
              <a href="${escapeHtml(photoUrl)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(photo.filename)}" loading="lazy" />
              </a>
            </div>
            <div class="photo-info">
              <p class="photo-name">${escapeHtml(photo.filename)}</p>
              <p class="photo-meta">${formatDate(photo.createdAt)} · ${escapeHtml(photo.sizeKB || "0.0")} KB · ${sourceLabel}</p>
              <a href="${escapeHtml(photoUrl)}" download="${escapeHtml(photo.filename)}" class="btn-download">Unduh File</a>
            </div>
          </div>
        `;
            })
            .join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTTER_ALERT.EXE — Galeri Rahasia Admin</title>
  <style>
    :root {
      --bg: #eaf5ff;
      --card-bg: #fffdf6;
      --border: #2C3E50;
      --primary: #89CFF0;
      --primary-dark: #6FB2D2;
      --text: #332B3A;
      --muted: #665c70;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background: var(--bg);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: var(--text);
    }
    .container { max-width: 1080px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 3px solid var(--border);
      border-radius: 12px;
      box-shadow: 4px 4px 0 var(--border);
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 1.3rem; color: #1e293b; }
    .badge {
      padding: 4px 10px;
      background: var(--primary);
      border: 2px solid var(--border);
      border-radius: 20px;
      font-weight: bold;
      font-size: 0.85rem;
    }
    .btn-refresh {
      padding: 8px 16px;
      background: var(--primary);
      border: 2px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 2px 2px 0 var(--border);
    }
    .btn-refresh:hover { background: var(--primary-dark); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .photo-card {
      background: var(--card-bg);
      border: 3px solid var(--border);
      border-radius: 12px;
      box-shadow: 4px 4px 0 var(--border);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .photo-preview {
      width: 100%;
      background: #f1f5f9;
      border-bottom: 2px solid var(--border);
      aspect-ratio: 4/5;
      overflow: hidden;
    }
    .photo-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.2s;
    }
    .photo-preview img:hover { transform: scale(1.03); }
    .photo-info {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .photo-name { margin: 0; font-weight: bold; font-size: 0.85rem; word-break: break-all; }
    .photo-meta { margin: 0; font-size: 0.75rem; color: var(--muted); }
    .btn-download {
      margin-top: auto;
      display: inline-block;
      text-align: center;
      padding: 6px 12px;
      background: #8fd5b4;
      border: 2px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      text-decoration: none;
      font-weight: bold;
      font-size: 0.8rem;
      box-shadow: 2px 2px 0 var(--border);
    }
    .btn-download:hover { background: #76c7a1; }
    .empty-state {
      grid-column: 1 / -1;
      padding: 40px;
      text-align: center;
      background: var(--card-bg);
      border: 3px dashed var(--border);
      border-radius: 12px;
      font-size: 1rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>📸 Galeri Rahasia Admin</h1>
        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--muted);">Semua hasil foto dari Bilik Photobooth OTTER_ALERT.EXE</p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="badge">Total: ${photos.length} foto</span>
        <a href="/admin-photos" class="btn-refresh">🔄 Refresh</a>
      </div>
    </header>
    <main class="grid">
      ${cardsHTML}
    </main>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    console.error("Error reading gallery:", error);
    return res.status(500).send("<h1>500 - Gagal membaca galeri foto</h1>");
  }
});

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`OTTER_ALERT.EXE Server berjalan!`);
    console.log(`Game URL    : http://localhost:${PORT}`);
    console.log(`Admin Galeri: http://localhost:${PORT}/admin-photos`);
    console.log(`==========================================`);
  });
}
