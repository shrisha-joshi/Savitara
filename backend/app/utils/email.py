"""
Email Service for Savitara
Supports SMTP and SendGrid for transactional emails
SonarQube: S6437 - Credentials from environment
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    """Email service supporting SMTP and SendGrid"""

    def __init__(self):
        """Initialize email service"""
        self.provider = settings.EMAIL_PROVIDER  # 'smtp' or 'sendgrid'
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME

        # Initialize template engine
        template_path = Path(__file__).parent.parent / "templates" / "email"
        if template_path.exists():
            self.template_env = Environment(loader=FileSystemLoader(str(template_path)))
        else:
            self.template_env = None
            logger.warning(f"Email template directory not found: {template_path}")

    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render email template with context"""
        if not self.template_env:
            return context.get("body", "")

        try:
            template = self.template_env.get_template(f"{template_name}.html")
            return template.render(**context)
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            return context.get("body", "")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        template: Optional[str] = None,
        template_context: Optional[Dict[str, Any]] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        Send email using configured provider

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Plain text body
            html_body: HTML body (optional)
            template: Template name to use (optional)
            template_context: Context for template (optional)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            attachments: List of attachments (optional)
            reply_to: Reply-to address (optional)

        Returns:
            True if email sent successfully
        """
        try:
            # Render template if provided
            if template and template_context:
                html_body = self._render_template(template, template_context)

            if self.provider == "sendgrid":
                return await self._send_via_sendgrid(
                    to_email, subject, body, html_body, cc, bcc, attachments, reply_to
                )
            else:
                return await self._send_via_smtp(
                    to_email, subject, body, html_body, cc, bcc, attachments, reply_to
                )
        except Exception as e:
            logger.error(f"Email sending failed: {e}", exc_info=True)
            return False

    def _build_message(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
    ) -> MIMEMultipart:
        """Build email message with headers and body"""
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        if cc:
            msg["Cc"] = ", ".join(cc)
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))

        return msg

    def _add_attachments(
        self, msg: MIMEMultipart, attachments: List[Dict[str, Any]]
    ) -> None:
        """Add attachments to email message"""
        for attachment in attachments:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment["content"])
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition", f"attachment; filename={attachment['filename']}"
            )
            msg.attach(part)

    def _collect_recipients(
        self,
        to_email: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
    ) -> List[str]:
        """Collect all email recipients"""
        recipients = [to_email]
        if cc:
            recipients.extend(cc)
        if bcc:
            recipients.extend(bcc)
        return recipients

    async def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """Send email via SMTP using async executor for non-blocking operation"""
        import asyncio

        def _sync_send():
            """Synchronous SMTP send operation"""
            try:
                msg = self._build_message(
                    to_email, subject, body, html_body, cc, reply_to
                )

                if attachments:
                    self._add_attachments(msg, attachments)

                recipients = self._collect_recipients(to_email, cc, bcc)

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(self.from_email, recipients, msg.as_string())

                logger.info(f"Email sent via SMTP to {to_email}")
                return True
            except Exception as e:
                logger.error(f"SMTP email error: {e}", exc_info=True)
                return False

        # Run synchronous SMTP in executor
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _sync_send)

    async def _send_via_sendgrid(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """Send email via SendGrid API"""
        try:
            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email, "name": self.from_name},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            }

            # Add HTML content
            if html_body:
                payload["content"].append({"type": "text/html", "value": html_body})

            # Add CC
            if cc:
                payload["personalizations"][0]["cc"] = [
                    {"email": email} for email in cc
                ]

            # Add BCC
            if bcc:
                payload["personalizations"][0]["bcc"] = [
                    {"email": email} for email in bcc
                ]

            # Add reply-to
            if reply_to:
                payload["reply_to"] = {"email": reply_to}

            # Add attachments
            if attachments:
                import base64

                payload["attachments"] = [
                    {
                        "content": base64.b64encode(att["content"]).decode(),
                        "filename": att["filename"],
                        "type": att.get("type", "application/octet-stream"),
                        "disposition": "attachment",
                    }
                    for att in attachments
                ]

            # Send via SendGrid API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )

                if response.status_code in (200, 202):
                    logger.info(f"Email sent via SendGrid to {to_email}")
                    return True
                else:
                    logger.error(
                        f"SendGrid error: {response.status_code} - {response.text}"
                    )
                    return False

        except Exception as e:
            logger.error(f"SendGrid email error: {e}", exc_info=True)
            return False

    # Pre-defined email templates
    async def send_booking_confirmation(
        self, to_email: str, booking_data: Dict[str, Any]
    ) -> bool:
        """Send booking confirmation email"""
        subject = f"Booking Confirmed - {booking_data.get('pooja_name', 'Pooja')}"
        body = f"""
Namaste!

Your booking has been confirmed.

Booking Details:
- Booking ID: {booking_data.get('booking_id')}
- Pooja: {booking_data.get('pooja_name')}
- Acharya: {booking_data.get('acharya_name')}
- Date: {booking_data.get('date')}
- Time: {booking_data.get('time')}
- Location: {booking_data.get('location')}
- Amount: ₹{booking_data.get('amount')}

The Acharya will contact you before the scheduled time.

Thank you for choosing Savitara.

Om Namah Shivaya
Team Savitara
        """
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            body=body,
            template="booking_confirmation",
            template_context=booking_data,
        )

    async def send_payment_receipt(
        self, to_email: str, payment_data: Dict[str, Any]
    ) -> bool:
        """Send payment receipt email"""
        subject = f"Payment Receipt - ₹{payment_data.get('amount')}"
        body = f"""
Namaste!

Your payment has been received successfully.

Payment Details:
- Receipt ID: {payment_data.get('receipt_id')}
- Amount: ₹{payment_data.get('amount')}
- Payment Method: {payment_data.get('method')}
- Date: {payment_data.get('date')}
- Booking ID: {payment_data.get('booking_id')}

This is your official payment receipt.

Thank you for choosing Savitara.

Om Namah Shivaya
Team Savitara
        """
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            body=body,
            template="payment_receipt",
            template_context=payment_data,
        )

    async def send_acharya_verification_status(
        self, to_email: str, name: str, status: str, reason: Optional[str] = None
    ) -> bool:
        """Send Acharya verification status email"""
        if status == "approved":
            subject = "Welcome to Savitara - Verification Approved!"
            body = f"""
Namaste Pandit {name} ji!

Congratulations! Your profile has been verified and approved.

You can now:
- Receive booking requests from Grihastas
- Manage your availability
- Accept payments for your services

Please complete your pooja catalog and set your availability.

Welcome to the Savitara family!

Om Namah Shivaya
Team Savitara
            """
        else:
            subject = "Savitara Profile Verification - Additional Information Required"
            body = f"""
Namaste Pandit {name} ji!

Thank you for registering on Savitara.

Unfortunately, we need additional information to complete your verification.

Reason: {reason or 'Please contact support for details'}

Please update your profile or contact our support team for assistance.

We look forward to having you on the platform.

Om Namah Shivaya
Team Savitara
            """

        return await self.send_email(to_email=to_email, subject=subject, body=body)

    async def send_booking_reminder(
        self, to_email: str, booking_data: Dict[str, Any]
    ) -> bool:
        """Send booking reminder email"""
        subject = (
            f"Reminder: Upcoming Pooja Tomorrow - {booking_data.get('pooja_name')}"
        )
        body = f"""
Namaste!

This is a reminder for your upcoming pooja tomorrow.

Booking Details:
- Pooja: {booking_data.get('pooja_name')}
- Acharya: {booking_data.get('acharya_name')}
- Date: {booking_data.get('date')}
- Time: {booking_data.get('time')}
- Location: {booking_data.get('location')}

Please ensure everything is prepared for the pooja.
Contact the Acharya through the app if you have any questions.

Om Namah Shivaya
Team Savitara
        """
        return await self.send_email(to_email=to_email, subject=subject, body=body)

    async def send_welcome_email(self, to_email: str, name: str, role: str) -> bool:
        """Send welcome email to new users"""
        subject = "Welcome to Savitara - Your Spiritual Journey Begins!"

        if role == "grihasta":
            body = f"""
Namaste {name} ji!

Welcome to Savitara - Your trusted platform for authentic Hindu rituals and spiritual services.

As a Grihasta (householder), you can now:
- Find verified Acharyas in your area
- Book poojas and spiritual services
- Track your bookings and get reminders
- Chat with Acharyas for guidance
- Participate in community discussions

Start your spiritual journey by exploring Acharyas and their services.

Om Namah Shivaya
Team Savitara
            """
        else:
            body = f"""
Namaste Pandit {name} ji!

Welcome to Savitara - Your platform to serve devotees and share spiritual wisdom.

Your registration is received. Our team will verify your profile within 24-48 hours.

Once verified, you can:
- Receive booking requests
- Manage your schedule and availability
- Accept secure payments
- Build your reputation through reviews
- Connect with devotees seeking guidance

Thank you for joining the Savitara family!

Om Namah Shivaya
Team Savitara
            """

        return await self.send_email(to_email=to_email, subject=subject, body=body)

    async def send_otp_email(self, to_email: str, otp: str, purpose: str) -> bool:
        """Send OTP verification email"""
        subject = f"Your Savitara OTP - {purpose}"
        body = f"""
Namaste!

Your OTP for {purpose} is: {otp}

This OTP is valid for 10 minutes.

If you did not request this OTP, please ignore this email or contact support.

Om Namah Shivaya
Team Savitara
        """
        return await self.send_email(to_email=to_email, subject=subject, body=body)


# Create singleton instance
email_service = EmailService()
