# Jetayu — Luxury Private Jet Concierge

A lead-generation concierge application that feels like calling a luxury jet service. Natural conversation, quiet data capture.

![Jetayu](https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1200&h=400&fit=crop)

## Overview

Jetayu is NOT a booking engine. It's a conversational lead capture system designed to feel like talking to a human concierge on the phone.

**Key Features:**
- Natural, human-like conversation powered by LLM
- Silent entity extraction (name, email, route, dates, passengers)
- Premium, mobile-first chat interface
- Three-layer backend architecture
- Aircraft suggestions with pricing (backend-driven)
- Booking confirmation flow with email notifications to operators
- Lead status tracking (draft → confirmed → contacted)

## Tech Stack

**Backend:**
- Python 3.11+
- FastAPI
- Supabase (PostgreSQL)
- OpenAI GPT-4o-mini

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Framer Motion

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- OpenAI API key

### 1. Database Setup

1. Create a new Supabase project
2. Run the schema in `database/schema.sql` via the SQL Editor
3. Copy your project URL and anon key

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy env.template .env
# Edit .env with your credentials
```

Configure `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key

# Optional: Email notifications for booking confirmations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=concierge@jetayu.com
OPERATOR_EMAILS=operator1@yourcompany.com,operator2@yourcompany.com
```

> **Email Setup:** If email is not configured, booking notifications are logged to console instead.

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

## Project Structure

```
Jetayu-V1/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings
│   │   ├── database.py          # Supabase client + mock
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   ├── services/
│   │   │   ├── concierge.py     # Conversation layer
│   │   │   ├── extractor.py     # Entity extraction
│   │   │   ├── lead_manager.py  # State management
│   │   │   ├── aircraft.py      # Aircraft database & pricing
│   │   │   ├── intent_detector.py # Intent detection (aircraft/booking)
│   │   │   └── email_service.py # Operator notifications
│   │   ├── prompts/
│   │   │   ├── conversation.txt
│   │   │   └── extraction.txt
│   │   └── routes/
│   │       └── chat.py          # API endpoints
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── ChatMessage.jsx
│   │   │   ├── ChatInput.jsx
│   │   │   ├── TypingIndicator.jsx
│   │   │   ├── JetCard.jsx
│   │   │   ├── JetSuggestions.jsx
│   │   │   └── BookingConfirmed.jsx
│   │   └── index.css
│   └── package.json
│
├── database/
│   └── schema.sql
│
└── README.md
```

## API Endpoints

### `POST /start`
Creates a new conversation session.

**Response:**
```json
{
  "session_id": "uuid",
  "assistant_message": "Good evening, how may I assist you today?"
}
```

### `POST /chat`
Sends a message and receives concierge response.

**Request:**
```json
{
  "session_id": "uuid",
  "message": "I need to fly from London to Nice next week"
}
```

**Response:**
```json
{
  "assistant_message": "London to Nice sounds lovely...",
  "lead_state": {
    "route_from": "London",
    "route_to": "Nice",
    "date_time": "next week"
  },
  "missing_fields": ["pax", "name", "email"]
}
```

## Architecture

### Three-Layer Backend

1. **Concierge Conversation Layer**
   - Generates natural, human-like responses
   - Uses conversation prompt for tone/personality
   - Guided by missing fields to progress conversation

2. **Entity Extraction Layer**
   - Runs on every user message
   - Extracts only explicitly stated information
   - Never guesses or infers
   - Returns strict JSON

3. **Lead State Manager**
   - Persists lead data to Supabase
   - Applies updates safely (preserves existing values)
   - Tracks missing fields

### Data Model

**Captured Fields:**
- `name` — Client's name
- `email` — Contact email
- `date_time` — Travel date/time (any format)
- `route_from` — Departure location
- `route_to` — Destination
- `pax` — Number of passengers
- `special_requests` — Array of special needs (append-only)
- `selected_aircraft` — Aircraft name if selected
- `status` — Lead status: `draft` | `confirmed` | `contacted`

### Lead Status Flow

```
[Session Start]
      │
      ▼
   "draft"  ─────── Conversation in progress
      │              (data being captured)
      │
      │  User says "go ahead", "book it", etc.
      ▼
 "confirmed" ─────── Email sent to operators
      │
      │  Manual update by ops team
      ▼
 "contacted" ─────── Follow-up completed
```

### Aircraft Suggestions

Aircraft cards appear when:
1. **Passenger count is captured** — Suggestions shown automatically
2. **User asks explicitly** — "Show me jets", "bigger options", etc.

Aircraft data (with pricing) is managed entirely in the backend.

## Customization

### Conversation Tone
Edit `backend/app/prompts/conversation.txt` to adjust the concierge personality.

### Extraction Rules
Edit `backend/app/prompts/extraction.txt` to modify entity extraction behavior.

### UI Theme
Modify `frontend/tailwind.config.js` colors and `frontend/src/index.css` for styling.

## Development Notes

- **Mock Mode:** Frontend works standalone with fallback responses; backend falls back to in-memory mock database if Supabase not configured
- **Aircraft Flow:** Jet suggestions appear after pax is captured OR when user asks about aircraft
- **Booking Flow:** When user says "go ahead", "book it", etc., lead status changes to "confirmed" and operators are notified
- **Email:** If SMTP not configured, booking notifications are logged to console
- Session data persists in Supabase across page refreshes (if same session_id used)

## License

MIT

