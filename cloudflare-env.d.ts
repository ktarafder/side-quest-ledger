declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_PASSWORD?: string;
    SESSION_SECRET?: string;
  }
}
