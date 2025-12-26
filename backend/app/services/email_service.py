"""
Email Service
Sends notifications to operators when a booking request is made.
Uses Resend API (HTTP-based) instead of SMTP.
Runs in background with automatic retries.
"""

import httpx
import threading
import logging
from typing import List, Optional, Set
from datetime import datetime
from app.config import settings
from app.models.schemas import LeadState

logger = logging.getLogger(__name__)


class EmailService:
    """
    Handles sending email notifications to the operations team.
    Supports background sending with retries.
    Uses Resend API for reliable email delivery.
    """
    
    MAX_RETRIES = 3
    RETRY_DELAYS = [5, 15, 30]  # seconds between retries
    RESEND_API_URL = "https://api.resend.com/emails"
    
    def __init__(self):
        self.resend_api_key = settings.RESEND_API_KEY
        self.from_email = settings.FROM_EMAIL
        self.operator_emails = settings.OPERATOR_EMAILS
        
        # Idempotency tracking: prevent duplicate emails for same booking
        self._sent_emails: Set[str] = set()
        self._sent_emails_lock = threading.Lock()
        
        # CRITICAL: Verify API key is loaded correctly
        import os
        raw_key = os.getenv("RESEND_API_KEY", "")
        if raw_key:
            logger.info(f"RESEND_API_KEY loaded: {raw_key[:10]}...{raw_key[-4:] if len(raw_key) > 14 else '***'} (length: {len(raw_key)})")
            if not raw_key.startswith("re_"):
                logger.warning("RESEND_API_KEY should start with 're_'")
        else:
            logger.error("RESEND_API_KEY is missing or empty!")
        
        # Check if email is configured
        self._configured = all([
            self.resend_api_key,
            self.from_email,
            self.operator_emails
        ])
        
        if not self._configured:
            logger.warning("Email service not configured - notifications will be logged only")
            if not self.resend_api_key:
                logger.warning("Missing RESEND_API_KEY environment variable")
            if not self.operator_emails:
                logger.warning("Missing OPERATOR_EMAILS environment variable")
        
        # Validate FROM_EMAIL domain
        if self.from_email:
            if "resend.dev" in self.from_email:
                logger.info(f"Using Resend default domain: {self.from_email}")
            elif "flyjetayu.com" in self.from_email:
                logger.info(f"Using production domain: {self.from_email} (ensure domain is verified in Resend)")
            else:
                logger.warning(f"FROM_EMAIL is set to '{self.from_email}' - ensure this domain is verified in Resend")
    
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
        Implements idempotency: same session_id won't send duplicate emails.
        """
        # Idempotency check: prevent duplicate emails for same booking
        with self._sent_emails_lock:
            if session_id in self._sent_emails:
                logger.info(f"Email already sent for session {session_id}, skipping duplicate")
                return
            # Mark as queued immediately to prevent race conditions
            self._sent_emails.add(session_id)
        
        # Create a thread to handle the email sending with retries
        # Use non-daemon thread so emails complete even if main process shuts down
        thread = threading.Thread(
            target=self._send_with_retries,
            args=(lead, session_id, selected_aircraft, conversation_summary),
            daemon=False  # Non-daemon: thread completes even if main process exits
        )
        thread.start()
        logger.info(f"Email notification queued for background sending (session_id={session_id})")
    
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
            logger.info("BOOKING NOTIFICATION (Email not configured)", extra={
                "session_id": session_id,
                "client_name": lead.name,
                "route": f"{lead.route_from} → {lead.route_to}"
            })
            logger.debug(f"Email content (not sent): {text_content}")
            return
        
        # Send to each operator with retries
        all_success = True
        for operator_email in self.operator_emails:
            success = False
            last_error = None
            
            for attempt in range(self.MAX_RETRIES):
                try:
                    response_id = self._send_email(
                        to_email=operator_email,
                        subject=subject,
                        html_content=html_content,
                        text_content=text_content
                    )
                    logger.info("Booking notification sent successfully", extra={
                        "session_id": session_id,
                        "recipient": operator_email,
                        "resend_id": response_id,
                        "attempt": attempt + 1
                    })
                    success = True
                    break
                except Exception as e:
                    last_error = e
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning(f"Email send failed, retrying", extra={
                            "session_id": session_id,
                            "recipient": operator_email,
                            "attempt": attempt + 1,
                            "max_retries": self.MAX_RETRIES,
                            "retry_delay": delay,
                            "error": str(e)
                        })
                        time.sleep(delay)
                    else:
                        logger.error("Email send failed after all retries", extra={
                            "session_id": session_id,
                            "recipient": operator_email,
                            "attempts": self.MAX_RETRIES,
                            "error": str(last_error)
                        })
                        all_success = False
        
        if not all_success:
            # If all recipients failed, remove from sent set to allow retry
            with self._sent_emails_lock:
                self._sent_emails.discard(session_id)
    
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
            logger.info("BOOKING NOTIFICATION (Email not configured)", extra={
                "session_id": session_id,
                "client_name": lead.name,
                "route": f"{lead.route_from} → {lead.route_to}"
            })
            logger.debug(f"Email content (not sent): {text_content}")
            return True
        
        success = True
        for operator_email in self.operator_emails:
            try:
                response_id = self._send_email(
                    to_email=operator_email,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content
                )
                logger.info("Booking notification sent successfully", extra={
                    "session_id": session_id,
                    "recipient": operator_email,
                    "resend_id": response_id
                })
            except Exception as e:
                logger.error("Failed to send booking notification", extra={
                    "session_id": session_id,
                    "recipient": operator_email,
                    "error": str(e)
                })
                success = False
        
        return success
    
    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str
    ) -> str:
        """
        Send an email using Resend API.
        Returns the Resend response ID on success.
        Raises exception on failure.
        """
        if not self.resend_api_key:
            raise ValueError("RESEND_API_KEY is not configured")
        
        # Format sender email for Resend API
        # For onboarding@resend.dev (default), use just the email
        # For verified domains (e.g., flyjetayu.com), use "Name <email@domain.com>" format
        if "resend.dev" in self.from_email:
            # Use simple email format for Resend's default domain
            from_email_formatted = self.from_email
        else:
            # For custom verified domains (including flyjetayu.com), use formatted name
            from_email_formatted = f"Jetayu <{self.from_email}>"
        
        # Prepare request payload
        payload = {
            "from": from_email_formatted,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }
        
        headers = {
            "Authorization": f"Bearer {self.resend_api_key}",
            "Content-Type": "application/json",
        }
        
        # Send request to Resend API
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    self.RESEND_API_URL,
                    json=payload,
                    headers=headers,
                )
                
                # Log full response on error for debugging
                if response.status_code >= 400:
                    error_body = ""
                    try:
                        error_body = response.text
                    except:
                        error_body = "Could not read error response"
                    
                    logger.error("Resend API error", extra={
                        "status_code": response.status_code,
                        "url": self.RESEND_API_URL,
                        "from": from_email_formatted,
                        "to": to_email,
                        "error_response": error_body
                    })
                    
                    # Raise with detailed error
                    response.raise_for_status()
                
                # Parse response
                response_data = response.json()
                response_id = response_data.get("id", "unknown")
                
                return response_id
        except httpx.HTTPStatusError as e:
            # Enhanced error logging
            error_body = ""
            if hasattr(e.response, 'text'):
                try:
                    error_body = e.response.text
                except:
                    pass
            
            logger.error("Resend HTTP error", extra={
                "status_code": e.response.status_code,
                "error_response": error_body,
                "from": from_email_formatted,
                "to": to_email
            })
            raise
    
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


# Test function to verify Resend configuration on startup
def test_resend_connection():
    """
    Test Resend API connection with a minimal email.
    Called once on app startup to verify configuration.
    """
    import os
    api_key = os.getenv("RESEND_API_KEY", "")
    
    if not api_key:
        logger.warning("Skipping Resend test - RESEND_API_KEY not set")
        return False
    
    if not api_key.startswith("re_"):
        logger.warning(f"Skipping Resend test - API key format invalid (should start with 're_'), got: {api_key[:20]}...")
        return False
    
    # Get test recipient from env or use a default
    test_recipient = os.getenv("RESEND_TEST_EMAIL", "delivered@resend.dev")
    
    try:
        # Use Resend's default domain for testing - exact format required
        test_payload = {
            "from": "onboarding@resend.dev",  # Must be exactly this for unverified accounts
            "to": [test_recipient],
            "subject": "Resend API Test - Jetayu",
            "html": "<p>This is a test email from Jetayu to verify Resend API configuration.</p>",
            "text": "This is a test email from Jetayu to verify Resend API configuration.",
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        logger.info(f"Testing Resend API connection: from=onboarding@resend.dev, to={test_recipient}")
        
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                "https://api.resend.com/emails",
                json=test_payload,
                headers=headers,
            )
            
            if response.status_code in [200, 201, 202]:
                response_data = response.json()
                resend_id = response_data.get('id', 'unknown')
                logger.info(f"Resend API test successful", extra={"resend_id": resend_id})
                return True
            else:
                logger.error("Resend API test failed", extra={
                    "status_code": response.status_code,
                    "error_response": response.text[:200] if hasattr(response, 'text') else "N/A"
                })
                return False
                
    except httpx.HTTPStatusError as e:
        logger.error("Resend API test HTTP error", extra={
            "status_code": e.response.status_code,
            "error_response": e.response.text[:200] if hasattr(e.response, 'text') else "N/A"
        })
        return False
    except Exception as e:
        logger.error("Resend API test error", extra={"error_type": type(e).__name__, "error": str(e)})
        return False
