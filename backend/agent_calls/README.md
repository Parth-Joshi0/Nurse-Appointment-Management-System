# ElevenLabs + Twilio Voice Agent

A WebSocket bridge that connects Twilio phone calls to ElevenLabs conversational AI agents. This allows you to make and receive phone calls powered by ElevenLabs AI agents.

## Features

- Make outbound calls programmatically
- Handle incoming calls
- Real-time audio streaming between Twilio and ElevenLabs
- Dynamic variable injection for personalized conversations
- Automatic call termination after conversation completion
- Context preservation (stores selected appointment times, etc.)

## Prerequisites

- Python 3.8+
- Twilio account with phone number
- ElevenLabs account with conversational AI agent
- Public webhook URL (using Cloudflare Tunnel)

## Setup

### 1. Install Dependencies

```bash
pip install fastapi uvicorn twilio websockets pydantic
```

### 2. Configure API Keys

Open the Python file and add your credentials in the configuration section:

```python
# ============================================================================
# CONFIGURATION - PUT YOUR CREDENTIALS HERE
# ============================================================================

TWILIO_ACCOUNT_SID = "your_twilio_account_sid"
TWILIO_AUTH_TOKEN = "your_twilio_auth_token"
TWILIO_PHONE_NUMBER = "+1234567890"  # Your Twilio number
ELEVENLABS_API_KEY = "your_elevenlabs_api_key"
ELEVENLABS_AGENT_ID = "your_agent_id"
```

### 3. Set Webhook URL

Set your public webhook URL as an environment variable:

```bash
export WEBHOOK_BASE_URL="https://your-tunnel-domain.trycloudflare.com"
```

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

### 4. Run the Server

Start the server from terminal:

```bash
python your_script_name.py
```

The server will start on `http://0.0.0.0:8000`

You should see output like:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 5. Start Cloudflare Tunnel

In a **separate terminal window**, start the Cloudflare tunnel:

```bash
cloudflared tunnel --url http://localhost:8000
```

You'll see output with your public URL:
```
2026-01-31T12:00:00Z INF | https://your-tunnel-url.trycloudflare.com
```

Copy this URL and use it in your API calls.

## Usage

### Making Calls from Code

#### Python Example

```python
import requests

# Using the Cloudflare Tunnel URL
response = requests.post("https://your-tunnel-url.trycloudflare.com/make-call", json={
    "phone_number": "+19054628586",
    "dynamic_variables": {}
})

print(response.json())
# Output: {"success": true, "call_sid": "CAxxxx..."}
```

#### With Dynamic Variables

Pass custom data to your ElevenLabs agent:

```python
import requests

# Using Cloudflare Tunnel URL
response = requests.post("https://your-tunnel-url.trycloudflare.com/make-call", json={
    "phone_number": "+19054628586",
    "dynamic_variables": {
        "patient_name": "Parth Joshi",
        "patient_age": "19",
        "specialist_type": "Cardiologist",
        "cancelled_appointment_time": "Jan 20, 2026",
        "selected_time": ""
    }
})

print(response.json())
```

#### cURL Example

```bash
curl -X POST "https://your-tunnel-url.trycloudflare.com/make-call" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+19054628586",
    "dynamic_variables": {
      "patient_name": "Parth Joshi",
      "patient_age": "19",
      "specialist_type": "Cardiologist",
      "cancelled_appointment_time": "Jan 20, 2026",
      "selected_time": ""
    }
  }'
```

## API Endpoints

### `GET /`
Health check endpoint.

**Response:**
```json
{
  "status": "ready",
  "agent": "your_agent_id"
}
```

### `POST /make-call`
Initiate an outbound call.

**Request Body:**
```json
{
  "phone_number": "+1234567890",
  "dynamic_variables": {
    "key": "value"
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

### `POST /incoming-call`
Webhook for handling incoming Twilio calls (configured in Twilio console).

### `WebSocket /media-stream`
WebSocket endpoint for real-time audio streaming between Twilio and ElevenLabs.

## How It Works

1. **Call Initiation**: POST to `/make-call` creates a Twilio call
2. **Twilio Connection**: Twilio connects to your webhook and establishes a media stream
3. **ElevenLabs Bridge**: Server opens WebSocket to ElevenLabs agent
4. **Bidirectional Audio**: Audio flows in real-time between caller and AI agent
5. **Context Tracking**: Conversation data (like selected appointment times) is stored
6. **Auto Hangup**: Call ends automatically after agent completes conversation

## Call Context Storage

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

## Troubleshooting

### Connection Issues

- Verify your webhook URL is publicly accessible
- Check that Cloudflare Tunnel is running (`cloudflared tunnel --url http://localhost:8000`)
- Ensure firewall allows WebSocket connections
- Confirm the WEBHOOK_BASE_URL environment variable is set correctly

### Audio Issues

- Confirm ElevenLabs agent is active and configured
- Check Twilio phone number has voice capabilities
- Verify API keys are correct

### Call Not Connecting

- Check Twilio account has sufficient credits
- Verify phone number format includes country code (+1...)
- Review Twilio debugger logs in console

## Production Considerations

- Replace in-memory `CALL_CONTEXT` with Redis or database
- Add authentication to API endpoints
- Implement proper error handling and logging
- Use environment variables for all secrets
- Set up HTTPS with valid SSL certificate
- Monitor WebSocket connection limits