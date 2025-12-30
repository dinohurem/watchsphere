import httpx
from typing import Optional
from app.core.config import settings


class EmailService:
    """Email service using Mailchimp Transactional (Mandrill) API"""

    def __init__(self):
        self.api_key = settings.MAILCHIMP_API_KEY
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
        self.base_url = "https://mandrillapp.com/api/1.0"

    async def send_verification_email(
        self,
        to_email: str,
        verification_code: str,
        user_name: Optional[str] = None
    ) -> bool:
        """Send verification code email to user"""

        # In development/testing mode, just log and return success
        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Verification email to {to_email}: Code is {verification_code}")
            return True

        subject = f"Your WatchSphere Verification Code: {verification_code}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                    <td style="background-color: #ffffff; border-radius: 16px; padding: 40px;">
                        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
                            Welcome to WatchSphere
                        </h1>
                        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
                            Hi{' ' + user_name if user_name else ''},<br><br>
                            Thank you for signing up! Please use the verification code below to complete your registration:
                        </p>
                        <div style="background-color: #f5f5f5; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px;">
                            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1D1D1F;">
                                {verification_code}
                            </span>
                        </div>
                        <p style="color: #666666; font-size: 14px; line-height: 22px; margin: 0 0 20px;">
                            This code will expire in 15 minutes. If you didn't request this code, please ignore this email.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
                        <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
                            &copy; 2024 WatchSphere. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        text_content = f"""
Welcome to WatchSphere

Hi{' ' + user_name if user_name else ''},

Thank you for signing up! Please use the verification code below to complete your registration:

{verification_code}

This code will expire in 15 minutes. If you didn't request this code, please ignore this email.

© 2024 WatchSphere. All rights reserved.
        """

        if not self.api_key:
            print(f"[WARNING] No Mailchimp API key configured. Email not sent to {to_email}")
            return True  # Return True in dev mode

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages/send.json",
                    json={
                        "key": self.api_key,
                        "message": {
                            "html": html_content,
                            "text": text_content,
                            "subject": subject,
                            "from_email": self.from_email,
                            "from_name": self.from_name,
                            "to": [{"email": to_email, "type": "to"}],
                            "important": False,
                            "track_opens": True,
                            "track_clicks": False,
                            "auto_text": False,
                            "inline_css": True,
                        },
                        "async": False,
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    result = response.json()
                    if result and len(result) > 0:
                        return result[0].get("status") in ["sent", "queued"]

                print(f"[ERROR] Failed to send email: {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Email sending error: {str(e)}")
            return False

    async def send_welcome_email(self, to_email: str, user_name: str) -> bool:
        """Send welcome email after user completes onboarding"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Welcome email to {to_email}")
            return True

        subject = "Welcome to WatchSphere!"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                    <td style="background-color: #ffffff; border-radius: 16px; padding: 40px;">
                        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
                            Welcome to WatchSphere, {user_name}!
                        </h1>
                        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
                            Your account has been successfully set up. You're now part of an exclusive community of watch enthusiasts.
                        </p>
                        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
                            Start exploring watches, track your favorites, and connect with fellow collectors.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
                        <p style="color: #999999; font-size: 12px; text-align: center;">
                            &copy; 2024 WatchSphere. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        if not self.api_key:
            return True

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages/send.json",
                    json={
                        "key": self.api_key,
                        "message": {
                            "html": html_content,
                            "subject": subject,
                            "from_email": self.from_email,
                            "from_name": self.from_name,
                            "to": [{"email": to_email, "type": "to"}],
                        },
                        "async": True,
                    },
                    timeout=30.0
                )
                return response.status_code == 200
        except Exception as e:
            print(f"[ERROR] Welcome email error: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()
