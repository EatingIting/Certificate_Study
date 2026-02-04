package com.example.demo.board.service;

import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class BoardUploadServiceImpl implements BoardUploadService {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${cloud.aws.region.static}")
    private String region;

    // 없으면 board 기본값
    @Value("${cloud.aws.s3.prefix:board}")
    private String prefix;

    // 있으면 이걸 우선 사용(CloudFront 쓰면 여기 CloudFront 도메인 넣으면 됨)
    @Value("${cloud.aws.s3.publicBaseUrl:}")
    private String publicBaseUrl;

    public BoardUploadServiceImpl(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    @Override
    public List<BoardAttachmentRequest> upload(String roomId, Long postId, List<MultipartFile> files) {
        List<BoardAttachmentRequest> out = new ArrayList<>();
        if (files == null || files.isEmpty()) return out;

        for (MultipartFile mf : files) {
            if (mf == null || mf.isEmpty()) continue;

            try {
                String originalName = mf.getOriginalFilename();
                if (originalName == null || originalName.isBlank()) originalName = "file";

                // 경로 안전 처리
                String safeOriginal = originalName.replaceAll("[\\\\/]", "_");
                String uuid = UUID.randomUUID().toString().replace("-", "");

                // ✅ S3 key (DB의 fileKey로 저장)
                String key = prefix + "/" + roomId + "/" + postId + "/" + uuid + "_" + safeOriginal;

                String contentType = mf.getContentType();
                long sizeBytes = mf.getSize();

                // 다운로드 파일명 유지(선택)
                String encodedFileName = URLEncoder.encode(originalName, StandardCharsets.UTF_8)
                        .replaceAll("\\+", "%20");

                PutObjectRequest putReq = PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentDisposition("attachment; filename*=UTF-8''" + encodedFileName)
                        .build();

                s3Client.putObject(putReq, RequestBody.fromInputStream(mf.getInputStream(), sizeBytes));

                // ✅ url 만들기 (버킷 public이면 바로 열림)
                String url;
                if (publicBaseUrl != null && !publicBaseUrl.isBlank()) {
                    url = publicBaseUrl.replaceAll("/$", "") + "/" + key;
                } else {
                    url = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
                }

                out.add(BoardAttachmentRequest.builder()
                        .originalName(originalName)
                        .fileKey(key)
                        .url(url)
                        .sizeBytes(sizeBytes)
                        .mimeType(contentType)
                        .build());

            } catch (Exception e) {
                throw new RuntimeException("S3 업로드 실패: " + mf.getOriginalFilename(), e);
            }
        }

        return out;
    }
}