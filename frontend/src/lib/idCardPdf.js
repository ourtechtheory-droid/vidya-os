import jsPDF from "jspdf";
import QRCode from "qrcode";

const PAGE_W = 210;
const PAGE_H = 297;
const CARD_W = 85.6;
const CARD_H = 54;
const COLS = 2;
const ROWS = 5;
const CARDS_PER_PAGE = COLS * ROWS;
const H_MARGIN = (PAGE_W - COLS * CARD_W) / 2;
const V_MARGIN = (PAGE_H - ROWS * CARD_H) / 2;

function hexToRgb(hex) {
  const m = (hex || "#000000").replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}

function initialsOf(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function qrUrlFor(targetType, record) {
  const id = record?.id || record?.user_id || "";
  const kind = targetType === "teachers" ? "teacher" : "student";
  return `https://vidya-os.app/v/${kind}/${id}`;
}

async function buildQrCache(records, targetType) {
  const cache = {};
  for (const r of records) {
    const key = r.id || r.user_id;
    if (!key) continue;
    cache[key] = await QRCode.toDataURL(qrUrlFor(targetType, r), {
      errorCorrectionLevel: "H",
      margin: 0,
      width: 240,
    });
  }
  return cache;
}

function drawLogo(doc, design, x, y, size) {
  if (design.logoImage) {
    try {
      const fmt = design.logoImage.startsWith("data:image/png")
        ? "PNG"
        : design.logoImage.startsWith("data:image/jpeg")
        ? "JPEG"
        : "PNG";
      doc.addImage(design.logoImage, fmt, x, y, size, size);
      return;
    } catch (_) {
      // fall through to monogram
    }
  }
  doc.setFillColor(255, 255, 255);
  doc.setGState(new doc.GState({ opacity: 0.15 }));
  doc.roundedRect(x, y, size, size, 1.5, 1.5, "F");
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 0.55);
  doc.text(design.logo || "V", x + size / 2, y + size * 0.7, {
    align: "center",
  });
}

function drawQrBox(doc, qrDataUrl, x, y, size, bgWhite = true) {
  if (!qrDataUrl) return;
  if (bgWhite) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, size, size, 1.5, 1.5, "F");
    doc.addImage(qrDataUrl, "PNG", x + 1, y + 1, size - 2, size - 2);
  } else {
    doc.addImage(qrDataUrl, "PNG", x, y, size, size);
  }
}

function drawPhotoPlaceholder(doc, record, x, y, size, light = true) {
  if (light) {
    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.2 }));
  } else {
    doc.setFillColor(240, 240, 240);
  }
  doc.roundedRect(x, y, size, size, 1.5, 1.5, "F");
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setTextColor(light ? 255 : 80, light ? 255 : 80, light ? 255 : 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 0.45);
  doc.text(initialsOf(record?.name), x + size / 2, y + size * 0.65, {
    align: "center",
  });
}

function drawFrontClassic(doc, record, design, targetType, x, y, accent, qrDataUrl) {
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(x, y, CARD_W, CARD_H, "F");

  doc.setFillColor(255, 255, 255);
  doc.setGState(new doc.GState({ opacity: 0.08 }));
  doc.circle(x + 14, y + 12, 18, "F");
  doc.setGState(new doc.GState({ opacity: 1 }));

  drawLogo(doc, design, x + 4, y + 4, 11);
  if (design.showQr !== false) drawQrBox(doc, qrDataUrl, x + CARD_W - 18, y + 4, 14);

  drawPhotoPlaceholder(doc, record, x + 4, y + 22, 14, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text((record?.name || "—").slice(0, 24), x + 21, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  const sub =
    targetType === "teachers"
      ? record?.core_subject || "Faculty"
      : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`;
  doc.text(String(sub).slice(0, 32), x + 21, y + 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(design.schoolName || "").slice(0, 36), x + 4, y + CARD_H - 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text(String(design.tagline || "").slice(0, 40), x + 4, y + CARD_H - 4);

  doc.text(
    `Valid ${design.validityYear || "—"}`,
    x + CARD_W - 4,
    y + CARD_H - 4,
    { align: "right" }
  );
}

function drawFrontModern(doc, record, design, targetType, x, y, accent, qrDataUrl) {
  // White background card with accent stripe on the left
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, CARD_W, CARD_H, "F");
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CARD_W, CARD_H);
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(x, y, 4, CARD_H, "F");

  // logo (dark variant)
  if (design.logoImage) {
    drawLogo(doc, design, x + 7, y + 4, 10);
  } else {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x + 7, y + 4, 10, 10, 1.5, 1.5, "F");
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(design.logo || "V", x + 12, y + 10, { align: "center" });
  }

  // school name top right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(String(design.schoolName || "").slice(0, 32), x + 20, y + 8);

  if (design.showQr !== false) drawQrBox(doc, qrDataUrl, x + CARD_W - 18, y + 4, 14, false);

  // photo
  drawPhotoPlaceholder(doc, record, x + 7, y + 22, 14, false);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text((record?.name || "—").slice(0, 22), x + 24, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const sub =
    targetType === "teachers"
      ? record?.core_subject || "Faculty"
      : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`;
  doc.text(String(sub).slice(0, 32), x + 24, y + 33);

  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(String(design.tagline || "").slice(0, 40), x + 7, y + CARD_H - 4);
  doc.text(
    `Valid ${design.validityYear || "—"}`,
    x + CARD_W - 4,
    y + CARD_H - 4,
    { align: "right" }
  );
}

function drawFrontAcademy(doc, record, design, targetType, x, y, accent, qrDataUrl) {
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(x, y, CARD_W, CARD_H, "F");

  // top center logo + name
  drawLogo(doc, design, x + CARD_W / 2 - 5, y + 3, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(
    String(design.schoolName || "").slice(0, 36),
    x + CARD_W / 2,
    y + 18,
    { align: "center" }
  );

  // photo, name, qr in a row
  drawPhotoPlaceholder(doc, record, x + 5, y + 22, 13, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text((record?.name || "—").slice(0, 18), x + 21, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 220, 220);
  const sub =
    targetType === "teachers"
      ? record?.core_subject || "Faculty"
      : `Roll ${record?.roll_no || "—"} · ${record?.class_id || ""}`;
  doc.text(String(sub).slice(0, 28), x + 21, y + 33);

  if (design.showQr !== false) drawQrBox(doc, qrDataUrl, x + CARD_W - 17, y + 22, 13);

  doc.setFontSize(7);
  doc.setTextColor(220, 220, 220);
  doc.text(String(design.tagline || "").slice(0, 50), x + CARD_W / 2, y + CARD_H - 4, {
    align: "center",
  });
}

function drawFront(doc, record, design, targetType, x, y, accent, qrDataUrl) {
  switch (design.template) {
    case "modern":
      return drawFrontModern(doc, record, design, targetType, x, y, accent, qrDataUrl);
    case "academy":
      return drawFrontAcademy(doc, record, design, targetType, x, y, accent, qrDataUrl);
    case "classic":
    default:
      return drawFrontClassic(doc, record, design, targetType, x, y, accent, qrDataUrl);
  }
}

function drawBack(doc, record, design, targetType, x, y, accent) {
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, CARD_W, CARD_H, "F");
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CARD_W, CARD_H);

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Back of card", x + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(
    String(design.schoolName || "").slice(0, 30),
    x + CARD_W - 4,
    y + 6,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);

  const lines =
    targetType === "teachers"
      ? [
          `Phone: ${record?.phone_number || "—"}`,
          `Subject: ${record?.core_subject || "—"}`,
          `Class: ${record?.assigned_class?.name || record?.assigned_class_id || "—"}`,
          `Gender: ${record?.gender || "—"}`,
        ]
      : [
          `Emergency: ${record?.parent_phone || "—"}`,
          `Blood group: ${record?.blood_group || "Not on file"}`,
          `House: ${record?.house || "—"}`,
          `DOB: ${record?.dob || "—"}`,
          `Address: ${(record?.address || "—").slice(0, 38)}`,
        ];

  lines.forEach((l, i) => doc.text(l, x + 4, y + 13 + i * 4.5));

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Valid for academic year ${design.validityYear || "—"}`,
    x + 4,
    y + CARD_H - 8
  );
  doc.text(
    "If found, please return to the school office.",
    x + 4,
    y + CARD_H - 4
  );
}

export async function generateIDCardPDF({
  records,
  design,
  targetType,
  filename = "id-cards.pdf",
  includeBacks = true,
  onProgress,
}) {
  if (!records || records.length === 0) {
    throw new Error("No records to print");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const accent = hexToRgb(design.accent || "#0A1128");

  onProgress?.("Preparing QR codes…");
  const qrCache = design.showQr !== false ? await buildQrCache(records, targetType) : {};

  onProgress?.("Laying out fronts…");
  records.forEach((record, i) => {
    const onPage = i % CARDS_PER_PAGE;
    if (i > 0 && onPage === 0) doc.addPage();
    const col = onPage % COLS;
    const row = Math.floor(onPage / COLS);
    const x = H_MARGIN + col * CARD_W;
    const y = V_MARGIN + row * CARD_H;
    drawFront(
      doc,
      record,
      design,
      targetType,
      x,
      y,
      accent,
      qrCache[record.id || record.user_id]
    );
  });

  if (includeBacks) {
    onProgress?.("Laying out backs…");
    records.forEach((record, i) => {
      const onPage = i % CARDS_PER_PAGE;
      if (onPage === 0) doc.addPage();
      // Mirror column order so duplex-flip aligns backs with fronts
      const col = COLS - 1 - (onPage % COLS);
      const row = Math.floor(onPage / COLS);
      const x = H_MARGIN + col * CARD_W;
      const y = V_MARGIN + row * CARD_H;
      drawBack(doc, record, design, targetType, x, y, accent);
    });
  }

  onProgress?.("Saving PDF…");
  doc.save(filename);
}
