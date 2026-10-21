declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MEDIA_STORAGE_ENABLED?: string;
    SITE_PASSWORD?: string;
    SESSION_SECRET?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    ACCOUNT_HASH_SECRET?: string;
    ADMIN_EMAIL?: string;
    GROUP_QUIZ_JSON?: string;
  }
}
