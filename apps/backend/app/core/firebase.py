"""
Firebase Admin SDK configuration and initialization
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, storage, messaging
from typing import Optional
from pathlib import Path

# Firebase app instance
_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> firebase_admin.App:
    """Get or initialize Firebase Admin SDK"""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    # Try to find service account credentials
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if cred_path and Path(cred_path).exists():
        # Load from file path
        cred = credentials.Certificate(cred_path)
    elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
        # Load from JSON string (for deployment environments)
        cred_dict = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
        cred = credentials.Certificate(cred_dict)
    else:
        # Try default location
        default_path = Path(__file__).parent.parent.parent / "firebase-service-account.json"
        if default_path.exists():
            cred = credentials.Certificate(str(default_path))
        else:
            raise ValueError(
                "Firebase credentials not found. Please set FIREBASE_SERVICE_ACCOUNT_PATH "
                "environment variable or place firebase-service-account.json in the backend folder."
            )

    # Get storage bucket from env
    storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")
    if not storage_bucket:
        # Try to get project ID from credentials and construct bucket name
        project_id = cred.project_id if hasattr(cred, 'project_id') else None
        if project_id:
            storage_bucket = f"{project_id}.appspot.com"
        else:
            raise ValueError("FIREBASE_STORAGE_BUCKET environment variable is required")

    _firebase_app = firebase_admin.initialize_app(cred, {
        'storageBucket': storage_bucket
    })

    return _firebase_app


def get_storage_bucket():
    """Get Firebase Storage bucket"""
    get_firebase_app()  # Ensure app is initialized
    return storage.bucket()


def get_messaging():
    """Get Firebase Cloud Messaging instance"""
    get_firebase_app()  # Ensure app is initialized
    return messaging
