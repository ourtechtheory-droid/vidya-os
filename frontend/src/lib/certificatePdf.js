import jsPDF from "jspdf";
import QRCode from "qrcode";

const PAGE_W = 297;
const PAGE_H = 210;

function hexToRgb(hex) {
  const m = (hex || "#000000").replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}

function imageFmt(dataUrl) {
  if (!dataUrl) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function applyPlaceholders(text, vars) {
  if (!text) return "";
  return text
    .replace(/\{recipient\}/gi, vars.recipient || "")
    .replace(/\{event\}/gi, vars.event || "")
    .replace(/\{date\}/gi, vars.date || "")
    .replace(/\{position\}/gi, vars.position || "")
    .replace(/\{category\}/gi, vars.category || "")
    .replace(/\{score\}/gi, vars.score || "")
    .replace(/\{cert_no\}/gi, vars.cert_no || "")
    .replace(/\{school\}/gi, vars.school || "");
}

function drawBorder(doc, accent, border) {
  const a = hexToRgb(accent);
  doc.setDrawColor(a.r, a.g, a.b);

  if (border === "double") {
    doc.setLineWidth(1.0);
    doc.rect(8, 8, PAGE_W - 16, PAGE_H - 16);
    doc.setLineWidth(0.3);
    doc.rect(11, 11, PAGE_W - 22, PAGE_H - 22);
  } else if (border === "dashed") {
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.rect(8, 8, PAGE_W - 16, PAGE_H - 16);
    doc.setLineDashPattern([], 0);
  } else {
    doc.setLineWidth(0.8);
    doc.rect(8, 8, PAGE_W - 16, PAGE_H - 16);
  }

  // Corner motifs (small accent squares)
  doc.setFillColor(a.r, a.g, a.b);
  [[8, 8], [PAGE_W - 12, 8], [8, PAGE_H - 12], [PAGE_W - 12, PAGE_H - 12]].forEach(
    ([x, y]) => doc.rect(x, y, 4, 4, "F")
  );
}

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text || "", maxWidth);
}

function drawSignatures(doc, signatures, y) {
  if (!signatures || signatures.length === 0) return;
  const n = Math.min(signatures.length, 3);
  const slots = n;
  const spanW = (PAGE_W - 60) / slots;
  doc.setTextColor(40, 40, 40);
  for (let i = 0; i < n; i += 1) {
    const sig = signatures[i] || {};
    const cx = 30 + spanW * (i + 0.5);
    if (sig.signatureImage) {
      try {
        const w = 40;
        const h = 18;
        doc.addImage(
          sig.signatureImage,
          imageFmt(sig.signatureImage),
          cx - w / 2,
          y - h - 1,
          w,
          h
        );
      } catch (_) {
        /* ignore */
      }
    }
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(cx - 25, y, cx + 25, y);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(sig.name || "—", cx, y + 5, { align: "center" });
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(sig.role || "", cx, y + 9, { align: "center" });
    doc.setTextColor(40, 40, 40);
  }
}

async function drawSinglePage(doc, issuance, design) {
  const accent = hexToRgb(design.accent || "#0A1128");
  drawBorder(doc, design.accent, design.border);

  // School name top
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(
    String(design.schoolName || "").slice(0, 60),
    PAGE_W / 2,
    24,
    { align: "center" }
  );
  if (design.schoolNameLocal) {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(
      String(design.schoolNameLocal).slice(0, 60),
      PAGE_W / 2,
      31,
      { align: "center" }
    );
  }
  if (design.tagline) {
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      String(design.tagline).slice(0, 80),
      PAGE_W / 2,
      design.schoolNameLocal ? 37 : 31,
      { align: "center" }
    );
  }

  // Logo top left
  if (design.logoImage) {
    try {
      doc.addImage(design.logoImage, imageFmt(design.logoImage), 18, 18, 20, 20);
    } catch (_) {
      /* ignore */
    }
  }

  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(
    String(design.title || "Certificate of Achievement").slice(0, 50),
    PAGE_W / 2,
    62,
    { align: "center" }
  );

  // Subtitle
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("is hereby awarded to", PAGE_W / 2, 78, { align: "center" });

  // Recipient
  doc.setFont("times", "bolditalic");
  doc.setFontSize(34);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(
    String(issuance.recipient_name || "—").slice(0, 40),
    PAGE_W / 2,
    98,
    { align: "center" }
  );
  // underline
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.4);
  doc.line(60, 102, PAGE_W - 60, 102);

  // Body
  const vars = {
    recipient: issuance.recipient_name,
    event: issuance.event_name,
    date: issuance.event_date,
    position: issuance.position,
    category: issuance.category,
    score: issuance.score,
    cert_no: issuance.cert_no,
    school: design.schoolName,
  };
  const bodyTemplate =
    issuance.body_override ||
    design.body ||
    "For outstanding performance and dedication.";
  const body = applyPlaceholders(bodyTemplate, vars);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  const wrapped = wrapText(doc, body, PAGE_W - 80);
  wrapped.slice(0, 4).forEach((line, i) => {
    doc.text(line, PAGE_W / 2, 115 + i * 6, { align: "center" });
  });

  // Event/position/date line
  const eventParts = [];
  if (issuance.event_name) eventParts.push(issuance.event_name);
  if (issuance.position) eventParts.push(`Position: ${issuance.position}`);
  if (issuance.category) eventParts.push(issuance.category);
  if (issuance.event_date) eventParts.push(issuance.event_date);
  if (issuance.score) eventParts.push(`Score: ${issuance.score}`);
  if (eventParts.length > 0) {
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(eventParts.join("  ·  "), PAGE_W / 2, 145, { align: "center" });
  }

  // Signatures
  drawSignatures(doc, design.signatures, 170);

  // School seal bottom-right
  if (design.schoolSeal) {
    try {
      doc.addImage(
        design.schoolSeal,
        imageFmt(design.schoolSeal),
        PAGE_W - 50,
        PAGE_H - 50,
        32,
        32
      );
    } catch (_) {
      /* ignore */
    }
  }

  // Cert no + verification QR + issued date bottom-left
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(`Certificate No.`, 18, PAGE_H - 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(issuance.cert_no || "—", 18, PAGE_H - 30);
  if (issuance.issued_at) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const dt = new Date(issuance.issued_at).toLocaleDateString("en-IN");
    doc.text(`Issued: ${dt}`, 18, PAGE_H - 25);
  }

  const verifyUrl = `https://vidya-os.app/verify/${issuance.id}`;
  try {
    const qrData = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 0,
      width: 200,
    });
    doc.addImage(qrData, "PNG", 18, PAGE_H - 22, 14, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("Scan to verify", 34, PAGE_H - 14);
  } catch (_) {
    /* ignore */
  }

  // "REVOKED" overlay if revoked
  if (issuance.status === "revoked") {
    doc.setTextColor(200, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setGState(new doc.GState({ opacity: 0.25 }));
    // jsPDF doesn't have native rotate-and-translate; place diagonally via angle
    doc.text("REVOKED", PAGE_W / 2, PAGE_H / 2, {
      align: "center",
      angle: 25,
    });
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
}

export async function generateCertificatePDF({
  issuance,
  design,
  filename,
  onProgress,
}) {
  onProgress?.("Generating PDF…");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  await drawSinglePage(doc, issuance, design || issuance.design_snapshot || {});
  doc.save(filename || `certificate-${issuance.cert_no || issuance.id}.pdf`);
}

export async function generateBulkCertificatePDF({
  issuances,
  design,
  filename = "certificates.pdf",
  onProgress,
}) {
  if (!issuances || issuances.length === 0) throw new Error("No certificates");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  for (let i = 0; i < issuances.length; i += 1) {
    if (i > 0) doc.addPage("a4", "landscape");
    onProgress?.(`Page ${i + 1} of ${issuances.length}…`);
    await drawSinglePage(doc, issuances[i], design || issuances[i].design_snapshot || {});
  }
  doc.save(filename);
}
