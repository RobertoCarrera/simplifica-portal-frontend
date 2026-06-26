export const environment = {
  supabase: {
    url: 'https://lsntpezzhinnohggezxy.supabase.co',
    anonKey: 'sb_publishable_CF4Bkzjh4kDBNfY3avOpaw_7YTeVQBc',
  },
  edgeFunctionsBaseUrl: 'https://lsntpezzhinnohggezxy.supabase.co/functions/v1',
  environment: 'production',
  /** true in production builds. The BFF debug pill in portal quotes is
   *  gated behind `environment.production === false` so end-users never
   *  see internal client_id / company_id / DB source info. */
  production: true,
};
