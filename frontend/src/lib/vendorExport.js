import JSZip from "jszip";

const STUDENT_COLUMNS = [
  "id",
  "name",
  "roll_no",
  "class_id",
  "section",
  "gender",
  "dob",
  "parent_phone",
  "blood_group",
  "house",
  "address",
];

const TEACHER_COLUMNS = [
  "id",
  "user_id",
  "name",
  "email",
  "phone_number",
  "gender",
  "assigned_class_id",
  "core_subject",
];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(records, columns) {
  const header = columns.join(",");
  const rows = records.map((r) =>
    columns.map((c) => csvEscape(r[c])).join(",")
  );
  return [header, ...rows].join("\n");
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*);base64/) || [])[1] || "image/png";
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function extFromMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("svg")) return "svg";
  return "img";
}

function safeFileName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "record";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateVendorZip({
  records,
  design,
  targetType,
  filename = "id-card-vendor-pack.zip",
  onProgress,
}) {
  if (!records || records.length === 0) {
    throw new Error("No records to export");
  }
  const zip = new JSZip();
  const isTeacher = targetType === "teachers";
  const columns = isTeacher ? TEACHER_COLUMNS : STUDENT_COLUMNS;

  onProgress?.("Building CSV…");
  zip.file("records.csv", buildCsv(records, columns));

  onProgress?.("Writing print spec…");
  zip.file(
    "print-spec.json",
    JSON.stringify(
      {
        target_type: targetType,
        record_count: records.length,
        template: design.template || "classic",
        accent: design.accent,
        school_name: design.schoolName,
        school_name_local: design.schoolNameLocal || null,
        tagline: design.tagline,
        validity_year: design.validityYear,
        qr_enabled: design.showQr !== false,
        qr_url_pattern: `https://vidya-os.app/v/${
          isTeacher ? "teacher" : "student"
        }/{id}`,
        card_size_mm: { width: 85.6, height: 54 },
        layout: { columns: 2, rows: 5, cards_per_page: 10, page: "A4" },
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  zip.file(
    "README.txt",
    [
      `VidyaOS ID card vendor pack`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      `Target: ${targetType}  ·  Records: ${records.length}`,
      ``,
      `Files included:`,
      `  records.csv      Print data for every card (one row per record)`,
      `  photos/          Photos keyed by ${isTeacher ? "user_id" : "id"}.`,
      `                   Records without a photo are listed in photos/missing.txt`,
      `  print-spec.json  Brand spec: template, accent colour, school name, validity, QR URL pattern`,
      ``,
      `Card spec: 85.6 x 54 mm (CR80, credit-card size).`,
      `Sheet layout: 2 x 5 cards per A4 sheet = 10 cards per page.`,
      `QR code: encodes a URL of the form ${
        design.showQr === false
          ? "(QR is disabled for this batch)"
          : `https://vidya-os.app/v/${
              isTeacher ? "teacher" : "student"
            }/{id}`
      }.`,
      ``,
      `For questions about this pack, contact the school administrator who generated it.`,
    ].join("\n")
  );

  onProgress?.("Packing photos…");
  const photosFolder = zip.folder("photos");
  const missingPhotos = [];
  for (const r of records) {
    const recId = r.id || r.user_id;
    const display = safeFileName(`${r.roll_no || ""}-${r.name || recId}`);
    const img = r.profile_image;
    if (!img) {
      missingPhotos.push(`${recId},${r.name || ""}`);
      continue;
    }
    try {
      if (img.startsWith("data:")) {
        const blob = dataUrlToBlob(img);
        const ext = extFromMime(blob.type);
        photosFolder.file(`${display}-${recId}.${ext}`, blob);
      } else {
        // Remote URL — fetch (may fail on CORS for arbitrary hosts)
        const resp = await fetch(img);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const ext = extFromMime(blob.type);
        photosFolder.file(`${display}-${recId}.${ext}`, blob);
      }
    } catch (_) {
      missingPhotos.push(`${recId},${r.name || ""}`);
    }
  }
  if (missingPhotos.length > 0) {
    photosFolder.file(
      "missing.txt",
      [
        "Records without a photo (id,name):",
        ...missingPhotos,
      ].join("\n")
    );
  }

  onProgress?.("Compressing…");
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  downloadBlob(blob, filename);
}
