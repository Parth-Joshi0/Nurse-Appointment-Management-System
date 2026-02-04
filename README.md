# Nurse AI Appointment Follow-up

A hackathon project for managing patient appointments with automated AI-powered outbound calling for rescheduling missed appointments.

## Overview

This system provides a tablet-based web app for nurses to:
- View and manage patient appointments via calendar
- Automatically call patients who miss appointments (via ElevenLabs AI)
- Receive follow-up flags when automated rescheduling fails
- Sync appointments with Google Calendar

## Demo & Devpost Link
  [Devpost Link](https://devpost.com/software/closedloop-ai?_gl=1*1puuekf*_gcl_au*MTI5ODY0NjE2OC4xNzYzNzc2Mjcx*_ga*MjA2OTU2OTU3OS4xNzYzNzc2Mjcy*_ga_0YHJK3Y10M*czE3NzAxNzA1NzMkbzIxJGcxJHQxNzcwMTcwNTgzJGo1MCRsMCRoMA..)
  
  [Youtube Demo](https://www.youtube.com/watch?v=DkfdOxq3l8o)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  FastAPI Backend│────▶│    Supabase     │
│  (Tablet App)   │     │                 │     │   (PostgreSQL)  │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
           ┌────────────┐ ┌────────────┐ ┌────────────┐
           │ ElevenLabs │ │  Google    │ │  Webhooks  │
           │ Outbound   │ │  Calendar  │ │  (Inbound) │
           │ Calling    │ │  API       │ │            │
           └────────────┘ └────────────┘ └────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- ElevenLabs account (with Conversational AI access)
- Twilio account with phone number
- Google Cloud project (for Calendar API)
- Cloudflare Tunnel (for webhook exposure)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd nurse-ai-followup
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp ../.env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Run the server
uvicorn main:app --reload
```

The backend will start on `http://localhost:8000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev

# Go to http://localhost:3000/ in browser
```

### 4. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your project dashboard
3. Copy and run the contents of `database/schema.sql`
4. Copy your API keys to `.env`

### 5. Agent Calls Setup (ElevenLabs + Twilio)

The agent calls service bridges Twilio phone calls to ElevenLabs AI agents.

```bash
cd agent-calls

# Install dependencies
pip install fastapi uvicorn twilio websockets pydantic

# Configure your credentials in the script (see Agent Calls Configuration section)

# Set up Cloudflare Tunnel (in a separate terminal)
cloudflared tunnel --url http://localhost:8000

# Copy the https URL from the output and set it as environment variable
export WEBHOOK_BASE_URL="https://your-tunnel-url.trycloudflare.com"

# Run the agent calls server
python agent_calls.py
```

## Project Structure

```
/
├── backend/                # FastAPI backend
├── agent-calls/            # ElevenLabs + Twilio voice bridge
│   ├── SampleAdd.py        # Test Adding to Database
│   └── agent_calls.py      # WebSocket bridge for AI calls
│   ├── main.py             # Application entry point
│   ├── requirements.txt    # Python dependencies
│   ├── models/
│   │   └── schemas.py      # Pydantic models
│   ├── routers/
│   │   ├── appointments.py # Appointment CRUD
│   │   ├── auth.py         # Authentication
│   │   ├── calendar.py     # Google Calendar sync
│   │   ├── calls.py        # ElevenLabs call management
│   │   ├── flags.py        # Follow-up flags
│   │   └── webhooks.py     # Webhook handlers
│   └── services/
│       ├── supabase_client.py
│       ├── elevenlabs_service.py
│       └── google_calendar_service.py
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable components
│   │   │   ├── CalendarView.jsx
│   │   │   ├── AppointmentCard.jsx
│   │   │   └── FlagBanner.jsx
│   │   └── pages/         # Page components
│   │       ├── Dashboard.jsx
│   │       ├── AppointmentDetail.jsx
│   │       ├── Flags.jsx
│   │       └── Login.jsx
│   └── package.json
│
│
├── database/
│   └── schema.sql         # Supabase database schema
│
├── shared/
│   └── types.ts           # Shared TypeScript types
│
└── .env.example           # Environment variables template
```

## Workflow

### Missed Appointment → Automated Call Flow

```
1. Appointment time passes without check-in
          │
          ▼
2. Backend marks appointment as "missed"
          │
          ▼
3. Nurse can trigger call OR automated job triggers
          │
          ▼
4. Backend calls agent-calls service to initiate outbound call
          │
          ▼
5. ElevenLabs AI agent calls patient via Twilio
   - Explains missed appointment
   - Offers rescheduling options
   - Collects new preferred time
          │
          ▼
6. Call ends → Agent stores context and notifies backend
          │
          ├─── SUCCESS (Rescheduled) ───┐
          │                             ▼
          │                    Update appointment
          │                    Sync to Google Calendar
          │                    Send new invite
          │
          └─── FAILURE (Declined/No Answer) ───┐
                                               ▼
                                      Create follow-up flag
                                      Nurse sees on dashboard
```

### Making Calls from Backend

```python
import requests

# Call the agent-calls service
response = requests.post("https://your-tunnel-url.trycloudflare.com/make-call", json={
    "phone_number": "+19054628586",
    "dynamic_variables": {
        "patient_name": "John Doe",
        "patient_age": "45",
        "specialist_type": "Cardiologist",
        "cancelled_appointment_time": "Jan 20, 2026",
        "selected_time": ""
    }
})

print(response.json())
# Output: {"success": true, "call_sid": "CAxxxx..."}
```

## Environment Variables

See `.env.example` for all required variables:

### Backend & Database
| Variable | Description |
| --------------------------- | --------------------------------------- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `BACKEND_BASE_URL` | Public URL for webhooks |
| `WEBHOOK_SECRET` | Secret for verifying webhooks |

### Google Calendar
| Variable | Description |
| --------------------------- | --------------------------------------- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### ElevenLabs
| Variable | Description |
| --------------------------- | --------------------------------------- |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | Your conversational agent ID |

### Twilio (for Agent Calls)
Configure these directly in the `agent-calls/agent_calls.py` file:

```python
TWILIO_ACCOUNT_SID = "your_twilio_account_sid"
TWILIO_AUTH_TOKEN = "your_twilio_auth_token"
TWILIO_PHONE_NUMBER = "+1234567890"  # Your Twilio number
```

### Cloudflare Tunnel
```bash
export WEBHOOK_BASE_URL="https://your-tunnel-url.trycloudflare.com"
```

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Local Webhook Testing

#### Setting up Cloudflare Tunnel

```bash
# Install cloudflared (if not already installed)
# On macOS:
brew install cloudflare/cloudflare/cloudflared

# On Linux:
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Start the tunnel (in a separate terminal)
cloudflared tunnel --url http://localhost:8000

# Copy the https URL from the output (e.g., https://abc-def-123.trycloudflare.com)
# Then export it:
export WEBHOOK_BASE_URL="https://abc-def-123.trycloudflare.com"
```

## API Endpoints

### Main Backend Endpoints

#### Appointments
- `GET /api/appointments/` - List appointments
- `POST /api/appointments/` - Create appointment
- `GET /api/appointments/{id}` - Get appointment
- `PATCH /api/appointments/{id}` - Update appointment
- `POST /api/appointments/{id}/reschedule` - Reschedule
- `POST /api/appointments/{id}/mark-missed` - Mark as missed

#### Calls
- `POST /api/calls/initiate` - Initiate outbound call
- `GET /api/calls/{id}` - Get call status

#### Flags
- `GET /api/flags/open` - Get open flags
- `POST /api/flags/{id}/resolve` - Resolve flag
- `POST /api/flags/{id}/dismiss` - Dismiss flag

#### Calendar
- `POST /api/calendar/sync/{appointment_id}` - Sync to Google Calendar

#### Webhooks
- `POST /api/webhooks/elevenlabs` - ElevenLabs callback

### Agent Calls Service Endpoints

#### Health Check
- `GET /` - Health check endpoint

**Response:**
```json
{
  "status": "ready",
  "agent": "your_agent_id"
}
```

#### Make Call
- `POST /make-call` - Initiate an outbound call

**Request Body:**
```json
{
  "phone_number": "+1234567890",
  "dynamic_variables": {
    "patient_name": "John Doe",
    "patient_age": "45",
    "specialist_type": "Cardiologist",
    "cancelled_appointment_time": "Jan 20, 2026",
    "selected_time": ""
  }
}
```

**Response:**
```json
{
  "success": true,
  "call_sid": "CAxxxx..."
}
```

#### Incoming Call
- `POST /incoming-call` - Webhook for handling incoming Twilio calls

#### Media Stream
- `WebSocket /media-stream` - WebSocket endpoint for real-time audio streaming

## How the Agent Calls Work

1. **Call Initiation**: Backend POSTs to `/make-call` on agent-calls service
2. **Twilio Connection**: Twilio connects to webhook and establishes a media stream
3. **ElevenLabs Bridge**: Server opens WebSocket to ElevenLabs agent
4. **Bidirectional Audio**: Audio flows in real-time between caller and AI agent
5. **Context Tracking**: Conversation data (like selected appointment times) is stored
6. **Auto Hangup**: Call ends automatically after agent completes conversation

### Call Context Storage

The system stores call context in memory using the call SID:

```python
# Access stored context
call_context = CALL_CONTEXT.get(call_sid)
selected_time = call_context.get("selected_time")
```

This is useful for:
- Extracting selected appointment times from patient conversations
- Storing patient preferences
- Tracking rebooking outcomes
- Managing cancelled appointment follow-ups

## TODOs

- [ ] Implement actual authentication (currently stubbed)
- [ ] Add background job for auto-detecting missed appointments
- [ ] Implement retry logic for failed calls
- [ ] Add real-time updates via WebSocket
- [ ] Implement proper ElevenLabs webhook signature verification
- [ ] Add comprehensive test coverage
- [ ] Set up CI/CD pipeline
- [ ] Replace in-memory CALL_CONTEXT with Redis or database
- [ ] Add authentication to agent-calls API endpoints
- [ ] Use environment variables for all secrets in agent-calls
- [ ] Set up HTTPS with valid SSL certificate for production

## Troubleshooting

### Connection Issues
- Verify your webhook URL is publicly accessible
- Check that Cloudflare Tunnel is running (`cloudflared tunnel --url http://localhost:8000`)
- Ensure firewall allows WebSocket connections
- Confirm the `WEBHOOK_BASE_URL` environment variable is set correctly

### Audio Issues
- Confirm ElevenLabs agent is active and configured
- Check Twilio phone number has voice capabilities
- Verify API keys are correct

### Call Not Connecting
- Check Twilio account has sufficient credits
- Verify phone number format includes country code (+1...)
- Review Twilio debugger logs in console

### Frontend Not Loading
- Ensure backend is running on `http://localhost:8000`
- Check that all environment variables are set correctly
- Clear browser cache and try again

## License

MIT License - Built for SparksHacks Hackathon 2026

---

## Credits

Built with:
- FastAPI (Python backend)
- React (Frontend)
- Supabase (Database)
- ElevenLabs (Conversational AI)
- Twilio (Phone calls)
- Google Calendar API (Calendar sync)
- Cloudflare Tunnel (Webhook exposure)
