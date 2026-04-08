import os
import smtplib
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

# ─── Development Mode Detection ─────────────────────────────────────────────
# Set APP_ENV=production to disable dev fallback. Default is development.
IS_DEV = os.getenv("APP_ENV", "development").lower() != "production"

# ─── OTP Delivery Result object ─────────────────────────────────────────────
class OTPResult:
    def __init__(self, success: bool, channel: str, message: str,
                 is_dev_fallback: bool = False, dev_otp: Optional[str] = None,
                 provider_error: Optional[str] = None):
        self.success = success
        self.channel = channel       # 'sms', 'email', 'dev_fallback'
        self.message = message       # Human-readable status for the frontend
        self.is_dev_fallback = is_dev_fallback
        # ONLY populated in dev mode — never exposed in production
        self.dev_otp = dev_otp if (IS_DEV and is_dev_fallback) else None
        self.provider_error = provider_error

    def to_dict(self) -> dict:
        result = {
            "success": self.success,
            "channel": self.channel,
            "message": self.message,
            "is_dev_fallback": self.is_dev_fallback,
        }
        # Only include dev_otp in development mode – never in production
        if IS_DEV and self.is_dev_fallback and self.dev_otp:
            result["dev_otp"] = self.dev_otp
        if self.provider_error:
            result["provider_error"] = self.provider_error
        return result


class OTPService:

    # ─── SMS via Twilio ──────────────────────────────────────────────────────
    @staticmethod
    def send_sms(phone_number: str, otp: str) -> OTPResult:
        twilio_sid   = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        twilio_phone = os.getenv("TWILIO_PHONE_NUMBER", "").strip()

        if not (twilio_sid and twilio_token and twilio_phone):
            msg = "⚠️ Twilio credentials not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER missing)."
            print(f"\n📱 [OTP SMS] {msg}")
            if IS_DEV:
                print(f"🔑 [DEV FALLBACK] SMS OTP for {phone_number}: {otp}")
            return OTPResult(
                success=False,
                channel="sms",
                message=msg,
                is_dev_fallback=False,
                provider_error="Missing Twilio credentials"
            )

        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            message = client.messages.create(
                body=f"Your PetpoojaBot OTP is: {otp}. Valid for 5 minutes. Do not share.",
                from_=twilio_phone,
                to=phone_number
            )
            print(f"✅ [OTP SMS] Sent via Twilio to {phone_number}. SID: {message.sid}")
            return OTPResult(
                success=True,
                channel="sms",
                message=f"SMS sent to {phone_number}",
                is_dev_fallback=False
            )
        except Exception as e:
            print(f"❌ [OTP SMS] Twilio delivery failed: {e}")
            return OTPResult(
                success=False,
                channel="sms",
                message=f"SMS delivery failed: {type(e).__name__}",
                is_dev_fallback=False,
                provider_error=str(e)
            )

    # ─── Email via SMTP ──────────────────────────────────────────────────────
    @staticmethod
    def send_email(email_id: str, otp: str) -> OTPResult:
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com").strip()
        smtp_port   = int(os.getenv("SMTP_PORT", "587"))
        smtp_user   = os.getenv("SMTP_USER", "").strip()
        smtp_pass   = os.getenv("SMTP_PASS", "").strip()

        if not (smtp_user and smtp_pass):
            msg = "⚠️ SMTP credentials not configured (SMTP_USER / SMTP_PASS missing)."
            print(f"\n📧 [OTP EMAIL] {msg}")
            if IS_DEV:
                print(f"🔑 [DEV FALLBACK] Email OTP for {email_id}: {otp}")
            return OTPResult(
                success=False,
                channel="email",
                message=msg,
                is_dev_fallback=False,
                provider_error="Missing SMTP credentials"
            )

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = smtp_user
            msg["To"] = email_id
            msg["Subject"] = "Your PetpoojaBot Authentication Code"

            text_body = f"Hello,\n\nYour OTP for PetpoojaBot is: {otp}\n\nValid for 5 minutes. Do not share."
            html_body = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:16px;">
                <h2 style="color:#ea580c;margin:0 0 16px">🍛 PetpoojaBot</h2>
                <p style="color:#555;font-size:15px;">Your one-time authentication code is:</p>
                <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#1a1a1a;padding:20px 0;text-align:center">
                    {otp}
                </div>
                <p style="color:#888;font-size:13px;">Valid for <strong>5 minutes</strong>. Do not share this code.</p>
            </div>"""

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email_id, msg.as_string())

            print(f"✅ [OTP EMAIL] Sent via SMTP to {email_id}")
            return OTPResult(
                success=True,
                channel="email",
                message=f"Email sent to {email_id}",
                is_dev_fallback=False
            )
        except Exception as e:
            print(f"❌ [OTP EMAIL] SMTP delivery failed: {e}")
            return OTPResult(
                success=False,
                channel="email",
                message=f"Email delivery failed: {type(e).__name__}",
                is_dev_fallback=False,
                provider_error=str(e)
            )

    # ─── Developer Fallback ──────────────────────────────────────────────────
    @staticmethod
    def dev_fallback(contact_value: str, otp: str) -> OTPResult:
        """Only used when both SMS and Email delivery are impossible and APP_ENV != production."""
        print(f"\n{'='*60}")
        print(f"🔑 [DEV OTP FALLBACK] Contact: {contact_value}")
        print(f"   OTP CODE → {otp}")
        print(f"   This OTP is only shown in development mode.")
        print(f"{'='*60}\n")
        return OTPResult(
            success=True,
            channel="dev_fallback",
            message="Development mode: OTP is shown in the browser and logged to the console.",
            is_dev_fallback=True,
            dev_otp=otp
        )

    # ─── Main Entry Point ────────────────────────────────────────────────────
    @staticmethod
    def send_otp(method: str, contact_value: str, otp: str,
                 fallback_email: Optional[str] = None) -> OTPResult:
        """
        Attempts OTP delivery using the requested method.
        If SMS fails and a fallback_email is provided, tries Email automatically.
        If both fail (or credentials are missing), activates dev fallback in dev mode.
        Never lies: returns truthful success/failure status.
        """
        print(f"\n📤 [OTP SEND] method={method} contact={contact_value} env={'DEV' if IS_DEV else 'PRODUCTION'}")

        if method == "phone":
            result = OTPService.send_sms(contact_value, otp)
            if result.success:
                return result

            # SMS failed: try email fallback if email is available
            if fallback_email and fallback_email != contact_value:
                print(f"🔄 [OTP FALLBACK] SMS failed. Trying email fallback: {fallback_email}")
                email_result = OTPService.send_email(fallback_email, otp)
                if email_result.success:
                    email_result.message = f"SMS failed. OTP sent to email {fallback_email} instead."
                    return email_result

            # Both SMS and Email failed → dev fallback if in dev mode
            if IS_DEV:
                return OTPService.dev_fallback(contact_value, otp)

            # Production: surface the real error
            return OTPResult(
                success=False,
                channel="sms",
                message="OTP delivery failed. SMS provider unavailable and no email fallback configured.",
                is_dev_fallback=False,
                provider_error=result.provider_error
            )

        elif method == "email":
            result = OTPService.send_email(contact_value, otp)
            if result.success:
                return result

            # Email failed → dev fallback if in dev mode
            if IS_DEV:
                return OTPService.dev_fallback(contact_value, otp)

            # Production: surface the error
            return OTPResult(
                success=False,
                channel="email",
                message="OTP delivery failed. Email provider unavailable.",
                is_dev_fallback=False,
                provider_error=result.provider_error
            )

        else:
            return OTPResult(
                success=False,
                channel="unknown",
                message=f"Invalid OTP method: '{method}'. Must be 'phone' or 'email'.",
                is_dev_fallback=False
            )

    # ─── Provider Health Check ────────────────────────────────────────────────
    @staticmethod
    def check_providers() -> dict:
        """Returns the configuration status of each OTP delivery provider."""
        twilio_ok = bool(
            os.getenv("TWILIO_ACCOUNT_SID") and
            os.getenv("TWILIO_AUTH_TOKEN") and
            os.getenv("TWILIO_PHONE_NUMBER")
        )
        smtp_ok = bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))
        return {
            "twilio_sms": "configured" if twilio_ok else "not_configured",
            "smtp_email": "configured" if smtp_ok else "not_configured",
            "dev_fallback_active": IS_DEV and not (twilio_ok or smtp_ok),
            "environment": "development" if IS_DEV else "production",
        }
