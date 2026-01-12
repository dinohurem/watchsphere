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

    # Monri Payments
    MONRI_MERCHANT_KEY: str = ""
    MONRI_AUTHENTICITY_TOKEN: str = ""
    MONRI_API_URL: str = "https://ipg.monri.com"  # Use https://ipgtest.monri.com for testing
    MONRI_SUBSCRIPTION_PRICE: float = 100.0  # 100€/month
    MONRI_CURRENCY: str = "EUR"

    # Email (Postmark)
    POSTMARK_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@watchsphere.io"
    EMAIL_FROM_NAME: str = "WatchSphere"

    # Verification
    TEST_VERIFICATION_CODE: str = "123456"  # Default test code for development

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:8081"

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
