import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


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
            # Only development may treat "not configured" as success. Reporting
            # success in production made a missing key indistinguishable from a
            # delivered email: signup returned 201 and no code was ever sent.
            if settings.ENVIRONMENT == "development":
                logger.warning("No Postmark API key; email to %s not sent (development)", to_email)
                return True
            logger.error(
                "POSTMARK_API_KEY is not configured - email to %s was NOT sent", to_email
            )
            return False

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
                    if result.get("ErrorCode") == 0:
                        return True
                    # A 200 with a non-zero ErrorCode is still a refusal.
                    logger.error(
                        "Postmark refused the email to %s: ErrorCode=%s %s",
                        to_email, result.get("ErrorCode"), result.get("Message"),
                    )
                    return False

                logger.error(
                    "Postmark rejected the email to %s: HTTP %s %s",
                    to_email, response.status_code, response.text[:300],
                )
                return False

        except Exception as e:
            logger.exception("Email transport failure sending to %s: %s", to_email, e)
            return False

    def _get_email_template(self, content: str) -> str:
        """Get common email HTML template wrapper"""
        # WatchSphere official logo as inline SVG (matches the web login page logo)
        logo_svg = """
        <svg width="195" height="23" viewBox="0 0 195 23" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M185.839 17.1314V4.89578H194.911V6.71365H187.727V15.3136H194.911V17.1314H185.839ZM186.8 11.7652V9.94736H193.95V11.7652H186.8Z" fill="#181818"/>
            <path d="M170.596 17.1314V4.89578H176.888C177.599 4.89578 178.252 5.06475 178.846 5.40268C179.44 5.74062 179.918 6.20092 180.279 6.78357C180.641 7.35456 180.821 8.0013 180.821 8.72379C180.821 9.42297 180.629 10.0697 180.244 10.664C179.872 11.2467 179.37 11.7128 178.741 12.0624C178.124 12.412 177.442 12.5868 176.696 12.5868H172.484V17.1314H170.596ZM179.108 17.1314L175.403 11.6079L177.378 11.1709L181.433 17.1489L179.108 17.1314ZM172.484 10.7689H176.679C177.075 10.7689 177.436 10.6757 177.762 10.4892C178.089 10.3028 178.351 10.0522 178.549 9.7376C178.747 9.42297 178.846 9.07921 178.846 8.70631C178.846 8.32176 178.735 7.98382 178.514 7.6925C178.304 7.38952 178.019 7.15063 177.657 6.97584C177.296 6.80104 176.894 6.71365 176.451 6.71365H172.484V10.7689Z" fill="#181818"/>
            <path d="M156.837 17.1314V4.89578H165.909V6.71365H158.725V15.3136H165.909V17.1314H156.837ZM157.799 11.7652V9.94736H164.948V11.7652H157.799Z" fill="#181818"/>
            <path d="M149.887 17.1314V4.89578H151.775V17.1314H149.887ZM140.536 17.1314V4.89578H142.424V17.1314H140.536ZM141.357 11.975L141.375 10.1571H150.726V11.975H141.357Z" fill="#181818"/>
            <path d="M126.317 17.1314V4.89578H132.504C133.204 4.89578 133.839 5.06475 134.41 5.40268C134.992 5.72897 135.453 6.17761 135.79 6.74861C136.14 7.3196 136.315 7.95469 136.315 8.65387C136.315 9.37636 136.134 10.0289 135.773 10.6116C135.412 11.1942 134.928 11.6662 134.322 12.0274C133.716 12.377 133.046 12.5518 132.312 12.5518H128.204V17.1314H126.317ZM128.204 10.7339H132.207C132.592 10.7339 132.947 10.6407 133.273 10.4543C133.6 10.2562 133.856 9.9998 134.043 9.68516C134.241 9.37053 134.34 9.02677 134.34 8.65387C134.34 8.29263 134.241 7.96635 134.043 7.67502C133.856 7.38369 133.6 7.15063 133.273 6.97584C132.947 6.80104 132.592 6.71365 132.207 6.71365H128.204V10.7339Z" fill="#181818"/>
            <path d="M116.933 17.3062C116.152 17.3062 115.429 17.2188 114.765 17.044C114.101 16.8692 113.495 16.607 112.947 16.2575C112.4 15.9079 111.91 15.4651 111.479 14.929L112.703 13.3908C113.379 14.1949 114.049 14.7659 114.713 15.1038C115.389 15.4417 116.158 15.6107 117.02 15.6107C117.556 15.6107 118.057 15.5408 118.523 15.401C119.001 15.2495 119.386 15.0397 119.677 14.7717C119.98 14.492 120.131 14.1599 120.131 13.7754C120.131 13.519 120.056 13.2976 119.904 13.1111C119.764 12.9247 119.572 12.7674 119.327 12.6392C119.094 12.4994 118.82 12.3828 118.506 12.2896C118.203 12.1964 117.888 12.1206 117.562 12.0624C117.236 11.9925 116.915 11.9342 116.601 11.8876C115.89 11.771 115.255 11.6196 114.695 11.4331C114.136 11.235 113.658 10.9903 113.262 10.699C112.877 10.396 112.586 10.0464 112.388 9.6502C112.19 9.24235 112.091 8.77622 112.091 8.25184C112.091 7.7158 112.213 7.2322 112.458 6.80104C112.703 6.35823 113.046 5.98533 113.489 5.68235C113.932 5.36772 114.451 5.12883 115.045 4.96569C115.639 4.80255 116.286 4.72098 116.985 4.72098C117.719 4.72098 118.389 4.80255 118.995 4.96569C119.601 5.12883 120.143 5.37355 120.621 5.69983C121.099 6.01446 121.495 6.40484 121.809 6.87096L120.516 8.21688C120.236 7.83233 119.91 7.50605 119.537 7.23803C119.164 6.97001 118.756 6.76608 118.314 6.62625C117.882 6.48641 117.422 6.41649 116.933 6.41649C116.373 6.41649 115.878 6.48641 115.447 6.62625C115.027 6.76608 114.689 6.96418 114.433 7.22055C114.188 7.46526 114.066 7.76241 114.066 8.112C114.066 8.39168 114.136 8.64222 114.276 8.86362C114.427 9.07338 114.637 9.254 114.905 9.40549C115.173 9.55698 115.505 9.68516 115.901 9.79004C116.298 9.89491 116.752 9.98814 117.265 10.0697C117.941 10.1746 118.57 10.3144 119.153 10.4892C119.747 10.6524 120.265 10.8621 120.708 11.1185C121.151 11.3748 121.495 11.6895 121.74 12.0624C121.984 12.4353 122.107 12.8897 122.107 13.4258C122.107 14.2065 121.891 14.8882 121.46 15.4709C121.04 16.0535 120.446 16.508 119.677 16.8343C118.908 17.1489 117.993 17.3062 116.933 17.3062Z" fill="#181818"/>
            <path d="M105.42 17.1314V4.89578H107.308V17.1314H105.42ZM96.0689 17.1314V4.89578H97.9566V17.1314H96.0689ZM96.8904 11.975L96.9079 10.1571H106.259V11.975H96.8904Z" fill="#181818"/>
            <path d="M86.8632 17.3062C85.9426 17.3062 85.0861 17.1606 84.2937 16.8692C83.5013 16.5663 82.8079 16.1351 82.2136 15.5758C81.6193 15.0164 81.159 14.3522 80.8327 13.5831C80.5065 12.8023 80.3433 11.9458 80.3433 11.0136C80.3433 10.128 80.5181 9.30644 80.8677 8.54899C81.2173 7.79155 81.6951 7.13315 82.301 6.57381C82.907 6.00281 83.6062 5.56582 84.3986 5.26285C85.191 4.94822 86.0358 4.7909 86.9331 4.7909C87.6323 4.7909 88.3081 4.88995 88.9607 5.08805C89.6249 5.2745 90.2192 5.52504 90.7436 5.83967C91.2797 6.1543 91.7108 6.49807 92.0371 6.87096L90.8485 8.33924C90.4639 7.98965 90.0619 7.6925 89.6424 7.44779C89.2229 7.19142 88.7801 6.99914 88.314 6.87096C87.8478 6.73113 87.3526 6.66121 86.8282 6.66121C86.2339 6.66121 85.6629 6.76608 85.1152 6.97584C84.5675 7.18559 84.0781 7.48274 83.6469 7.86729C83.2274 8.24019 82.8895 8.69466 82.6331 9.2307C82.3884 9.76673 82.2661 10.361 82.2661 11.0136C82.2661 11.7128 82.3884 12.3362 82.6331 12.8839C82.8895 13.4316 83.2391 13.8977 83.6819 14.2823C84.1364 14.6552 84.6491 14.9407 85.2201 15.1388C85.8027 15.3369 86.4203 15.4359 87.0729 15.4359C87.6439 15.4359 88.1625 15.366 88.6286 15.2262C89.0947 15.0747 89.5201 14.8824 89.9046 14.6493C90.2892 14.4046 90.6387 14.1541 90.9534 13.8977L91.8798 15.4534C91.5768 15.7447 91.1631 16.0361 90.6387 16.3274C90.126 16.607 89.5434 16.8401 88.8908 17.0266C88.2499 17.213 87.574 17.3062 86.8632 17.3062Z" fill="#181818"/>
            <path d="M71.9131 17.1314V6.71365H67.788V4.89578H78.0135V6.71365H73.8009V17.1314H71.9131Z" fill="#181818"/>
            <path d="M53.4119 17.1314L58.8305 4.89578H60.9106L66.3118 17.1314H64.2667L60.7358 9.16078C60.6542 9.00929 60.561 8.80536 60.4561 8.549C60.3629 8.29263 60.258 8.02461 60.1415 7.74494C60.0366 7.45361 59.9317 7.17394 59.8269 6.90592C59.7336 6.62625 59.6521 6.38736 59.5821 6.18926L60.0716 6.17178C59.9783 6.4165 59.8793 6.67286 59.7744 6.94088C59.6812 7.2089 59.5821 7.48275 59.4773 7.76242C59.3724 8.03044 59.2675 8.29263 59.1626 8.549C59.0578 8.79371 58.9587 9.02094 58.8655 9.2307L55.3696 17.1314H53.4119ZM55.7891 14.1949L56.5058 12.377H63.0256L63.55 14.1949H55.7891Z" fill="#181818"/>
            <path d="M38.1823 17.1314L33.9348 4.89578H35.9799L38.4795 12.2896C38.561 12.511 38.6368 12.7616 38.7067 13.0412C38.7883 13.3092 38.864 13.5831 38.9339 13.8628C39.0155 14.1424 39.0854 14.4105 39.1437 14.6668C39.202 14.9115 39.2602 15.1329 39.3185 15.331L38.6717 15.3136C38.8116 14.8591 38.9398 14.4512 39.0563 14.09C39.1845 13.7288 39.3068 13.4025 39.4234 13.1111C39.5516 12.8082 39.6681 12.5285 39.773 12.2721L41.9929 7.0108H43.7583L45.9257 12.2547C46.0656 12.5693 46.1938 12.8956 46.3103 13.2335C46.4385 13.5598 46.5608 13.8861 46.6774 14.2124C46.7939 14.5386 46.8871 14.8533 46.957 15.1562L46.3627 15.2786C46.421 15.0222 46.4734 14.795 46.52 14.5969C46.5667 14.3988 46.6133 14.2065 46.6599 14.0201C46.7181 13.8336 46.7764 13.653 46.8347 13.4782C46.8929 13.2918 46.957 13.0937 47.027 12.8839C47.0969 12.6742 47.1726 12.4469 47.2542 12.2022L49.8936 4.89578H51.9212L47.3765 17.1314H46.0656L42.6571 9.16078L42.9193 9.2307L39.5457 17.1314H38.1823Z" fill="#181818"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M16.6065 10.3015H19.7507L20.4493 6.43591H22.198L21.4994 10.3015H22.2031C24.6473 10.3015 26.6289 12.2751 26.6289 14.7094C26.6289 17.1436 24.6472 19.1173 22.2031 19.1173H19.9063L19.3279 22.3176H17.0292L16.4509 19.1173H10.7394L10.161 22.3176H7.86235L7.28401 19.1173H0.0994386V17.4024H18.4675L19.4408 12.0161H16.9164L17.6151 15.8822H15.8659L14.1587 6.43591H15.9079L16.6065 10.3015ZM20.2162 17.4024H22.2031C23.6966 17.4023 24.9075 16.1968 24.9076 14.7094C24.9076 13.2219 23.6966 12.0162 22.2031 12.0161H21.1894L20.2162 17.4024Z" fill="#181818"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M6.15592 3.20025H11.8675L12.4458 0H14.7445L15.3228 3.20025H21.0344L21.6127 0H23.3614L22.783 3.20025H26.6289V4.91519H6.46583L7.43961 10.3015H10.5838L11.2824 6.43591H13.0316L11.3244 15.8822H9.57522L10.2739 12.0161H7.74951L8.44816 15.8822H6.69897L6.00032 12.0161H4.42528C1.98119 12.016 0 10.0424 0 7.60819C3.22772e-05 5.17995 1.97146 3.21002 4.40724 3.20025L3.8289 0H5.57758L6.15592 3.20025ZM4.71715 4.91519C3.14705 4.9152 1.72115 5.91731 1.72111 7.60819C1.72111 9.09561 2.93186 10.3013 4.42528 10.3015H5.69041L4.71715 4.91519Z" fill="#181818"/>
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
            logger.info(f"[DEV] Verification email to {to_email}: Code is {verification_code}")
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
            logger.info(f"[DEV] Welcome email to {to_email}")
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
            logger.info(f"[DEV] Password reset email to {to_email}: Code is {reset_code}")
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
            logger.info(f"[DEV] Account confirmation email to {to_email}")
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
            logger.info(f"[DEV] Admin invite email to {to_email}: Password is {temp_password}")
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
            logger.info(f"[DEV] Subscription confirmation email to {to_email}")
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

    async def send_buy_order_received_email(
        self,
        to_email: str,
        seller_name: str,
        buyer_name: str,
        watch_brand: str,
        watch_model: str,
        watch_reference: str,
        offer_price: float,
        currency: str = "EUR",
        order_id: str = "",
    ) -> bool:
        """Send email to seller when a buy order is placed on their listing"""

        if settings.ENVIRONMENT == "development" and not self.api_key:
            logger.info(f"[DEV] Buy order received email to {to_email}")
            return True

        subject = f"New Buy Offer: {watch_brand} {watch_model}"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 24px; font-weight: 700; margin: 0 0 20px;">
            New Offer Received!
        </h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
            Hi {seller_name},<br><br>
            Great news! <strong>{buyer_name}</strong> has placed a buy order on your watch listing.
        </p>
        <div style="background-color: #f5f5f5; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
            <p style="color: #1D1D1F; font-size: 16px; font-weight: 600; margin: 0 0 16px;">
                Offer Details
            </p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Watch</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{watch_brand} {watch_model}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Reference</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{watch_reference}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Offer Price</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{offer_price:,.2f} {currency}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Buyer</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{buyer_name}</td>
                </tr>
            </table>
        </div>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Log in to WatchSphere to review the offer and respond to the buyer.
        </p>
        <div style="text-align: center; margin: 0 0 30px;">
            <a href="https://watchsphere.io/app/order/{order_id}" style="display: inline-block; background-color: #1D1D1F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Offer
            </a>
        </div>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
New Offer Received!

Hi {seller_name},

Great news! {buyer_name} has placed a buy order on your watch listing.

Offer Details:
- Watch: {watch_brand} {watch_model}
- Reference: {watch_reference}
- Offer Price: {offer_price:,.2f} {currency}
- Buyer: {buyer_name}

Log in to WatchSphere to review the offer and respond to the buyer.

Visit https://watchsphere.io/app/order/{order_id} to view the offer.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)

    async def send_new_listing_notification(
        self,
        to_email: str,
        buyer_name: str,
        seller_name: str,
        watch_brand: str,
        watch_model: str,
        watch_reference: str,
        listing_price: float,
        buyer_bid_price: float,
        currency: str,
        order_id: str
    ) -> bool:
        """Send notification to buyer when a seller lists a watch at or below their bid price."""
        subject = f"New listing matches your buy order - {watch_brand} {watch_model}"

        content = f"""
        <h1 style="color: #1D1D1F; font-size: 28px; font-weight: 600; margin: 0 0 20px;">New Listing Available!</h1>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Hi {buyer_name},
        </p>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Great news! A new listing matches your buy order. {seller_name} has listed a watch at or below your bid price.
        </p>
        <div style="background-color: #f8f8f8; border-radius: 12px; padding: 20px; margin: 0 0 30px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Watch</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{watch_brand} {watch_model}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Reference</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{watch_reference}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Listing Price</td>
                    <td style="color: #4AA078; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{listing_price:,.2f} {currency}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Your Bid</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{buyer_bid_price:,.2f} {currency}</td>
                </tr>
                <tr>
                    <td style="color: #666666; font-size: 14px; padding: 8px 0;">Seller</td>
                    <td style="color: #1D1D1F; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">{seller_name}</td>
                </tr>
            </table>
        </div>
        <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px;">
            Log in to WatchSphere to view the listing and complete your purchase.
        </p>
        <div style="text-align: center; margin: 0 0 30px;">
            <a href="https://watchsphere.io/app/order/{order_id}" style="display: inline-block; background-color: #1D1D1F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Listing
            </a>
        </div>
        """

        html_content = self._get_email_template(content)

        text_content = f"""
New Listing Available!

Hi {buyer_name},

Great news! A new listing matches your buy order. {seller_name} has listed a watch at or below your bid price.

Listing Details:
- Watch: {watch_brand} {watch_model}
- Reference: {watch_reference}
- Listing Price: {listing_price:,.2f} {currency}
- Your Bid: {buyer_bid_price:,.2f} {currency}
- Seller: {seller_name}

Log in to WatchSphere to view the listing and complete your purchase.

Visit https://watchsphere.io/app/order/{order_id} to view the listing.

© 2026 WatchSphere. All rights reserved.
        """

        return await self._send_email(to_email, subject, html_content, text_content)


# Singleton instance
email_service = EmailService()
