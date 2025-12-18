"""
Email Service
Sends notifications to operators when a booking request is made.
Runs in background with automatic retries.
"""

import smtplib
import asyncio
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime
from app.config import settings
from app.models.schemas import LeadState


class EmailService:
    """
    Handles sending email notifications to the operations team.
    Supports background sending with retries.
    """
    
    MAX_RETRIES = 3
    RETRY_DELAYS = [5, 15, 30]  # seconds between retries
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.operator_emails = settings.OPERATOR_EMAILS
        
        # Check if email is configured
        self._configured = all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password,
            self.operator_emails
        ])
        
        if not self._configured:
            print("⚠️  Email service not configured - notifications will be logged only")
    
    def send_booking_notification_background(
        self,
        lead: LeadState,
        session_id: str,
        selected_aircraft: Optional[str] = None,
        conversation_summary: Optional[str] = None
    ) -> None:
        """
        Queue booking notification to be sent in background.
        This returns immediately and sends email asynchronously.
        """
        # Create a thread to handle the email sending with retries
        thread = threading.Thread(
            target=self._send_with_retries,
            args=(lead, session_id, selected_aircraft, conversation_summary),
            daemon=True  # Thread dies when main process dies
        )
        thread.start()
        print(f"📧 Email notification queued for background sending...")
    
    def _send_with_retries(
        self,
        lead: LeadState,
        session_id: str,
        selected_aircraft: Optional[str],
        conversation_summary: Optional[str]
    ) -> None:
        """
        Attempt to send emails with retry logic.
        Runs in a background thread.
        """
        import time
        
        subject = f"🛩️ New Booking Request - {lead.name or 'Unknown Client'}"
        html_content = self._build_booking_email_html(
            lead, session_id, selected_aircraft, conversation_summary
        )
        text_content = self._build_booking_email_text(
            lead, session_id, selected_aircraft, conversation_summary
        )
        
        if not self._configured:
            # Log the notification instead
            print("\n" + "="*60)
            print("📧 BOOKING NOTIFICATION (Email not configured)")
            print("="*60)
            print(text_content)
            print("="*60 + "\n")
            return
        
        # Send to each operator with retries
        for operator_email in self.operator_emails:
            success = False
            last_error = None
            
            for attempt in range(self.MAX_RETRIES):
                try:
                    self._send_email(
                        to_email=operator_email,
                        subject=subject,
                        html_content=html_content,
                        text_content=text_content
                    )
                    print(f"✅ Booking notification sent to {operator_email}")
                    success = True
                    break
                except Exception as e:
                    last_error = e
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        print(f"⚠️  Email to {operator_email} failed (attempt {attempt + 1}/{self.MAX_RETRIES}): {e}")
                        print(f"   Retrying in {delay}s...")
                        time.sleep(delay)
                    else:
                        print(f"❌ Email to {operator_email} failed after {self.MAX_RETRIES} attempts: {last_error}")
    
    def send_booking_notification(
        self,
        lead: LeadState,
        session_id: str,
        selected_aircraft: Optional[str] = None,
        conversation_summary: Optional[str] = None
    ) -> bool:
        """
        Send booking notification synchronously (legacy method).
        Use send_booking_notification_background for non-blocking calls.
        """
        subject = f"🛩️ New Booking Request - {lead.name or 'Unknown Client'}"
        
        html_content = self._build_booking_email_html(
            lead, session_id, selected_aircraft, conversation_summary
        )
        text_content = self._build_booking_email_text(
            lead, session_id, selected_aircraft, conversation_summary
        )
        
        if not self._configured:
            print("\n" + "="*60)
            print("📧 BOOKING NOTIFICATION (Email not configured)")
            print("="*60)
            print(text_content)
            print("="*60 + "\n")
            return True
        
        success = True
        for operator_email in self.operator_emails:
            try:
                self._send_email(
                    to_email=operator_email,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content
                )
                print(f"✅ Booking notification sent to {operator_email}")
            except Exception as e:
                print(f"❌ Failed to send to {operator_email}: {e}")
                success = False
        
        return success
    
    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str
    ) -> None:
        """Send an email using SMTP."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to_email
        
        # Attach both plain text and HTML versions
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        # Send via SMTP with timeout
        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to_email, msg.as_string())
    
    def _build_booking_email_html(
        self,
        lead: LeadState,
        session_id: str,
        selected_aircraft: Optional[str],
        conversation_summary: Optional[str]
    ) -> str:
        """Build HTML email content."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        special_requests_html = ""
        if lead.special_requests:
            requests_list = "".join([f"<li>{req}</li>" for req in lead.special_requests])
            special_requests_html = f"<p><strong>Special Requests:</strong></p><ul>{requests_list}</ul>"
        
        aircraft_html = ""
        if selected_aircraft:
            aircraft_html = f'<p><strong>Selected Aircraft:</strong> {selected_aircraft}</p>'
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ margin: 0; font-size: 24px; }}
                .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #eee; }}
                .field {{ margin-bottom: 15px; }}
                .field-label {{ color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }}
                .field-value {{ font-size: 16px; color: #1a1a2e; font-weight: 500; }}
                .route {{ background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37; }}
                .route-arrow {{ color: #d4af37; margin: 0 10px; }}
                .footer {{ background: #1a1a2e; color: #888; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }}
                .cta {{ background: #d4af37; color: #1a1a2e; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✈️ New Booking Request</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.8;">Jetayu Private Aviation</p>
                </div>
                <div class="content">
                    <div class="route">
                        <span style="font-size: 20px; font-weight: bold;">
                            {lead.route_from or "TBD"} 
                            <span class="route-arrow">→</span> 
                            {lead.route_to or "TBD"}
                        </span>
                        <br>
                        <span style="color: #666;">{lead.date_time or "Date TBD"} • {lead.pax or "?"} passengers</span>
                    </div>
                    
                    <div class="field">
                        <div class="field-label">Client Name</div>
                        <div class="field-value">{lead.name or "Not provided"}</div>
                    </div>
                    
                    <div class="field">
                        <div class="field-label">Email</div>
                        <div class="field-value">{lead.email or "Not provided"}</div>
                    </div>
                    
                    {aircraft_html}
                    {special_requests_html}
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    
                    <div class="field">
                        <div class="field-label">Session ID</div>
                        <div class="field-value" style="font-family: monospace; font-size: 12px;">{session_id}</div>
                    </div>
                    
                    <div class="field">
                        <div class="field-label">Received</div>
                        <div class="field-value">{timestamp}</div>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated notification from Jetayu Concierge System.</p>
                    <p>Please follow up with the client within 30 minutes.</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    def _build_booking_email_text(
        self,
        lead: LeadState,
        session_id: str,
        selected_aircraft: Optional[str],
        conversation_summary: Optional[str]
    ) -> str:
        """Build plain text email content."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        special_requests_text = ""
        if lead.special_requests:
            special_requests_text = "\nSpecial Requests:\n" + "\n".join([f"  - {req}" for req in lead.special_requests])
        
        aircraft_text = f"\nSelected Aircraft: {selected_aircraft}" if selected_aircraft else ""
        
        return f"""
NEW BOOKING REQUEST - Jetayu Private Aviation
================================================

ROUTE: {lead.route_from or "TBD"} → {lead.route_to or "TBD"}
DATE: {lead.date_time or "TBD"}
PASSENGERS: {lead.pax or "TBD"}

CLIENT DETAILS:
  Name: {lead.name or "Not provided"}
  Email: {lead.email or "Not provided"}
{aircraft_text}
{special_requests_text}

------------------------------------------------
Session ID: {session_id}
Received: {timestamp}
------------------------------------------------

Please follow up with the client within 30 minutes.
"""


# Singleton
_email_service = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


# Proxy
class EmailServiceProxy:
    def __getattr__(self, name):
        return getattr(get_email_service(), name)


email_service = EmailServiceProxy()
