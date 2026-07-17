export const communityCategories = [
  { id: "vehicle_advice", label: "Araç tavsiyesi", description: "Bütçeni ve kullanımını yaz, topluluktan kısa liste iste." },
  { id: "ownership", label: "Sahip deneyimi", description: "Kullandığın aracın artılarını, eksilerini ve masraflarını paylaş." },
  { id: "technical", label: "Teknik soru", description: "Arıza, bakım ve satın alma kontrolü hakkında fikir al." },
  { id: "general", label: "Genel sohbet", description: "Otomobil gündemi ve diğer konular." },
] as const;

export type CommunityCategory = (typeof communityCategories)[number]["id"];

export type CommunityThread = {
  id: string;
  title: string;
  body: string;
  category: CommunityCategory;
  vehicleId: string | null;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  userId: string;
  authorUsername: string;
  commentCount: number;
  participantCount: number;
  vehicle: { make: string; model: string } | null;
  imagePaths: string[];
  imageUrls: string[];
  likeCount: number;
  dislikeCount: number;
  userInteraction: "like" | "dislike" | null;
};

export type CommunityThreadRpcRow = {
  id: string;
  title: string;
  body: string;
  category: CommunityCategory;
  vehicle_id: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  user_id: string;
  author_username: string;
  comment_count: number | string;
  participant_count: number | string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  image_paths?: string[] | null;
  like_count?: number | string | null;
  dislike_count?: number | string | null;
  current_user_reaction?: "like" | "dislike" | string | null;
  total_count?: number | string;
};

export function normalizeCommunityThread(row: CommunityThreadRpcRow, imageUrls: string[] = []): CommunityThread {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    vehicleId: row.vehicle_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    authorUsername: row.author_username || "Kullanıcı",
    commentCount: Number(row.comment_count ?? 0),
    participantCount: Number(row.participant_count ?? 0),
    vehicle: row.vehicle_make ? { make: row.vehicle_make, model: row.vehicle_model ?? "" } : null,
    imagePaths: row.image_paths ?? [],
    imageUrls,
    likeCount: Number(row.like_count ?? 0),
    dislikeCount: Number(row.dislike_count ?? 0),
    userInteraction: row.current_user_reaction === "like" || row.current_user_reaction === "dislike" ? row.current_user_reaction : null,
  };
}

export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return communityCategories.some((category) => category.id === value);
}

export function communityMigrationError(message?: string) {
  if (!message) return false;
  return message.includes("community_") || message.includes("Could not find the function") || message.includes("schema cache");
}
