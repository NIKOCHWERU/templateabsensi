import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    location: string,
    name: string,
    namaPt?: string,
    logoUrl?: string,
) {
    const padding = Math.max(10, width * 0.025);

    // Footer height — taller to accommodate logo + 4 lines of text
    const footerHeight = Math.max(90, height * 0.20);
    const footerY = height - footerHeight;

    // ── Background Gradient ──────────────────────────────────────────────────
    const gradient = ctx.createLinearGradient(0, footerY, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.0)");
    gradient.addColorStop(0.3, "rgba(0, 0, 0, 0.65)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.88)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, footerY, width, footerHeight);

    const now = new Date();
    const timeStr   = format(now, "HH:mm:ss");
    const dateStr   = format(now, "EEEE, d MMMM yyyy", { locale: id });
    const companyLabel = `Absensi ${namaPt || "Perusahaan"}`;

    // ── Font Size Scale ──────────────────────────────────────────────────────
    const fTime     = Math.max(18, height * 0.060);  // Big bold time
    const fCompany  = Math.max(10, height * 0.025);  // "Absensi PT …"
    const fName     = Math.max(11, height * 0.030);  // Employee name
    const fDate     = Math.max(9,  height * 0.022);  // Date
    const fLoc      = Math.max(8,  height * 0.019);  // Location (smallest)

    // ── Load Logo ────────────────────────────────────────────────────────────
    const resolvedLogoUrl = logoUrl && logoUrl.trim() && !logoUrl.startsWith("http")
        ? logoUrl
        : (logoUrl || "/logo_elok_buah.jpg");

    let logoImg: HTMLImageElement | null = null;
    try {
        logoImg = await new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = resolvedLogoUrl;
        });
        if (!logoImg.width) logoImg = null;
    } catch { logoImg = null; }

    // ── Draw Logo (left, vertically centred in footer) ───────────────────────
    const logoSize   = footerHeight * 0.70;
    const logoCentreY = footerY + footerHeight / 2;

    let textX = padding;

    if (logoImg) {
        const aspect   = logoImg.width / logoImg.height;
        const logoW    = logoSize * aspect;
        const logoX    = padding;
        const logoY    = logoCentreY - logoSize / 2;

        // Circular clip for logo
        ctx.save();
        ctx.beginPath();
        const cx = logoX + logoW / 2;
        const cy = logoY + logoSize / 2;
        const r  = Math.min(logoW, logoSize) / 2;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoSize);
        ctx.restore();

        textX = logoX + logoW + padding * 1.5;
    }

    // ── Divider line between logo and text ───────────────────────────────────
    if (logoImg) {
        ctx.strokeStyle = "rgba(255,255,255,0.30)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(textX - padding * 0.5, footerY + padding * 0.8);
        ctx.lineTo(textX - padding * 0.5, height - padding * 0.8);
        ctx.stroke();
    }

    // ── Text Columns ─────────────────────────────────────────────────────────
    ctx.textAlign  = "left";
    ctx.textBaseline = "alphabetic";

    // Vertical rhythm — 4 lines packed in footerHeight
    const lineSpacing = footerHeight / 5;
    const baseY = footerY + lineSpacing * 0.9;

    // Line 1: Jam Absensi — Big & Bold
    ctx.font      = `900 ${fTime}px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur  = 4;
    ctx.fillText(timeStr, textX, baseY + lineSpacing * 0);

    // Line 2: "Absensi PT …"
    ctx.font      = `600 ${fCompany}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.shadowBlur = 2;
    ctx.fillText(companyLabel, textX, baseY + lineSpacing * 1.1);

    // Line 3: Employee Name
    ctx.font      = `bold ${fName}px Arial, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 3;
    ctx.fillText(name || "Tenaga Kerja", textX, baseY + lineSpacing * 2.2);

    // Line 4: Full Date
    ctx.font      = `${fDate}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.shadowBlur = 2;
    ctx.fillText(dateStr, textX, baseY + lineSpacing * 3.15);

    // Line 5: Location (optional, truncated)
    if (location) {
        ctx.shadowBlur = 1;
        ctx.font      = `${fLoc}px Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        const maxW = width - textX - padding;
        let loc = location;
        while (ctx.measureText(loc).width > maxW && loc.length > 10) {
            loc = loc.slice(0, -4) + "…";
        }
        ctx.fillText(loc, textX, baseY + lineSpacing * 4.0);
    }

    // Reset shadow
    ctx.shadowBlur  = 0;
    ctx.shadowColor = "transparent";
}
