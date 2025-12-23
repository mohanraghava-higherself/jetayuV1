import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")  # Anon key for frontend
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service role key for backend (bypasses RLS)

    # LLM
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS - comma-separated origins in env, with defaults for local dev
    @property
    def CORS_ORIGINS(self) -> list:
        origins_str = os.getenv("CORS_ORIGINS", "")
        if origins_str:
            return [origin.strip() for origin in origins_str.split(",") if origin.strip()]
        # Default for local development
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Email Configuration (for operator notifications)
    # Resend API (replaces SMTP)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    # CRITICAL: Use onboarding@resend.dev for unverified accounts
    # Only change this if you've verified a custom domain in Resend dashboard
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
    
    # Operator emails (comma-separated in env)
    @property
    def OPERATOR_EMAILS(self) -> list:
        emails_str = os.getenv("OPERATOR_EMAILS", "")
        if not emails_str:
            return []
        return [email.strip() for email in emails_str.split(",") if email.strip()]


settings = Settings()

