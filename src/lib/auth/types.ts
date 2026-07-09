export type AppUserProfile = {
  id: string;
  email: string | null;
  username: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: AppUserProfile | null;
};
