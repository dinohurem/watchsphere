from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings and configuration"""

    # Application
    APP_NAME: str = "WatchSphere"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # API
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days for refresh token

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "watchsphere"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Services (OpenAI for AI chat)
    OPENAI_API_KEY: str = ""
    # Model used for the WTS/WTB image-based variant disambiguation layer.
    # Override via env if a newer vision-capable model should be used.
    OPENAI_VISION_MODEL: str = "gpt-4o"

    # One-time codes. Email is the only delivery channel - the WhatsApp number
    # identifies the account but never receives anything, so Postmark
    # (POSTMARK_API_KEY below) is the single dependency for signup and
    # passwordless login.
    EMAIL_OTP_EXPIRY_MINUTES: int = 10
    # Minimum gap between code requests for the same account.
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS: int = 60

    # Monri Payments
    MONRI_MERCHANT_KEY: str = "key-944bc24cd123fa7403da6278825114f1"
    MONRI_AUTHENTICITY_TOKEN: str = "d515632967fe9eb24cf3dcc04c1fe895b4ca3583"
    MONRI_API_URL: str = "https://ipgtest.monri.com"  # Test environment
    MONRI_FORM_ENDPOINT: str = "https://ipgtest.monri.com/v2/form"
    MONRI_SUBSCRIPTION_PRICE: float = 150.0  # 150€/month
    MONRI_CURRENCY: str = "EUR"
    MONRI_DEBUG: bool = True

    # Email (Postmark)
    POSTMARK_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@watchsphere.io"
    EMAIL_FROM_NAME: str = "WatchSphere"

    # Verification
    TEST_VERIFICATION_CODE: str = "123456"  # Default test code for development

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5177,http://localhost:8081"

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "./uploads"

    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    FIREBASE_STORAGE_BUCKET: str = ""

    # OAuth Providers
    GOOGLE_CLIENT_ID: str = ""  # Google OAuth client ID for web/mobile
    APPLE_CLIENT_ID: str = ""  # Apple OAuth client ID (bundle ID or services ID)

    @property
    def cors_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
