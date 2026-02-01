# Services package
from .supabase_client import get_supabase_client, SupabaseClient
from .elevenlabs_service import get_elevenlabs_service, ElevenLabsService
from .email_service import get_email_service, EmailService

# Google Calendar service (optional - may not be present in all deployments)
try:
    from .google_calendar_service import get_calendar_service, GoogleCalendarService
except ImportError:
    pass
