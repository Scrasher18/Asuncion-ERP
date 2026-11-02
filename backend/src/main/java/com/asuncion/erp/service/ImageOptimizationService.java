package com.asuncion.erp.service;

import com.asuncion.erp.exception.BadRequestException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

@Service
public class ImageOptimizationService {

    private static final Logger log = LoggerFactory.getLogger(ImageOptimizationService.class);
    private static final int MAX_DIMENSION = 1280;

    public record OptimizedImage(
            byte[] bytes,
            String mimeType,
            String extension
    ) {
    }

    @PostConstruct
    public void init() {
        ImageIO.scanForPlugins();
    }

    public OptimizedImage optimize(InputStream inputStream) {
        try {
            BufferedImage source = ImageIO.read(inputStream);
            if (source == null) {
                throw new BadRequestException("El archivo proporcionado no es una imagen válida (formatos soportados: JPG, PNG, WebP).");
            }
            return optimizeBufferedImage(source);
        } catch (IOException e) {
            throw new BadRequestException("No se pudo procesar el archivo de imagen: " + e.getMessage());
        }
    }

    public OptimizedImage optimize(byte[] rawBytes) {
        return optimize(new ByteArrayInputStream(rawBytes));
    }

    public OptimizedImage optimizeBufferedImage(BufferedImage source) {
        BufferedImage resized = resizePreservingAspectRatio(source, MAX_DIMENSION);

        // 1. Primary path: Encode modern WebP format via webp-imageio SPI
        try {
            ByteArrayOutputStream webpOut = new ByteArrayOutputStream();
            boolean written = ImageIO.write(resized, "webp", webpOut);
            if (written && webpOut.size() > 0) {
                return new OptimizedImage(webpOut.toByteArray(), "image/webp", ".webp");
            }
        } catch (Throwable t) {
            log.debug("Native WebP encoder unavailable on host ({}); falling back to optimized JPEG.", t.getMessage());
        }

        // 2. Resilient fallback path: Optimized progressive JPEG (82% quality) so uploads never fail on minimal containers
        try {
            ByteArrayOutputStream jpgOut = new ByteArrayOutputStream();
            Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
            if (writers.hasNext()) {
                ImageWriter writer = writers.next();
                try (ImageOutputStream ios = ImageIO.createImageOutputStream(jpgOut)) {
                    writer.setOutput(ios);
                    ImageWriteParam param = writer.getDefaultWriteParam();
                    if (param.canWriteCompressed()) {
                        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                        param.setCompressionQuality(0.82f);
                    }
                    writer.write(null, new IIOImage(resized, null, null), param);
                } finally {
                    writer.dispose();
                }
                if (jpgOut.size() > 0) {
                    return new OptimizedImage(jpgOut.toByteArray(), "image/jpeg", ".jpg");
                }
            }

            ByteArrayOutputStream pngOut = new ByteArrayOutputStream();
            ImageIO.write(resized, "png", pngOut);
            return new OptimizedImage(pngOut.toByteArray(), "image/png", ".png");
        } catch (IOException e) {
            throw new BadRequestException("Error durante la compresión de imagen: " + e.getMessage());
        }
    }

    private BufferedImage resizePreservingAspectRatio(BufferedImage source, int maxDimension) {
        int origWidth = source.getWidth();
        int origHeight = source.getHeight();

        int targetWidth = origWidth;
        int targetHeight = origHeight;

        if (origWidth > maxDimension || origHeight > maxDimension) {
            double ratio = Math.min((double) maxDimension / origWidth, (double) maxDimension / origHeight);
            targetWidth = Math.max(1, (int) Math.round(origWidth * ratio));
            targetHeight = Math.max(1, (int) Math.round(origHeight * ratio));
        }

        BufferedImage rgbImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = rgbImage.createGraphics();
        try {
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setColor(Color.WHITE);
            g2d.fillRect(0, 0, targetWidth, targetHeight);
            g2d.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g2d.dispose();
        }
        return rgbImage;
    }

    /**
     * Generates a clean, bright white-studio automotive spare part product render (960x720)
     * with brushed-metal shading and signature automotive orange (#EA580C) mechanical details.
     */
    public OptimizedImage generateAutomotivePartIllustration(
            String sku,
            String oemCode,
            String partName,
            String brandName,
            String categoryCode
    ) {
        int width = 960;
        int height = 720;
        BufferedImage canvas = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // Clean bright studio cyclorama backdrop (white center -> soft neutral gray edges)
            g.setColor(new Color(246, 247, 249));
            g.fillRect(0, 0, width, height);

            RadialGradientPaint studioLight = new RadialGradientPaint(
                    new Point(width / 2, height / 2 - 20),
                    460f,
                    new float[]{0f, 0.72f, 1f},
                    new Color[]{Color.WHITE, new Color(250, 250, 251), new Color(241, 243, 246)}
            );
            g.setPaint(studioLight);
            g.fillRect(0, 0, width, height);

            Color brandOrange = new Color(234, 88, 12); // #EA580C

            // Soft realistic floor contact shadow beneath the spare part
            int cx = width / 2;
            int cy = height / 2 - 8;
            RadialGradientPaint floorShadow = new RadialGradientPaint(
                    new Point(cx, cy + 178),
                    195f,
                    new float[]{0f, 1f},
                    new Color[]{new Color(17, 24, 39, 34), new Color(17, 24, 39, 0)}
            );
            g.setPaint(floorShadow);
            g.fillOval(cx - 195, cy + 152, 390, 52);

            // Draw clean studio mechanical component
            drawCategoryMechanicalVector(g, cx, cy, brandOrange, categoryCode);

            // Subtle, authentic top-left manufacturer watermark (no cluttered banners)
            if (brandName != null && !brandName.isBlank()) {
                g.setColor(new Color(234, 88, 12));
                g.fillRoundRect(44, 42, 5, 22, 3, 3);
                g.setColor(new Color(55, 65, 81));
                g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 17));
                g.drawString(brandName.toUpperCase(), 58, 59);
            }

            // Discreet bottom-right part reference code
            if (oemCode != null && !oemCode.isBlank()) {
                g.setColor(new Color(156, 163, 175));
                g.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 14));
                String ref = "REF " + oemCode;
                FontMetrics fm = g.getFontMetrics();
                g.drawString(ref, width - fm.stringWidth(ref) - 44, height - 38);
            }
        } finally {
            g.dispose();
        }
        return optimizeBufferedImage(canvas);
    }

    private void drawCategoryMechanicalVector(Graphics2D g, int cx, int cy, Color orange, String categoryCode) {
        String code = categoryCode != null ? categoryCode.toUpperCase() : "";

        if ("FRENOS".equals(code)) {
            // Brushed steel ventilated brake disc + precision orange caliper
            GradientPaint steelDisc = new GradientPaint(
                    cx - 155, cy - 155, new Color(226, 232, 240),
                    cx + 155, cy + 155, new Color(148, 163, 184)
            );
            g.setPaint(steelDisc);
            g.fill(new Ellipse2D.Double(cx - 155, cy - 155, 310, 310));

            g.setColor(new Color(203, 213, 225));
            g.setStroke(new BasicStroke(2.5f));
            g.draw(new Ellipse2D.Double(cx - 155, cy - 155, 310, 310));
            g.draw(new Ellipse2D.Double(cx - 125, cy - 125, 250, 250));

            // Center hub hat (dark anodized graphite)
            g.setColor(new Color(55, 65, 81));
            g.fill(new Ellipse2D.Double(cx - 72, cy - 72, 144, 144));
            g.setColor(new Color(243, 244, 246));
            g.fill(new Ellipse2D.Double(cx - 28, cy - 28, 56, 56));

            // Cross-drilled ventilation slots
            g.setColor(new Color(100, 116, 139));
            for (int i = 0; i < 16; i++) {
                double angle = Math.toRadians(i * 22.5);
                int hx1 = cx + (int) (Math.cos(angle) * 98);
                int hy1 = cy + (int) (Math.sin(angle) * 98);
                int hx2 = cx + (int) (Math.cos(angle + 0.12) * 132);
                int hy2 = cy + (int) (Math.sin(angle + 0.12) * 132);
                g.fillOval(hx1 - 4, hy1 - 4, 8, 8);
                g.fillOval(hx2 - 4, hy2 - 4, 8, 8);
            }

            // 5 wheel stud holes
            g.setColor(new Color(229, 231, 235));
            for (int i = 0; i < 5; i++) {
                double angle = Math.toRadians(i * 72);
                int bx = cx + (int) (Math.cos(angle) * 48);
                int by = cy + (int) (Math.sin(angle) * 48);
                g.fillOval(bx - 7, by - 7, 14, 14);
            }

            // Forged automotive orange brake caliper
            GradientPaint caliperPaint = new GradientPaint(
                    cx + 68, cy - 105, new Color(249, 115, 22),
                    cx + 160, cy + 75, orange
            );
            g.setPaint(caliperPaint);
            g.fillRoundRect(cx + 68, cy - 102, 92, 174, 34, 34);
            g.setColor(new Color(194, 65, 12));
            g.setStroke(new BasicStroke(2f));
            g.drawRoundRect(cx + 68, cy - 102, 92, 174, 34, 34);

            // Caliper pistons / bolt details
            g.setColor(new Color(255, 237, 213));
            g.fillOval(cx + 104, cy - 68, 16, 16);
            g.fillOval(cx + 104, cy + 22, 16, 16);
        } else if ("FILTROS".equals(code)) {
            // Pleated automotive filter cartridge with orange silicone seal & graphite caps
            g.setColor(new Color(55, 65, 81));
            g.fillRoundRect(cx - 106, cy - 140, 212, 34, 14, 14);
            g.fillRoundRect(cx - 106, cy + 106, 212, 34, 14, 14);

            // Orange upper gasket seal
            g.setColor(orange);
            g.fillRoundRect(cx - 96, cy - 150, 192, 14, 8, 8);

            // Clean pleated filter media
            GradientPaint mediaPaint = new GradientPaint(
                    cx - 96, cy, new Color(254, 243, 199),
                    cx + 96, cy, new Color(253, 224, 71)
            );
            g.setPaint(mediaPaint);
            g.fillRoundRect(cx - 96, cy - 106, 192, 212, 8, 8);

            g.setColor(new Color(217, 119, 6, 95));
            g.setStroke(new BasicStroke(2f));
            for (int x = cx - 82; x <= cx + 82; x += 14) {
                g.drawLine(x, cy - 104, x, cy + 104);
            }

            // Outer perforated metal cage band
            g.setColor(new Color(226, 232, 240));
            g.fillRect(cx - 96, cy - 22, 192, 44);
            g.setColor(orange);
            g.fillRect(cx - 96, cy - 3, 192, 6);
        } else if ("SUSPENSION".equals(code)) {
            // Chrome piston rod + graphite damper body + heavy-duty orange coil spring
            g.setColor(new Color(203, 213, 225));
            g.fillRoundRect(cx - 14, cy - 162, 28, 175, 10, 10);

            // Top & bottom mounting bushings
            g.setColor(new Color(55, 65, 81));
            g.fillOval(cx - 24, cy - 178, 48, 32);
            g.fillOval(cx - 24, cy + 142, 48, 32);
            g.setColor(Color.WHITE);
            g.fillOval(cx - 10, cy - 170, 20, 16);
            g.fillOval(cx - 10, cy + 150, 20, 16);

            // Lower damper cylinder
            GradientPaint bodyPaint = new GradientPaint(
                    cx - 40, cy, new Color(75, 85, 99),
                    cx + 40, cy, new Color(31, 41, 55)
            );
            g.setPaint(bodyPaint);
            g.fillRoundRect(cx - 38, cy + 4, 76, 146, 16, 16);
            g.setColor(new Color(107, 114, 128));
            g.fillRoundRect(cx - 56, cy + 4, 112, 14, 6, 6);

            // Progressive orange coilover spring coils
            g.setColor(orange);
            g.setStroke(new BasicStroke(14f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            for (int y = cy - 112; y <= cy - 8; y += 32) {
                g.drawLine(cx - 58, y, cx + 58, y + 18);
            }
        } else {
            // Precision machined steel clutch/gear/engine assembly with orange bearing seal
            GradientPaint outerSteel = new GradientPaint(
                    cx - 140, cy - 140, new Color(226, 232, 240),
                    cx + 140, cy + 140, new Color(148, 163, 184)
            );
            g.setPaint(outerSteel);
            for (int i = 0; i < 16; i++) {
                double angle = Math.toRadians(i * 22.5);
                int tx = cx + (int) (Math.cos(angle) * 142);
                int ty = cy + (int) (Math.sin(angle) * 142);
                g.fillOval(tx - 16, ty - 16, 32, 32);
            }
            g.fill(new Ellipse2D.Double(cx - 134, cy - 134, 268, 268));

            g.setColor(new Color(71, 85, 105));
            g.fill(new Ellipse2D.Double(cx - 94, cy - 94, 188, 188));

            // Orange precision seal ring
            g.setColor(orange);
            g.fill(new Ellipse2D.Double(cx - 72, cy - 72, 144, 144));

            // Inner machined spline hub
            g.setColor(new Color(226, 232, 240));
            g.fill(new Ellipse2D.Double(cx - 52, cy - 52, 104, 104));
            g.setColor(Color.WHITE);
            g.fill(new Ellipse2D.Double(cx - 26, cy - 26, 52, 52));
        }
    }
}
