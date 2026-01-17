import httpx
from typing import Optional
from app.core.config import settings


class EmailService:
    """Email service using Postmark API"""

    def __init__(self):
        self.api_key = settings.POSTMARK_API_KEY
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
        self.base_url = "https://api.postmarkapp.com"

    async def _send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> bool:
        """Send email via Postmark API"""
        if not self.api_key:
            print(f"[WARNING] No Postmark API key configured. Email not sent to {to_email}")
            return True  # Return True in dev mode

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/email",
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-Postmark-Server-Token": self.api_key,
                    },
                    json={
                        "From": f"{self.from_name} <{self.from_email}>",
                        "To": to_email,
                        "Subject": subject,
                        "HtmlBody": html_content,
                        "TextBody": text_content,
                        "MessageStream": "outbound",
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    result = response.json()
                    return result.get("ErrorCode") == 0

                print(f"[ERROR] Failed to send email: {response.text}")
                return False

        except Exception as e:
            print(f"[ERROR] Email sending error: {str(e)}")
            return False

    def _get_email_template(self, content: str) -> str:
        """Get common email HTML template wrapper"""
        # WatchSphere logo as inline SVG (works in most email clients)
        logo_svg = """
        <svg width="140" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm0 28c-6.627 0-12-5.373-12-12S9.373 4 16 4s12 5.373 12 12-5.373 12-12 12z" fill="#1D1D1F"/>
            <path d="M16 8c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#1D1D1F"/>
            <circle cx="16" cy="16" r="3" fill="#1D1D1F"/>
            <path d="M15 8h2v4h-2z" fill="#1D1D1F"/>
            <path d="M15 20h2v4h-2z" fill="#1D1D1F"/>
            <path d="M20 15v2h4v-2z" fill="#1D1D1F"/>
            <path d="M8 15v2h4v-2z" fill="#1D1D1F"/>
        </svg>
        """

        return f"""
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
                        <!-- Logo Header -->
                        <div style="text-align: center; margin-bottom: 32px;">
                            {logo_svg}
                            <p style="color: #1D1D1F; font-size: 20px; font-weight: 700; margin: 12px 0 0; letter-spacing: -0.5px;">WatchSphere</p>
                        </div>
                        {content}
                        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
                        <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
                            &copy; 2026 WatchSphere. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

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

        content = f"""
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
        """

        html_content = self._get_email_template(content)

        text_content = f"""
Welcome to WatchSphere

Hi{' ' + user_name if user_name else ''},

Thank you for signing up! Please use the verification code below to complete your registration:

{verification_code}

This code will expire in 15 minutes. If you didn't request this code, please ignore this email.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)

    async def send_welcome_email(self, to_email: str, user_name: str) -> bool:
        """Send welcome email after user completes onboarding"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Welcome email to {to_email}")
            return True

        subject = "Welcome to WatchSphere!"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            Welcome to WatchSphere, {user_name}!
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
            Your account has been successfully set up. You're now part of an exclusive community of watch enthusiasts.
        </p>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Start exploring watches, track your favorites, and connect with fellow collectors.
        </p>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
Welcome to WatchSphere, {user_name}!

Your account has been successfully set up. You're now part of an exclusive community of watch enthusiasts.

Start exploring watches, track your favorites, and connect with fellow collectors.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_code: str,
        user_name: Optional[str] = None
    ) -> bool:
        """Send password reset code email to user"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Password reset email to {to_email}: Code is {reset_code}")
            return True

        subject = "Reset Your WatchSphere Password"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            Password Reset Request
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Hi{' ' + user_name if user_name else ''},<br><br>
            We received a request to reset your password. Use the code below to proceed:
        </p>
        <div style="background-color: #f5f5f5; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1D1D1F;">
                {reset_code}
            </span>
        </div>
        <p style="color: #666666; font-size: 14px; line-height: 22px; margin: 0 0 20px;">
            This code will expire in 15 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
Password Reset Request

Hi{' ' + user_name if user_name else ''},

We received a request to reset your password. Use the code below to proceed:

{reset_code}

This code will expire in 15 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)

    async def send_account_confirmation_email(
        self,
        to_email: str,
        user_name: str
    ) -> bool:
        """Send account confirmation email when admin approves user"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Account confirmation email to {to_email}")
            return True

        subject = "Your WatchSphere Account Has Been Approved!"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            Account Approved!
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
            Hi {user_name},<br><br>
            Great news! Your WatchSphere account has been reviewed and approved by our team.
        </p>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            You now have full access to all features. Log in to start exploring the world of luxury watches, connect with collectors, and discover rare timepieces.
        </p>
        <div style="text-align: center; margin: 0 0 30px;">
            <a href="https://watchsphere.io" style="display: inline-block; background-color: #1D1D1F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Open WatchSphere
            </a>
        </div>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
Account Approved!

Hi {user_name},

Great news! Your WatchSphere account has been reviewed and approved by our team.

You now have full access to all features. Log in to start exploring the world of luxury watches, connect with collectors, and discover rare timepieces.

Visit https://watchsphere.io to get started.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)

    async def send_admin_invite_email(
        self,
        to_email: str,
        inviter_name: str,
        temp_password: str
    ) -> bool:
        """Send admin invitation email with temporary credentials"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Admin invite email to {to_email}: Password is {temp_password}")
            return True

        subject = "You've Been Invited as a WatchSphere Admin"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            Admin Invitation
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
            Hi,<br><br>
            {inviter_name} has invited you to join WatchSphere as an administrator.
        </p>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Use the credentials below to log in to the admin panel:
        </p>
        <div style="background-color: #f5f5f5; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
            <p style="color: #666666; font-size: 14px; margin: 0 0 12px;">
                <strong style="color: #1D1D1F;">Email:</strong> {to_email}
            </p>
            <p style="color: #666666; font-size: 14px; margin: 0;">
                <strong style="color: #1D1D1F;">Temporary Password:</strong> {temp_password}
            </p>
        </div>
        <p style="color: #666666; font-size: 14px; line-height: 22px; margin: 0 0 20px;">
            For security, please change your password after logging in for the first time.
        </p>
        <div style="text-align: center; margin: 0 0 30px;">
            <a href="https://watchsphere.io" style="display: inline-block; background-color: #1D1D1F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Access Admin Panel
            </a>
        </div>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
Admin Invitation

Hi,

{inviter_name} has invited you to join WatchSphere as an administrator.

Use the credentials below to log in to the admin panel:

Email: {to_email}
Temporary Password: {temp_password}

For security, please change your password after logging in for the first time.

Visit https://watchsphere.io to access the admin panel.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)


    async def send_subscription_confirmation_email(
        self,
        to_email: str,
        user_name: str,
        plan_name: str = "Premium",
        amount: float = 150.0,
        currency: str = "EUR",
        expires_at: str = "",
        is_renewal: bool = False
    ) -> bool:
        """Send subscription confirmation email after successful payment"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            print(f"[DEV] Subscription confirmation email to {to_email}")
            return True

        subject = f"Your WatchSphere {plan_name} Subscription is {'Renewed' if is_renewal else 'Active'}!"

        action_word = "renewed" if is_renewal else "activated"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            {'Subscription Renewed!' if is_renewal else 'Welcome to Premium!'}
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
            Hi {user_name},<br><br>
            {'Great news! Your' if is_renewal else 'Congratulations! Your'} WatchSphere {plan_name} subscription has been successfully {action_word}.
        </p>
        <div style="background-color: #f5f5f5; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
            <p style="color: #1D1D1F; font-size: 16px; font-weight: 600; margin: 0 0 16px;">
                Subscription Details
            </p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Plan</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{plan_name}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Amount</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{amount:.2f} {currency}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Valid Until</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{expires_at}</td>
                </tr>
            </table>
        </div>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            You now have full access to all premium features including unlimited market access, advanced analytics, priority support, and more.
        </p>
        <div style="text-align: center; margin: 0 0 30px;">
            <a href="https://watchsphere.io" style="display: inline-block; background-color: #1D1D1F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Start Exploring
            </a>
        </div>
        <p style="color: #999999; font-size: 13px; line-height: 20px; margin: 0;">
            Your subscription will automatically renew. You can manage your subscription settings in your account at any time.
        </p>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
{'Subscription Renewed!' if is_renewal else 'Welcome to Premium!'}

Hi {user_name},

{'Great news! Your' if is_renewal else 'Congratulations! Your'} WatchSphere {plan_name} subscription has been successfully {action_word}.

Subscription Details:
- Plan: {plan_name}
- Amount: {amount:.2f} {currency}
- Valid Until: {expires_at}

You now have full access to all premium features including unlimited market access, advanced analytics, priority support, and more.

Visit https://watchsphere.io to start exploring.

Your subscription will automatically renew. You can manage your subscription settings in your account at any time.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)


# Singleton instance
email_service = EmailService()
