export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const isDevelopment = process.env.NODE_ENV !== "production";

export const isPreviewMode =
  isDevelopment && !isSupabaseConfigured;
