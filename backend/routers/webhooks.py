"""
Webhooks router.

Handles incoming webhooks from external services:
- ElevenLabs: Call completion events with outcomes

IMPORTANT: Webhook endpoints must:
1. Verify request authenticity (signature validation)
2. Respond quickly (do heavy processing async)
3. Be idempotent (same webhook may be delivered multiple times)
"""

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Header, status, BackgroundTasks

from models.schemas import (
    ElevenLabsWebhookPayload,
    WebhookResponse,
    CallStatus,
    CallResolution,
    FlagPriority
)
from services import get_supabase_client, get_elevenlabs_service

router = APIRouter()


@router.post("/elevenlabs", response_model=WebhookResponse)
async def handle_elevenlabs_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature")
):
    """
    Handle ElevenLabs call completion webhook.
    
    WORKFLOW:
    1. Verify webhook signature
    2. Parse payload and find our call attempt record
    3. Update call attempt with outcome
    4. Based on outcome:
       - SUCCESS (rescheduled): Update referral + sync calendar
       - FAILURE (declined/no-answer): Create nurse follow-up flag
    
    IMPORTANT: This endpoint should respond quickly.
    Heavy processing is done in background tasks.
    
    Expected Payload (verify against ElevenLabs docs):
    {
        "call_id": "elevenlabs-call-uuid",
        "status": "completed" | "failed" | "no_answer",
        "outcome": "rescheduled" | "declined" | "voicemail" | "callback_requested",
        "new_appointment_time": "2026-02-01T14:00:00Z",  // If rescheduled
        "transcript": "...",
        "duration_seconds": 120,
        "metadata": {
            "referral_id": "our-referral-uuid",
            "call_log_id": "our-call-log-uuid"
        }
    }
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify webhook signature
    elevenlabs = get_elevenlabs_service()
    if not elevenlabs.verify_webhook_signature(body, x_webhook_signature or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )
    
    # Parse payload
    try:
        payload_dict = await request.json()
        payload = ElevenLabsWebhookPayload(**payload_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payload: {str(e)}"
        )
    
    # Find our call log record (we'll use twilio_call_sid for now as we don't have elevenlabs_id)
    # Note: This assumes ElevenLabs call_id maps to our internal tracking
    db = get_supabase_client()
    # For now, use the metadata to find the call_log
    call_log_id = payload.metadata.get("call_log_id") if payload.metadata else None

    if not call_log_id:
        print(f"Missing call_log_id in ElevenLabs webhook metadata")
        return WebhookResponse(success=True, message="Call log ID not found, ignoring")

    call_log = await db.get_call_log(call_log_id)
    if not call_log:
        print(f"Unknown call_log_id: {call_log_id}")
        return WebhookResponse(success=True, message="Call log not found, ignoring")

    # Schedule background processing
    background_tasks.add_task(
        process_call_outcome,
        call_log=call_log,
        payload=payload
    )
    
    # Respond immediately
    return WebhookResponse(success=True, message="Webhook received, processing")


async def process_call_outcome(call_log: dict, payload: ElevenLabsWebhookPayload):
    """
    Background task to process call outcome.

    Handles:
    - Updating call log record
    - Rescheduling referral (if successful)
    - Creating follow-up flag (if failed)
    - Syncing to Google Calendar (if rescheduled)
    """
    db = get_supabase_client()
    
    # Map ElevenLabs status to our status
    status_map = {
        "completed": CallStatus.COMPLETED.value,
        "failed": CallStatus.FAILED.value,
        "no_answer": CallStatus.NO_ANSWER.value
    }
    
    resolution_map = {
        "rescheduled": CallResolution.RESCHEDULED.value,
        "declined": CallResolution.DECLINED.value,
        "voicemail": CallResolution.LEFT_VOICEMAIL.value,
        "callback_requested": CallResolution.CALLBACK_REQUESTED.value,
        "no_answer": CallResolution.NO_ANSWER.value
    }

    # Update call log record
    call_update = {
        "status": status_map.get(payload.status, CallStatus.COMPLETED.value),
        "resolution": resolution_map.get(payload.outcome) if payload.outcome else None,
        "completed_at": datetime.utcnow().isoformat(),
        "transcript": payload.transcript,
        "duration_seconds": payload.duration_seconds
    }

    await db.update_call_log(call_log["id"], call_update)

    referral_id = call_log["referral_id"]

    # Handle based on outcome
    if payload.outcome == "rescheduled" and payload.new_appointment_time:
        # SUCCESS: Patient agreed to reschedule
        print(f"📞 Call outcome: RESCHEDULED - Updating referral {referral_id}")
        print(f"   Status will change from MISSED → SCHEDULED")
        print(f"   New appointment: {payload.new_appointment_time}")

        await handle_successful_reschedule(
            referral_id=referral_id,
            new_datetime=payload.new_appointment_time
        )
    else:
        # FAILURE: Need nurse follow-up
        print(f"📞 Call outcome: {payload.outcome or payload.status}")
        print(f"   Referral {referral_id} remains MISSED - creating follow-up flag")

        await create_follow_up_flag(
            referral_id=referral_id,
            call_outcome=payload.outcome or payload.status,
            transcript=payload.transcript
        )


async def handle_successful_reschedule(
    referral_id: str,
    new_datetime: datetime
):
    """
    Handle successful rescheduling by AI agent.

    Full workflow:
    1. Update referral status to SCHEDULED (not MISSED!)
    2. Update scheduled_date
    3. Update Google Calendar event (if exists)
    4. Send rescheduled email notification
    5. Log the change
    """
    from services import get_email_service
    from models.schemas import EmailType, EmailStatus

    # Try to import Google Calendar service (may not be available)
    try:
        from services import get_calendar_service
        calendar_available = True
    except (ImportError, AttributeError):
        calendar_available = False

    db = get_supabase_client()

    # Get current referral state
    existing = await db.get_referral(referral_id)
    if not existing:
        print(f"Referral {referral_id} not found")
        return

    # Extract old datetime for email
    old_datetime = None
    if existing.get("scheduled_date"):
        try:
            old_datetime = datetime.fromisoformat(existing["scheduled_date"].replace('Z', '+00:00'))
        except:
            pass

    # Update referral - THIS SETS STATUS TO "SCHEDULED"
    # (removing from MISSED status)
    referral = await db.reschedule_referral(
        referral_id,
        new_datetime,
        reason="Rescheduled via automated call"
    )

    if not referral:
        print(f"Failed to reschedule referral {referral_id}")
        return

    print(f"✅ Referral {referral_id} rescheduled: Status changed from {existing.get('status')} to SCHEDULED")
    print(f"   New appointment: {new_datetime}")

    # Update Google Calendar event if it exists and service is available
    if calendar_available and existing.get("calendar_event_id"):
        try:
            calendar = get_calendar_service()
            await calendar.update_referral_event(
                google_event_id=existing["calendar_event_id"],
                scheduled_at=new_datetime,
                notes=f"Rescheduled via automated call. {referral.get('notes', '')}",
                send_update=True
            )
            print(f"✅ Google Calendar event updated: {existing['calendar_event_id']}")
        except Exception as e:
            print(f"⚠️  Failed to update Google Calendar: {e}")

    # Send rescheduled email notification
    if referral.get("patient_email"):
        try:
            email_service = get_email_service()
            email_result = await email_service.send_appointment_rescheduled_email(
                to_email=referral["patient_email"],
                patient_name=referral["patient_name"],
                new_datetime=new_datetime,
                specialist_type=referral["specialist_type"],
                old_datetime=old_datetime,
                location=None,
                reason="Rescheduled via automated call",
                attach_calendar=True
            )

            # Log the email
            if email_result.get("success"):
                email_log_data = {
                    "referral_id": str(referral_id),
                    "email_type": EmailType.APPOINTMENT_RESCHEDULED.value,
                    "recipient_email": referral["patient_email"],
                    "subject": f"Appointment Rescheduled - {referral['specialist_type']}",
                    "status": EmailStatus.SENT.value,
                    "sendgrid_message_id": email_result.get("message_id"),
                    "calendar_invite_attached": True,
                    "sent_at": datetime.now().isoformat()
                }
                await db.create_email_log(email_log_data)
                print(f"✅ Rescheduled email sent to {referral['patient_email']}")
        except Exception as e:
            print(f"⚠️  Failed to send reschedule email: {e}")

    print(f"✅ Successfully completed reschedule workflow for referral {referral_id}")


async def create_follow_up_flag(
    referral_id: str,
    call_outcome: str,
    transcript: Optional[str] = None
):
    """
    Create a nurse follow-up flag after failed reschedule attempt.

    The nurse will see this flag on their dashboard and can
    manually follow up with the patient.
    """
    db = get_supabase_client()

    # Determine priority based on outcome
    priority_map = {
        "declined": FlagPriority.HIGH.value,
        "no_answer": FlagPriority.MEDIUM.value,
        "voicemail": FlagPriority.MEDIUM.value,
        "callback_requested": FlagPriority.HIGH.value,
        "invalid_number": FlagPriority.URGENT.value,
        "failed": FlagPriority.HIGH.value
    }

    # Build description
    description_parts = [
        f"Automated call outcome: {call_outcome}",
        "Patient needs manual follow-up to reschedule missed referral."
    ]

    if transcript:
        description_parts.append(f"\nCall transcript:\n{transcript[:500]}...")

    flag_data = {
        "referral_id": referral_id,
        "title": f"Follow-up needed: {call_outcome.replace('_', ' ').title()}",
        "description": "\n".join(description_parts),
        "priority": priority_map.get(call_outcome, FlagPriority.MEDIUM.value),
        "status": "open"  # Fixed: use lowercase to match FlagStatus enum
    }

    await db.create_flag(flag_data)
    print(f"Created follow-up flag for referral {referral_id}")


# Optional: Health check endpoint for webhook URL validation
@router.get("/elevenlabs")
async def elevenlabs_webhook_verify():
    """
    GET endpoint for webhook URL verification.
    
    Some services ping the webhook URL to verify it's valid
    before allowing registration.
    """
    return {"status": "ok", "service": "elevenlabs-webhook"}
