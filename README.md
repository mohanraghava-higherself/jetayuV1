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
3. Run `database/migration_v1.1.sql` (if not already included in schema.sql)
4. Run `database/migration_v1.2_auth.sql` to add authentication support
5. Copy your project URL, anon key, and JWT secret
6. Enable Google and Apple OAuth providers in Supabase Dashboard (Authentication > Providers) if needed

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
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
OPENAI_API_KEY=your-openai-api-key

# Optional: Email notifications for booking confirmations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=concierge@jetayu.com
OPERATOR_EMAILS=operator1@yourcompany.com,operator2@yourcompany.com
```

> **JWT Secret:** Find this in Supabase Dashboard > Project Settings > API > JWT Secret. Required for token verification in production.

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

# Create .env file
copy env.example .env
# Edit .env with your Supabase credentials

# Start dev server
npm run dev
```

Configure `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
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

## Authentication & User Profiles

### Authentication Flow

Jetayu supports **optional authentication** - users can chat anonymously, but authentication is required when confirming a booking.

**Key Features:**
- **Anonymous Chat:** Users can start conversations without logging in
- **Auth on Booking:** Authentication is prompted only when user wants to proceed with booking
- **Multiple Auth Methods:** Email/password, Google OAuth, Apple OAuth
- **User Profiles:** Minimal profile extension over Supabase auth.users
- **My Bookings:** Authenticated users can view their booking history

### Auth Flow

1. **Anonymous Conversation:**
   - User starts chat without authentication
   - All lead data is captured in `leads` table with `user_id = NULL`
   - Chat works exactly as before

2. **Booking Confirmation:**
   - When user says "go ahead", "book it", etc.
   - If not authenticated → `auth_required: true` in response
   - Frontend shows auth modal
   - After login → booking is confirmed and associated with user

3. **User Association:**
   - After authentication, `user_id` is set on the lead
   - Lead is linked to user's profile
   - User can view booking in "My Bookings"

### Database Schema

**Profiles Table:**
- `id` (UUID, FK → auth.users.id)
- `email` (text)
- `full_name` (text, nullable)
- `created_at`, `updated_at` (timestamps)

**Leads Table (Modified):**
- Added `user_id` (UUID, nullable, FK → profiles.id)
- Indexed for efficient user queries
- `user_id = NULL` for anonymous leads

### Row Level Security (RLS)

- **Profiles:** Users can read/write only their own profile
- **Leads:** 
  - Anonymous users: No read access (backend service role handles writes)
  - Authenticated users: Read only their own leads (`user_id = auth.uid()`)
  - Backend service role: Full access (for `/start` and `/chat` endpoints)

### API Endpoints

**`POST /chat`** (Updated):
- Optional `Authorization` header
- If booking requires auth and user not authenticated → returns `auth_required: true`
- If authenticated → associates lead with user on confirmation

**`GET /my-bookings`** (New):
- Requires authentication (`Authorization: Bearer <token>`)
- Returns user's leads sorted by `created_at DESC`
- Read-only view of booking history

### Frontend Auth Components

- **LandingPage:** Entry point with "Start Conversation" and "My Bookings" CTAs
- **AuthModal:** Email/password, Google, Apple OAuth
- **MyBookings:** Read-only list of user's bookings
- **App.jsx:** Handles routing and auth state management

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
- **Auth Flow:** Authentication is optional for chat, required only for booking confirmation
- **Email:** If SMTP not configured, booking notifications are logged to console
- **Session Persistence:** Session data persists in Supabase across page refreshes (if same session_id used)
- **OAuth Setup:** Configure Google and Apple OAuth in Supabase Dashboard > Authentication > Providers

## License

MIT

