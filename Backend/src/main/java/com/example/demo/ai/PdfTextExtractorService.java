package com.example.demo.ai;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Slf4j
@Service
public class PdfTextExtractorService {

    private static final int MAX_CHARS = 12000; // API 토큰 한도 고려

    public String extractText(byte[] pdfBytes) {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return "";
        }
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String full = stripper.getText(doc);
            if (full == null) return "";
            String trimmed = full.trim();
            if (trimmed.length() > MAX_CHARS) {
                trimmed = trimmed.substring(0, MAX_CHARS) + "\n\n[... 내용이 잘렸습니다 ...]";
            }
            return trimmed;
        } catch (IOException e) {
            log.warn("PDF 텍스트 추출 실패: {}", e.getMessage());
            throw new RuntimeException("PDF 내용을 읽을 수 없습니다. (스캔된 PDF는 아직 지원하지 않습니다.)");
        }
    }
}
