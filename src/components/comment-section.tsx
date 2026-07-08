"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CornerDownRight,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
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
  replies: CommentData[];
};

type PendingComment = {
  content: string;
  parentId: string | null;
  clearDraft: () => void;
};

export function CommentSection({ vehicleId }: { vehicleId: string }) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { userId: adminUserId, isAdmin } = useAdminStatus();

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments?vehicleId=${encodeURIComponent(vehicleId)}`);

      if (!response.ok) return;

      const data = await response.json();
      setComments(data.comments ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // Silently fail — comments are not critical
    } finally {
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
      throw new Error("Yorum gönderilemedi.");
    }

    setReplyingTo(null);
    await fetchComments();
  }

  async function handleAuthSuccess(user: UserInfo) {
    setCurrentUserId(user.id);
    setCurrentUserName(user.username);

    if (!pendingComment) {
      setIsAuthOpen(false);
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

  return (
    <section className="mt-5 rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-[#014636]" />
        <h2 className="text-xl font-semibold">
          Yorumlar{total > 0 ? ` (${total})` : ""}
        </h2>
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

      <div className="mt-8 space-y-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#014636]" />
            <span className="ml-3 text-sm text-neutral-600">Yorumlar yükleniyor...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-700">Henüz yorum yok</p>
            <p className="mt-1 text-sm text-neutral-500">
              İlk yorumu siz yapın!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              replyingTo={replyingTo}
              onReplyClick={(id) =>
                setReplyingTo((current) => (current === id ? null : id))
              }
              onSubmitReply={(content, parentId, clearDraft) =>
                handleSubmitComment(content, parentId, clearDraft)
              }
              onDeleteComment={handleDeleteComment}
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
  onReplyClick,
  onSubmitReply,
  onDeleteComment,
}: {
  comment: CommentData;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  replyingTo: string | null;
  onReplyClick: (id: string) => void;
  onSubmitReply: (content: string, parentId: string, clearDraft: () => void) => Promise<void>;
  onDeleteComment: (commentId: string) => void;
}) {
  return (
    <div className="border-b border-neutral-100 last:border-0">
      <CommentBubble
        comment={comment}
        isOwn={comment.user_id === currentUserId}
        canDelete={isAdmin}
        onReplyClick={() => onReplyClick(comment.id)}
        onDelete={() => onDeleteComment(comment.id)}
        isReplyOpen={replyingTo === comment.id}
      />

      {comment.replies.length > 0 && (
        <div className="ml-6 border-l-2 border-neutral-100 pl-4 sm:ml-10 sm:pl-5">
          {comment.replies.map((reply) => (
            <CommentBubble
              key={reply.id}
              comment={reply}
              isOwn={reply.user_id === currentUserId}
              canDelete={isAdmin}
              onDelete={() => onDeleteComment(reply.id)}
              isReply
            />
          ))}
        </div>
      )}

      {replyingTo === comment.id && (
        <div className="ml-6 border-l-2 border-emerald-100 pb-4 pl-4 sm:ml-10 sm:pl-5">
          <div className="flex items-center gap-2 pb-3 text-xs font-semibold text-[#014636]">
            <CornerDownRight className="h-3 w-3" />
            {comment.user.username} kullanıcısına yanıt
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
      )}
    </div>
  );
}

function CommentBubble({
  comment,
  isOwn,
  isReply,
  canDelete,
  onReplyClick,
  onDelete,
  isReplyOpen,
}: {
  comment: CommentData;
  isOwn: boolean;
  isReply?: boolean;
  canDelete?: boolean;
  onReplyClick?: () => void;
  onDelete?: () => void;
  isReplyOpen?: boolean;
}) {
  const username = comment.user?.username ?? "Anonim";
  const avatarUrl = comment.user?.avatar_url;
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className={`flex gap-3 ${isReply ? "py-3" : "py-4"}`}>
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            {username}
          </span>
          {isOwn && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-[#014636]">
              Siz
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-neutral-700 whitespace-pre-line">
          {comment.content}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!isReply && onReplyClick && (
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
          )}
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
      {!currentUserName && (
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-neutral-700">
          Yorumunu yazabilirsin. Gönderirken hızlı giriş/kayıt penceresi açılacak ve metnin kaybolmayacak.
        </div>
      )}
      {currentUserName ? <p className="text-xs font-semibold text-neutral-500">{currentUserName} olarak yazıyorsun.</p> : null}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          required
          rows={isCompact ? 2 : 3}
          className="w-full resize-none rounded-md border border-neutral-200 bg-white p-3 pr-12 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-[#014636] focus:ring-2 focus:ring-emerald-100"
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
      {content.length > 0 && (
        <div className="text-right text-xs text-neutral-400">
          {content.length}/1000
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </form>
  );
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
