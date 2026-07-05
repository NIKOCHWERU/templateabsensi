import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    location: string,
    name: string
) {
    // 1. Draw Semi-transparent background at bottom 
    // Height depends on resolution. 
    // For 640x480, height 480. Footer 120px.
    // For HD, taller.
    const padding = width * 0.02;
    // Increased footer height for 3 lines (Name, Date, Location)
    const footerHeight = Math.max(70, height * 0.15);

    // Gradient background for better visibility
    const gradient = ctx.createLinearGradient(0, height - footerHeight, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - footerHeight, width, footerHeight);

    // 2. Load and Draw Logo
    try {
        const logo = await new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // Resolve even if error to continue
            img.src = "/logo_elok_buah.jpg";
        });

        let textX = padding;

        if (logo.width > 0) {
            const logoSize = footerHeight * 0.55; // 55% of footer
            // Center logo vertically in footer
            const logoY = height - footerHeight + (footerHeight - logoSize) / 2;
            const logoAspect = logo.width / logo.height;
            const logoWidth = logoSize * logoAspect;

            ctx.drawImage(logo, padding, logoY, logoWidth, logoSize);
            textX = padding + logoWidth + padding;
        }

        // 3. Draw Text
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Font sizes
        // Name is largest, Date medium, Location smallest
        const fontSizeName = Math.max(12, height * 0.035);
        const fontSizeDate = Math.max(10, height * 0.025);
        const fontSizeLocation = Math.max(9, height * 0.022);

        const now = new Date();
        const dateStr = format(now, "EEEE, d MMMM yyyy", { locale: id });
        const timeStr = format(now, "HH:mm:ss", { locale: id });
        const dateTimeStr = `${dateStr} • ${timeStr}`;

        // Positioning
        // We have 3 lines. Divide footer space.
        // Top: Name
        // Middle: Date
        // Bottom: Location

        const contentHeight = footerHeight;
        const startY = height - contentHeight;

        // Line 1: Name (Top)
        ctx.font = `bold ${fontSizeName}px sans-serif`;
        const nameY = startY + (contentHeight * 0.25);
        ctx.fillText(name || "Tenaga Kerja", textX, nameY);

        // Line 2: DateTime (Middle)
        ctx.font = `${fontSizeDate}px sans-serif`;
        const dateY = startY + (contentHeight * 0.55);
        ctx.fillText(dateTimeStr, textX, dateY);

        // Line 3: Location (Bottom)
        ctx.font = `${fontSizeLocation}px sans-serif`;
        const locY = startY + (contentHeight * 0.80);

        const locText = location || "Lokasi tidak tersedia";
        // Simple truncation if too long
        const maxTextWidth = width - textX - padding;
        let displayLoc = locText;
        if (ctx.measureText(locText).width > maxTextWidth) {
            const avgCharWidth = ctx.measureText("A").width;
            const maxChars = Math.floor(maxTextWidth / avgCharWidth);
            displayLoc = locText.substring(0, maxChars - 3) + "...";
        }
        ctx.fillText(displayLoc, textX, locY);

    } catch (e) {
        console.error("Watermark error:", e);
    }
}
