const API_BASE = ""; // proxy 쓰면 비워둬도 됨 (ex: localhost:3000 → 8080)

export const formatKst = (ts) => {
    if (!ts) return "";

    let d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);

    // 강제로 +9시간
    d.setHours(d.getHours() + 9);

    let pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** JWT 토큰 가져오기 */
const getToken = () => {
    return (
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("jwt_token") ||
        localStorage.getItem("token") ||
        ""
    );
};

/** 공통 fetch */
const request = async (path, options = {}) => {
    const token = getToken();

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { 
                Authorization: `Bearer ${token}` 
            } : {}),
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        let text = await res.text().catch(() => "");
        let ct = res.headers.get("content-type") || "";

        let data = null;
        if (ct.includes("application/json")) {
            try { 
                data = text ? JSON.parse(text) : null; 
            } catch {

            }
        } else {
            // 혹시 JSON 문자열인데 content-type이 이상한 경우도 대비
            try { 
                data = text ? JSON.parse(text) : null; 
            } catch {

            }
        }

        let msg = data?.message || data?.error || text || `요청 실패 (${res.status})`;

        let err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
    }

    if (res.status === 204) return null;

    let text = await res.text();
    if (!text) return null;

    let ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return JSON.parse(text);

    return text;
};

export const BoardApi = {
    /** 게시글 목록 */
    listPosts({ 
        roomId, 
        category, 
        keyword, 
        page, 
        size 
    }) {
        const qs = new URLSearchParams({
            roomId,
            ...(category ? { category } : {}),
            ...(keyword ? { keyword } : {}),
            page,
            size,
        }).toString();

        return request(`/api/board/posts?${qs}`, {
            method: "GET",
        });
    },

    /** 게시글 상세 */
    getDetail(postId, incView = true) {
        return request(
            `/api/board/detail/posts/${postId}?incView=${incView}`,
            { method: "GET" }
        );
    },

    /** 게시글 작성 */
    createPost({ 
        roomId, 
        category, 
        title, 
        content, 
        isPinned 
    }) {
        return request(`/api/board/posts`, {
            method: "POST",
            body: JSON.stringify({
                roomId,
                category,
                title,
                content,
                isPinned,
            }),
        });
    },

    /** 게시글 수정 */
    updatePost(postId, { 
        category, 
        title, 
        content, 
        isPinned 
    }) {
        return request(`/api/board/posts/${postId}`, {
            method: "PUT",
            body: JSON.stringify({
                category,
                title,
                content,
                isPinned,
            }),
        });
    },

    /** 게시글 삭제 */
    deletePost(postId) {
        return request(`/api/board/posts/${postId}`, {
            method: "DELETE",
        });
    },

    /** 댓글 목록 */
    getComments(postId) {
        return request(`/api/board/posts/${postId}/comments`, { method: "GET" });
    },

    /** 댓글 작성 */
    createComment(postId, { 
        content, 
        parentId = null 
    }) {
        return request(`/api/board/posts/${postId}/comments`, {
            method: "POST",
            body: JSON.stringify({ 
                content, 
                parentId 
            }),
        });
    },

    /** 댓글 수정 */
    updateComment(commentId, { 
        content 
    }) {
        return request(`/api/board/comments/${commentId}`, {
            method: "PUT",
            body: JSON.stringify({ content }),
        });
    },

    /** 댓글 삭제 */
    deleteComment(commentId) {
        return request(`/api/board/comments/${commentId}`, {
            method: "DELETE",
        });
    },

    /** 첨부 업로드 (S3 업로드 API 호출) */
    async uploadFiles({ roomId, postId, files }) {
        let token = getToken();

        let form = new FormData();
        form.append("roomId", roomId);
        form.append("postId", String(postId));
        files.forEach((f) => form.append("files", f));

        let res = await fetch(`${API_BASE}/api/board/uploads`, {
            method: "POST",
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                // ❗ Content-Type 절대 넣지 마! (multipart boundary 자동)
            },
            body: form,
        });

        if (!res.ok) {
            let text = await res.text().catch(() => "");
            let msg = text || `업로드 실패 (${res.status})`;
            let err = new Error(msg);
            err.status = res.status;
            throw err;
        }

        // 업로드는 보통 JSON 반환
        return await res.json();
    },

    /** 첨부 메타 등록 (postId에 연결) */
    addAttachments(postId, metas) {
        return request(`/api/board/posts/${postId}/attachments`, {
            method: "POST",
            body: JSON.stringify(metas),
        });
    },

    /** 첨부 목록 조회 */
    listAttachments(postId) {
        return request(`/api/board/posts/${postId}/attachments`, {
            method: "GET",
        });
    },

    /** 첨부 전체 교체 */
    replaceAttachments(postId, metas) {
        return request(`/api/board/posts/${postId}/attachments`, {
            method: "PUT",
            body: JSON.stringify(metas),
        });
    },
};