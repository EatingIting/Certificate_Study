package com.example.demo.ai;

import com.example.demo.assignment.dto.AssignmentSubmissionFileDto;
import com.example.demo.assignment.mapper.AssignmentMapper;
import com.example.demo.chat.service.OpenAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiSubmissionService {

    private final AssignmentMapper assignmentMapper;
    private final FileDownloadService fileDownloadService;
    private final PdfTextExtractorService pdfTextExtractorService;
    private final OpenAiService openAiService;

    public String chatWithSubmission(Long submissionId, String userMessage) {
        AssignmentSubmissionFileDto fileInfo = assignmentMapper.selectSubmissionFileBySubmissionId(submissionId);
        if (fileInfo == null || fileInfo.getFileUrl() == null || fileInfo.getFileUrl().isBlank()) {
            return "해당 제출물을 찾을 수 없거나 파일이 없습니다.";
        }

        String fileUrl = fileInfo.getFileUrl();
        String fileName = fileInfo.getFileName() != null ? fileInfo.getFileName() : "";

        byte[] bytes = fileDownloadService.download(fileUrl);
        String message = userMessage != null && !userMessage.isBlank() ? userMessage : "이 제출물을 보고 요약하거나 피드백해줘.";

        if (FileDownloadService.isImage(fileName)) {
            String mediaType = "image/jpeg";
            if (fileName.toLowerCase().endsWith(".png")) mediaType = "image/png";
            else if (fileName.toLowerCase().endsWith(".gif")) mediaType = "image/gif";
            else if (fileName.toLowerCase().endsWith(".webp")) mediaType = "image/webp";
            return openAiService.getContentsWithImage(bytes, mediaType, message);
        }

        if (FileDownloadService.isPdf(fileName)) {
            String extractedText = pdfTextExtractorService.extractText(bytes);
            if (extractedText == null || extractedText.isBlank()) {
                return "이 PDF에서 텍스트를 추출할 수 없습니다. (스캔된 PDF는 아직 지원하지 않습니다.)";
            }
            String prompt = "다음은 학습자가 제출한 과제(PDF) 내용입니다.\n\n---\n\n" + extractedText + "\n\n---\n\n사용자 질문: " + message;
            return openAiService.getContents(prompt);
        }

        return "지원하는 형식이 아닙니다. 이미지(jpeg, png 등) 또는 PDF만 가능합니다.";
    }
}
