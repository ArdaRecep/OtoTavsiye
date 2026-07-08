"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useAdminStatus } from "@/hooks/use-admin-status";
import {
  getStoredUserId,
  getStoredUserName,
  type UserInfo,
} from "@/lib/user-identity";
import { AuthModal } from "./auth-modal";

type CommentData = {
  id: string;
  vehicle_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
  likeCount: number;
  dislikeCount: number;
  userInteraction: "like" | "dislike" | null;
  replyCount: number;
  authorCarRating: number | null;
  replies: CommentData[];
};

type CommentApiRow = Omit<CommentData, "replies"> & {
  replies?: CommentData[];
};

type PendingComment = {
  content: string;
  parentId: string | null;
  clearDraft: () => void;
};

const MAX_VISUAL_DEPTH = 4;

export function CommentSection({ vehicleId }: { vehicleId: string }) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [pendingReactionIds, setPendingReactionIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "oldest">("popular");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const { userId: adminUserId, isAdmin } = useAdminStatus();

  const fetchComments = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setIsLoading(true);

      const params = new URLSearchParams({ vehicleId });
      const userId = getStoredUserId();
      if (userId) params.set("userId", userId);

      const response = await fetch(`/api/comments?${params.toString()}`);

      if (!response.ok) return;

      const data = await response.json();
      const flatComments = (data.comments ?? []) as CommentApiRow[];
      setComments(buildCommentTree(flatComments));
      setTotal(data.total ?? flatComments.length);
    } catch {
      setNotice("Yorumlar yüklenemedi. Birazdan tekrar deneyebilirsin.");
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentUserId(getStoredUserId() ?? "");
      setCurrentUserName(getStoredUserName());
      void fetchComments();
    });
  }, [fetchComments]);

  const sortedComments = useMemo(() => sortRootComments(comments, sortBy), [comments, sortBy]);

  async function handleSubmitComment(
    content: string,
    parentId?: string | null,
    clearDraft?: () => void,
  ) {
    if (!currentUserId) {
      setPendingComment({
        content,
        parentId: parentId ?? null,
        clearDraft: clearDraft ?? (() => undefined),
      });
      setIsAuthOpen(true);
      return;
    }

    await submitComment(content, currentUserId, parentId ?? null);
    clearDraft?.();
  }

  async function submitComment(content: string, userId: string, parentId: string | null) {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        userId,
        content,
        parentId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Yorum gönderilemedi.");
    }

    if (parentId) {
      setCollapsedIds((current) => {
        const next = new Set(current);
        next.delete(parentId);
        return next;
      });
    }

    setReplyingTo(null);
    await fetchComments();
  }

  async function handleToggleInteraction(commentId: string, action: "like" | "dislike") {
    if (!currentUserId) {
      setNotice("Etkileşimde bulunmak için giriş yapmalısın.");
      setIsAuthOpen(true);
      return;
    }

    if (pendingReactionIds.has(commentId)) return;

    setPendingReactionIds((current) => new Set(current).add(commentId));

    try {
      const response = await fetch("/api/comment-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, userId: currentUserId, action }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result?.error ?? "Etkileşim kaydedilemedi.");

      setComments((current) =>
        updateCommentInTree(current, commentId, (comment) => ({
          ...comment,
          likeCount: Number(result.likeCount ?? 0),
          dislikeCount: Number(result.dislikeCount ?? 0),
          userInteraction: result.userInteraction ?? null,
        })),
      );
    } catch {
      setNotice("Etkileşim güncellenemedi. Sayı ve seçimler yenileniyor.");
      await fetchComments();
    } finally {
      setPendingReactionIds((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
    }
  }

  async function handleAuthSuccess(user: UserInfo) {
    setCurrentUserId(user.id);
    setCurrentUserName(user.username);

    if (!pendingComment) {
      setIsAuthOpen(false);
      await fetchComments();
      return;
    }

    try {
      await submitComment(pendingComment.content, user.id, pendingComment.parentId);
      pendingComment.clearDraft();
      setPendingComment(null);
      setIsAuthOpen(false);
    } catch {
      setNotice("Giriş tamamlandı ama yorum gönderilemedi. Lütfen tekrar dene.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!adminUserId) return;

    const response = await fetch("/api/admin/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: adminUserId, commentId }),
    });

    if (response.ok) {
      setNotice("Yorum silindi.");
      await fetchComments();
    }
  }

  function toggleReplies(commentId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  return (
    <section className="mt-5 rounded-md border border-neutral-300 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-[#014636]" />
          <h2 className="text-xl font-semibold">
            Yorumlar{total > 0 ? ` (${total})` : ""}
          </h2>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="sort-comments" className="font-medium text-neutral-600">Sırala:</label>
            <select
              id="sort-comments"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "popular" | "newest" | "oldest")}
              className="rounded-md border border-neutral-300 bg-white py-1.5 pl-3 pr-8 text-sm text-neutral-700 shadow-sm focus:border-[#014636] focus:outline-none focus:ring-1 focus:ring-[#014636]"
            >
              <option value="popular">En popüler</option>
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
            </select>
          </div>
        )}
      </div>

      <div className="mt-6">
        <CommentForm
          currentUserName={currentUserName}
          onSubmit={(content, clearDraft) => handleSubmitComment(content, null, clearDraft)}
          placeholder="Bu araç hakkında düşüncelerinizi paylaşın..."
          submitLabel="Yorum yap"
        />
      </div>

      {notice ? (
        <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#014636]">
          {notice}
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
            <span className="ml-3 text-sm text-neutral-600">Yorumlar yükleniyor...</span>
          </div>
        ) : sortedComments.length === 0 ? (
          <div className="py-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-700">Henüz yorum yok</p>
            <p className="mt-1 text-sm text-neutral-500">
              İlk yorumu siz yapın!
            </p>
          </div>
        ) : (
          sortedComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              collapsedIds={collapsedIds}
              pendingReactionIds={pendingReactionIds}
              depth={0}
              onReplyClick={(id) =>
                setReplyingTo((current) => (current === id ? null : id))
              }
              onToggleReplies={toggleReplies}
              onSubmitReply={(content, parentId, clearDraft) =>
                handleSubmitComment(content, parentId, clearDraft)
              }
              onDeleteComment={handleDeleteComment}
              onToggleInteraction={handleToggleInteraction}
            />
          ))
        )}
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setPendingComment(null);
        }}
        onAuthenticated={handleAuthSuccess}
      />
    </section>
  );
}

function CommentThread({
  comment,
  currentUserId,
  currentUserName,
  isAdmin,
  replyingTo,
  collapsedIds,
  pendingReactionIds,
  depth,
  parentUsername,
  onReplyClick,
  onToggleReplies,
  onSubmitReply,
  onDeleteComment,
  onToggleInteraction,
}: {
  comment: CommentData;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  replyingTo: string | null;
  collapsedIds: Set<string>;
  pendingReactionIds: Set<string>;
  depth: number;
  parentUsername?: string;
  onReplyClick: (id: string) => void;
  onToggleReplies: (commentId: string) => void;
  onSubmitReply: (content: string, parentId: string, clearDraft: () => void) => Promise<void>;
  onDeleteComment: (commentId: string) => void;
  onToggleInteraction: (commentId: string, action: "like" | "dislike") => void;
}) {
  const replyCount = Math.max(comment.replyCount ?? 0, comment.replies.length);
  const isCollapsed = collapsedIds.has(comment.id);
  const indent = depth > 0 && depth <= MAX_VISUAL_DEPTH ? 12 : 0;

  return (
    <div
      className={depth > 0 ? "relative border-l border-neutral-200 pl-3" : ""}
      style={depth > 0 ? { marginLeft: indent } : undefined}
    >
      <CommentBubble
        comment={comment}
        isOwn={comment.user_id === currentUserId}
        canDelete={isAdmin}
        depth={depth}
        parentUsername={parentUsername}
        replyCount={replyCount}
        repliesCollapsed={isCollapsed}
        isReactionPending={pendingReactionIds.has(comment.id)}
        onReplyClick={() => onReplyClick(comment.id)}
        onToggleReplies={() => onToggleReplies(comment.id)}
        onDelete={() => onDeleteComment(comment.id)}
        isReplyOpen={replyingTo === comment.id}
        onToggleInteraction={onToggleInteraction}
      />

      {replyingTo === comment.id ? (
        <div className="mb-3 ml-9 rounded-md border border-emerald-100 bg-emerald-50/45 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#014636]">
            <CornerDownRight className="h-3 w-3" />
            @{comment.user.username} kullanıcısına yanıt
          </div>
          <CommentForm
            currentUserName={currentUserName}
            onSubmit={(content, clearDraft) =>
              onSubmitReply(content, comment.id, clearDraft)
            }
            placeholder="Yanıtınızı yazın..."
            submitLabel="Yanıtla"
            isCompact
          />
        </div>
      ) : null}

      {comment.replies.length > 0 && !isCollapsed ? (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              collapsedIds={collapsedIds}
              pendingReactionIds={pendingReactionIds}
              depth={depth + 1}
              parentUsername={comment.user.username}
              onReplyClick={onReplyClick}
              onToggleReplies={onToggleReplies}
              onSubmitReply={onSubmitReply}
              onDeleteComment={onDeleteComment}
              onToggleInteraction={onToggleInteraction}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentBubble({
  comment,
  isOwn,
  canDelete,
  depth,
  parentUsername,
  replyCount,
  repliesCollapsed,
  isReactionPending,
  onReplyClick,
  onToggleReplies,
  onDelete,
  isReplyOpen,
  onToggleInteraction,
}: {
  comment: CommentData;
  isOwn: boolean;
  canDelete?: boolean;
  depth: number;
  parentUsername?: string;
  replyCount: number;
  repliesCollapsed: boolean;
  isReactionPending: boolean;
  onReplyClick: () => void;
  onToggleReplies: () => void;
  onDelete?: () => void;
  isReplyOpen?: boolean;
  onToggleInteraction: (commentId: string, action: "like" | "dislike") => void;
}) {
  const username = comment.user?.username ?? "Anonim";
  const avatarUrl = comment.user?.avatar_url;
  const initial = username.charAt(0).toUpperCase();

  return (
    <div id={`comment-${comment.id}`} className="flex gap-3 rounded-md px-1 py-3 transition hover:bg-neutral-50/70">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isOwn
              ? "bg-[#014636] text-white"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            {username}
          </span>
          {isOwn ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-[#014636]">
              Siz
            </span>
          ) : null}
          {comment.authorCarRating !== null ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              {comment.authorCarRating.toFixed(1)} ★
            </span>
          ) : null}
          <span className="text-xs text-neutral-400">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>

        {depth > 0 && parentUsername ? (
          <div className="mt-1 text-xs font-medium text-neutral-500">
            @{parentUsername} kullanıcısına yanıt
          </div>
        ) : null}

        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-700">
          {comment.content}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 border-r border-neutral-200 pr-3">
            <button
              type="button"
              onClick={() => onToggleInteraction(comment.id, "like")}
              disabled={isReactionPending}
              aria-pressed={comment.userInteraction === "like"}
              className={`flex items-center gap-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                comment.userInteraction === "like" ? "text-emerald-600" : "text-neutral-500 hover:text-emerald-600"
              }`}
              aria-label="Beğen"
            >
              <ThumbsUp className={`h-3 w-3 ${comment.userInteraction === "like" ? "fill-current" : ""}`} />
              {comment.likeCount > 0 ? <span>{comment.likeCount}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => onToggleInteraction(comment.id, "dislike")}
              disabled={isReactionPending}
              aria-pressed={comment.userInteraction === "dislike"}
              className={`flex items-center gap-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                comment.userInteraction === "dislike" ? "text-red-500" : "text-neutral-500 hover:text-red-500"
              }`}
              aria-label="Beğenme"
            >
              <ThumbsDown className={`h-3 w-3 ${comment.userInteraction === "dislike" ? "fill-current" : ""}`} />
              {comment.dislikeCount > 0 ? <span>{comment.dislikeCount}</span> : null}
            </button>
            {isReactionPending ? <Loader2 className="h-3 w-3 animate-spin text-neutral-400" /> : null}
          </div>

          <button
            type="button"
            onClick={onReplyClick}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
              isReplyOpen
                ? "text-[#014636]"
                : "text-neutral-500 hover:text-[#014636]"
            }`}
          >
            <CornerDownRight className="h-3 w-3" />
            Yanıtla
          </button>

          {replyCount > 0 ? (
            <button
              type="button"
              onClick={onToggleReplies}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 transition hover:text-[#014636]"
            >
              {repliesCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {replyCount} cevap
              <span className="text-neutral-400">
                {repliesCollapsed ? "göster" : "gizle"}
              </span>
            </button>
          ) : null}

          {canDelete && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 transition hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
              Sil
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentForm({
  currentUserName,
  onSubmit,
  placeholder,
  submitLabel,
  isCompact,
}: {
  currentUserName: string;
  onSubmit: (content: string, clearDraft: () => void) => Promise<void>;
  placeholder: string;
  submitLabel: string;
  isCompact?: boolean;
}) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(content.trim(), () => setContent(""));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Yorum gönderilemedi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!currentUserName ? (
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-neutral-700">
          Yorumunu yazabilirsin. Gönderirken hızlı giriş/kayıt penceresi açılacak ve metnin kaybolmayacak.
        </div>
      ) : null}
      {currentUserName ? <p className="text-xs font-semibold text-neutral-500">{currentUserName} olarak yazıyorsun.</p> : null}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          required
          rows={isCompact ? 2 : 3}
          className="w-full resize-none rounded-md border border-neutral-300 bg-white p-3 pr-12 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#014636] text-white transition hover:bg-[#003a2d] disabled:cursor-not-allowed disabled:bg-neutral-300"
          aria-label={submitLabel}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {content.length > 0 ? (
        <div className="text-right text-xs text-neutral-400">
          {content.length}/1000
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </form>
  );
}

function buildCommentTree(flatComments: CommentApiRow[]): CommentData[] {
  const byId = new Map<string, CommentData>();
  const roots: CommentData[] = [];

  for (const row of flatComments) {
    byId.set(row.id, {
      ...row,
      likeCount: Number(row.likeCount ?? 0),
      dislikeCount: Number(row.dislikeCount ?? 0),
      replyCount: Number(row.replyCount ?? 0),
      authorCarRating: row.authorCarRating === null || row.authorCarRating === undefined ? null : Number(row.authorCarRating),
      replies: [],
    });
  }

  for (const comment of byId.values()) {
    const parent = comment.parent_id ? byId.get(comment.parent_id) : null;

    if (parent) {
      parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return sortRepliesOldest(roots);
}

function sortRootComments(comments: CommentData[], sortBy: "popular" | "newest" | "oldest") {
  const sorted = [...comments];

  sorted.sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    const scoreA = (a.likeCount || 0) + (a.replyCount || a.replies.length || 0);
    const scoreB = (b.likeCount || 0) + (b.replyCount || b.replies.length || 0);

    if (scoreB !== scoreA) return scoreB - scoreA;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sorted.map((comment) => ({
    ...comment,
    replies: sortRepliesOldest(comment.replies),
  }));
}

function sortRepliesOldest(comments: CommentData[]): CommentData[] {
  return [...comments]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((comment) => ({
      ...comment,
      replies: sortRepliesOldest(comment.replies),
    }));
}

function updateCommentInTree(
  comments: CommentData[],
  commentId: string,
  updater: (comment: CommentData) => CommentData,
): CommentData[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return updater(comment);
    }

    if (!comment.replies.length) return comment;

    return {
      ...comment,
      replies: updateCommentInTree(comment.replies, commentId, updater),
    };
  });
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 60) return "Az önce";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} dk önce`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} saat önce`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)} gün önce`;

  return new Date(dateString).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
