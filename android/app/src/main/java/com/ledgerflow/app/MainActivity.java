package com.ledgerflow.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new LedgerFlowPdfBridge(), "LedgerFlowPdfBridge");
        }
    }

    private class LedgerFlowPdfBridge {
        private Uri lastSavedUri;

        @JavascriptInterface
        public String saveReport(String reportJson, String fileName) {
            try {
                String savedTo = savePdfToDownloads(createReportPdf(reportJson), sanitizeFileName(fileName));
                showToast("PDF saved to " + savedTo);
                return "OK";
            } catch (Exception error) {
                showToast("Unable to save PDF");
                return "ERROR: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String shareReport(String reportJson, String fileName) {
            try {
                File pdfFile = writePdfToCache(createReportPdf(reportJson), sanitizeFileName(fileName));
                shareFile(pdfFile);
                return "OK";
            } catch (Exception error) {
                showToast("Unable to share PDF");
                return "ERROR: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String openLastSavedPdf() {
            try {
                if (lastSavedUri == null) {
                    return "ERROR: No saved PDF is available yet";
                }

                Intent openIntent = new Intent(Intent.ACTION_VIEW);
                openIntent.setDataAndType(lastSavedUri, "application/pdf");
                openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> startActivity(Intent.createChooser(openIntent, "Open PDF")));
                return "OK";
            } catch (Exception error) {
                showToast("Unable to open saved PDF");
                return "ERROR: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String savePdf(String base64Pdf, String fileName) {
            try {
                String savedTo = savePdfToDownloads(decodePdf(base64Pdf), sanitizeFileName(fileName));
                showToast("PDF saved to " + savedTo);
                return "OK";
            } catch (Exception error) {
                showToast("Unable to save PDF");
                return "ERROR: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String sharePdf(String base64Pdf, String fileName) {
            try {
                File pdfFile = writePdfToCache(decodePdf(base64Pdf), sanitizeFileName(fileName));
                shareFile(pdfFile);
                return "OK";
            } catch (Exception error) {
                showToast("Unable to share PDF");
                return "ERROR: " + error.getMessage();
            }
        }

        private byte[] createReportPdf(String reportJson) throws Exception {
            JSONObject report = new JSONObject(reportJson);
            String title = report.optString("title", "LedgerFlow Report");
            String generatedAt = report.optString("generatedAt", "");
            String source = report.optString("source", "");
            JSONArray sections = report.optJSONArray("sections");

            PdfDocument document = new PdfDocument();
            int pageWidth = 595;
            int pageHeight = 842;
            int margin = 42;
            int pageNumber = 1;

            Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            titlePaint.setColor(Color.parseColor("#111827"));
            titlePaint.setTextSize(22);
            titlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

            Paint metaPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            metaPaint.setColor(Color.parseColor("#4B5563"));
            metaPaint.setTextSize(9);

            Paint sectionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            sectionPaint.setColor(Color.parseColor("#1A73E8"));
            sectionPaint.setTextSize(13);
            sectionPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

            Paint bodyPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            bodyPaint.setColor(Color.parseColor("#1F2937"));
            bodyPaint.setTextSize(10);

            PdfDocument.Page page = startPage(document, pageWidth, pageHeight, pageNumber);
            Canvas canvas = page.getCanvas();
            int y = drawHeader(canvas, title, generatedAt, source, titlePaint, metaPaint, margin, pageWidth);

            if (sections == null || sections.length() == 0) {
                y = drawWrappedText(canvas, "No report content is available.", bodyPaint, margin, y, pageWidth - (margin * 2), 15);
            } else {
                for (int sectionIndex = 0; sectionIndex < sections.length(); sectionIndex++) {
                    JSONObject section = sections.getJSONObject(sectionIndex);
                    String heading = section.optString("heading", "Section");
                    JSONArray lines = section.optJSONArray("lines");

                    if (y > pageHeight - 105) {
                        drawFooter(canvas, pageNumber, pageWidth, pageHeight, metaPaint);
                        document.finishPage(page);
                        pageNumber++;
                        page = startPage(document, pageWidth, pageHeight, pageNumber);
                        canvas = page.getCanvas();
                        y = drawHeader(canvas, title, generatedAt, source, titlePaint, metaPaint, margin, pageWidth);
                    }

                    y += 10;
                    canvas.drawText(heading, margin, y, sectionPaint);
                    y += 12;
                    drawSectionRule(canvas, margin, y, pageWidth - margin);
                    y += 13;

                    if (lines == null || lines.length() == 0) {
                        y = drawWrappedText(canvas, "No details available.", bodyPaint, margin, y, pageWidth - (margin * 2), 14);
                    } else {
                        for (int lineIndex = 0; lineIndex < lines.length(); lineIndex++) {
                            if (y > pageHeight - 72) {
                                drawFooter(canvas, pageNumber, pageWidth, pageHeight, metaPaint);
                                document.finishPage(page);
                                pageNumber++;
                                page = startPage(document, pageWidth, pageHeight, pageNumber);
                                canvas = page.getCanvas();
                                y = drawHeader(canvas, title, generatedAt, source, titlePaint, metaPaint, margin, pageWidth);
                            }

                            y = drawWrappedText(canvas, lines.optString(lineIndex), bodyPaint, margin + 8, y, pageWidth - (margin * 2) - 8, 14);
                            y += 3;
                        }
                    }
                }
            }

            drawFooter(canvas, pageNumber, pageWidth, pageHeight, metaPaint);
            document.finishPage(page);

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.writeTo(output);
            document.close();
            return output.toByteArray();
        }

        private PdfDocument.Page startPage(PdfDocument document, int width, int height, int pageNumber) {
            PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(width, height, pageNumber).create();
            PdfDocument.Page page = document.startPage(pageInfo);
            Canvas canvas = page.getCanvas();
            Paint background = new Paint();
            background.setColor(Color.WHITE);
            canvas.drawRect(0, 0, width, height, background);

            Paint blue = new Paint(Paint.ANTI_ALIAS_FLAG);
            blue.setColor(Color.parseColor("#1A73E8"));
            canvas.drawRoundRect(new RectF(30, 26, width - 30, 88), 12, 12, blue);

            return page;
        }

        private int drawHeader(
            Canvas canvas,
            String title,
            String generatedAt,
            String source,
            Paint titlePaint,
            Paint metaPaint,
            int margin,
            int pageWidth
        ) {
            Paint whiteTitle = new Paint(titlePaint);
            whiteTitle.setColor(Color.WHITE);
            canvas.drawText("LedgerFlow", margin, 54, whiteTitle);

            Paint whiteMeta = new Paint(metaPaint);
            whiteMeta.setColor(Color.parseColor("#EAF2FF"));
            canvas.drawText(title, margin, 75, whiteMeta);

            int y = 116;
            canvas.drawText("Generated: " + generatedAt, margin, y, metaPaint);
            y += 14;
            if (!source.trim().isEmpty()) {
                canvas.drawText("Source: " + source, margin, y, metaPaint);
                y += 18;
            }

            Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
            line.setColor(Color.parseColor("#D1D5DB"));
            line.setStrokeWidth(1);
            canvas.drawLine(margin, y, pageWidth - margin, y, line);
            return y + 18;
        }

        private void drawFooter(Canvas canvas, int pageNumber, int pageWidth, int pageHeight, Paint paint) {
            canvas.drawText("Page " + pageNumber, pageWidth - 84, pageHeight - 32, paint);
        }

        private void drawSectionRule(Canvas canvas, int left, int y, int right) {
            Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
            line.setColor(Color.parseColor("#E5E7EB"));
            line.setStrokeWidth(1);
            canvas.drawLine(left, y, right, y, line);
        }

        private int drawWrappedText(Canvas canvas, String text, Paint paint, int x, int y, int maxWidth, int lineHeight) {
            List<String> lines = wrapText(text, paint, maxWidth);
            for (String line : lines) {
                canvas.drawText(line, x, y, paint);
                y += lineHeight;
            }
            return y;
        }

        private List<String> wrapText(String text, Paint paint, int maxWidth) {
            List<String> lines = new ArrayList<>();
            String[] words = text.replaceAll("\\s+", " ").trim().split(" ");
            String current = "";

            for (String word : words) {
                String next = current.isEmpty() ? word : current + " " + word;
                if (paint.measureText(next) > maxWidth && !current.isEmpty()) {
                    lines.add(current);
                    current = word;
                } else {
                    current = next;
                }
            }

            if (!current.isEmpty()) {
                lines.add(current);
            }
            return lines;
        }

        private void shareFile(File pdfFile) {
            Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", pdfFile);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/pdf");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "LedgerFlow PDF report");
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            List<ResolveInfo> resolvedActivities = getPackageManager().queryIntentActivities(shareIntent, 0);
            for (ResolveInfo info : resolvedActivities) {
                grantUriPermission(info.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            Intent chooser = Intent.createChooser(shareIntent, "Share PDF");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            runOnUiThread(() -> startActivity(chooser));
        }

        private byte[] decodePdf(String base64Pdf) {
            String clean = base64Pdf;
            int commaIndex = clean.indexOf(',');
            if (commaIndex >= 0) {
                clean = clean.substring(commaIndex + 1);
            }
            return Base64.decode(clean, Base64.DEFAULT);
        }

        private String sanitizeFileName(String fileName) {
            String fallback = "LedgerFlow-report.pdf";
            String next = fileName == null || fileName.trim().isEmpty() ? fallback : fileName.trim();
            next = next.replaceAll("[^A-Za-z0-9._-]", "-");
            if (!next.toLowerCase(Locale.US).endsWith(".pdf")) {
                next += ".pdf";
            }
            return next;
        }

        private String savePdfToDownloads(byte[] pdfBytes, String fileName) throws Exception {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/LedgerFlow");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    throw new IllegalStateException("Could not create Downloads entry");
                }

                try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                    if (outputStream == null) {
                        throw new IllegalStateException("Could not open PDF output stream");
                    }
                    outputStream.write(pdfBytes);
                }

                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                lastSavedUri = uri;
                return "Downloads/LedgerFlow";
            }

            File downloadsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "LedgerFlow");
            if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
                downloadsDir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "LedgerFlow");
                if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
                    throw new IllegalStateException("Could not create download folder");
                }
            }

            File output = uniqueFile(downloadsDir, fileName);
            try (FileOutputStream stream = new FileOutputStream(output)) {
                stream.write(pdfBytes);
            }
            MediaScannerConnection.scanFile(MainActivity.this, new String[] { output.getAbsolutePath() }, new String[] { "application/pdf" }, null);
            lastSavedUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", output);
            return output.getAbsolutePath();
        }

        private File writePdfToCache(byte[] pdfBytes, String fileName) throws Exception {
            File shareDir = new File(getCacheDir(), "shared_pdfs");
            if (!shareDir.exists() && !shareDir.mkdirs()) {
                throw new IllegalStateException("Could not create share cache");
            }

            File output = uniqueFile(shareDir, fileName);
            try (FileOutputStream stream = new FileOutputStream(output)) {
                stream.write(pdfBytes);
            }
            return output;
        }

        private File uniqueFile(File directory, String fileName) {
            File output = new File(directory, fileName);
            if (!output.exists()) {
                return output;
            }

            String baseName = fileName.replaceFirst("(?i)\\.pdf$", "");
            int index = 2;
            do {
                output = new File(directory, baseName + "-" + index + ".pdf");
                index++;
            } while (output.exists());
            return output;
        }

        private void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
        }
    }
}
