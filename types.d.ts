declare namespace NodeJS {
  interface ProcessEnv {
    ADMIN_USERNAME: string
    TURSO_DATABASE_URL: string
    TURSO_AUTH_TOKEN: string
    SESSION_SECRET: string
    APP_URL: string
    RESEND_API_KEY: string
    MAIL_FROM: string
  }
}