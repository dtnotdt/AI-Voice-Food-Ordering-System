<div align="center">

# 🎙️ AI Voice Food Ordering System

### _Speak. Match. Order. — in any language._

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-Whisper+GPT-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![FAISS](https://img.shields.io/badge/FAISS-Semantic_Search-blue?style=for-the-badge)](https://github.com/facebookresearch/faiss)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> A production-grade, multilingual AI voice ordering system that converts natural speech into accurate restaurant menu orders through a **3-tier intelligent matching pipeline** — exact alias detection, fuzzy string matching, and semantic vector search via FAISS.

<br/>

[Getting Started](#-getting-started) · [Architecture](#-system-architecture) · [Features](#-features) · [Tech Stack](#-tech-stack) · [API Reference](#-api-reference)

</div>

---

## 🧩 Problem Statement

Traditional restaurant ordering interfaces force customers through rigid, text-based menus. Language barriers, regional dialects, and heavy accents create friction. This system eliminates that friction entirely — customers **speak naturally** in their preferred language, and the AI does the rest.

---

## ✨ Features

### 🔊 Voice Ordering Pipeline
- **Real-time speech-to-text** via OpenAI Whisper (local model) with language-specific context prompting
- **7-language support**: English, Hindi, Gujarati, Marathi, Tamil, Malayalam, Arabic — including native scripts and romanized input
- **Full-duplex WebSocket voice calling** with VAD (Voice Activity Detection), Piper TTS response streaming, and session management
- **Multilingual phrase cleaning** — strips 200+ filler words across all supported languages to isolate food item names

### 🧠 3-Tier Smart Matching Engine
| Tier | Method | Trigger | Confidence |
|------|--------|---------|------------|
| **1st** | Exact Alias Lookup | O(1) hash map — phrase matches a known alias | `1.00` |
| **2nd** | Fuzzy String Matching | SequenceMatcher ratio ≥ 0.70 | `fuzzy ratio` |
| **3rd** | FAISS Semantic Search | Vector distance < 1.2 via `all-MiniLM-L6-v2` embeddings | `semantic score` |

- **Ambiguity detection** — when top-2 scores differ by < 0.10, the system asks a clarifying question _in the user's language_
- **Alias generation** — auto-generates Hindi, Gujarati, Marathi, Tamil, Malayalam, and Arabic aliases for every menu item

### 🛒 Complete Ordering Experience
- **Smart Menu** with real-time search, category filters, veg/non-veg toggle, and menu item ratings
- **Voice-driven cart management** — add, remove, modify quantity, and checkout via speech
- **Quantity parsing** across English, Hindi, and Gujarati (spoken words, digits, and Whisper transcription error correction)
- **Special instructions extraction** — "extra spicy", "no mayo", "make it jain" are captured separately from item names
- **AI-powered upselling** using Apriori association rules mined from transaction history + hardcoded domain pairings

### 📊 Admin Intelligence Dashboard
- **BCG Matrix menu categorization** — Stars ⭐, Plowhorses 🐎, Puzzles 🧩, Dogs 🐶 based on margin × popularity
- **Revenue analytics** — contribution margin, item-level profitability, sales velocity ranking
- **Automated combo recommendations** via market basket analysis
- **Price optimization engine** with elasticity-based suggestions
- **Inventory alerts** with impact assessment on popular menu items
- **Smart upsell priority ranking** — `(Margin × 0.6) + (Popularity × 0.4)`

### 🔐 Authentication & Security
- **OTP-based authentication** via SMS (Twilio) or Email (SMTP) with rate limiting and attempt tracking
- **Development fallback mode** — returns OTP in response when no provider is configured
- **Session and user tracking** with full audit trail in SQLite/PostgreSQL

### 📍 Delivery & Checkout
- **Geocoding** for spoken delivery addresses
- **Delivery radius validation** with configurable restaurant location
- **POS sync** — generates Kitchen Order Tickets (KOT) compatible with PetPooja POS systems
- **Order persistence** with customer history tracking

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                    │
│  Landing → Auth → Menu → Voice Ordering → Cart → Payment → Track│
│  GlobalVoiceBot (floating mic — always available)               │
└──────────────┬──────────────────────────┬───────────────────────┘
               │ REST API                 │ WebSocket
               ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│   Node.js Express API    │   │  FastAPI Python Cognitive Engine  │
│   (Port 3001)            │   │  (Port 8000 + WS on 8002)        │
│                          │   │                                    │
│  • Menu CSV → JSON API   │   │  ┌──────────────────────────────┐ │
│  • Cart / Order mgmt     │   │  │  Whisper ASR (local model)   │ │
│  • Dashboard analytics   │   │  │  ↓                           │ │
│  • Multilingual TTS reply│   │  │  Phrase Cleaner (7 langs)    │ │
│  • Menu Q&A engine       │◄──┤  │  ↓                           │ │
│  • Voice flow proxy      │   │  │  LLM Intent Parser (GPT-4o)  │ │
│  • Ratings management    │   │  │  ↓                           │ │
│  • POS ticket generation │   │  │  SmartMatcher (3-tier)       │ │
│                          │   │  │  ↓                           │ │
│                          │   │  │  Upsell Engine (Apriori)     │ │
│                          │   │  └──────────────────────────────┘ │
│                          │   │                                    │
│                          │   │  • OTP Auth (Twilio/SMTP)         │
│                          │   │  • Address Geocoding              │
│                          │   │  • SQLAlchemy ORM + Audit Logs    │
│                          │   │  • Piper TTS (7 voice models)     │
└──────────────────────────┘   └──────────────────────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │  SQLite / Postgres│
                                 │  (Users, Orders,  │
                                 │   Sessions, Logs) │
                                 └─────────────────┘
```

---

## 🔄 Voice Ordering Flow

```
 User speaks into mic
        │
        ▼
 ┌─────────────────────────────────────────────┐
 │  1. WebSocket Audio Stream → VAD Detection  │
 │     (RMS > 0.008, min 0.5s utterance)       │
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  2. Whisper ASR (language-hinted)           │
 │     + context prompts for menu vocabulary   │
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  3. Phrase Cleaner                          │
 │     Strips 200+ filler words (7 languages)  │
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  4. LLM Intent Parser (GPT-4o / fallback)  │
 │     → add_to_cart / remove / checkout / ... │
 │     Extracts: item, qty, special_instructions│
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  5. SmartMatcher (3-Tier Resolution)        │
 │     Exact Alias → Fuzzy → FAISS Semantic    │
 │     + Ambiguity Detection & Clarification   │
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  6. Upsell Engine                           │
 │     Association rules + domain pairings     │
 └─────────────────────┬───────────────────────┘
                       │
                       ▼
 ┌─────────────────────────────────────────────┐
 │  7. Piper TTS → Audio response streamed     │
 │     back to client via WebSocket            │
 │     (Transliteration for non-Latin scripts) │
 └─────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
AI-Voice-Food-Ordering-System/
│
├── petpoojabot/                        # Core application
│   ├── src/                            # React Frontend
│   │   ├── components/
│   │   │   ├── GlobalVoiceBot.jsx      # Floating voice assistant (always-on mic)
│   │   │   ├── VoiceCallInterface.jsx  # Full-duplex WebSocket voice calling UI
│   │   │   └── AuthGate.jsx            # OTP-based authentication gate
│   │   ├── pages/
│   │   │   ├── Landing.jsx             # Landing page with feature showcase
│   │   │   ├── VoiceOrdering.jsx       # Dedicated voice ordering interface
│   │   │   ├── SmartMenu.jsx           # Interactive menu with search & filters
│   │   │   ├── Cart.jsx                # Shopping cart with voice controls
│   │   │   ├── Address.jsx             # Delivery address (voice + manual)
│   │   │   ├── Payment.jsx             # Payment processing
│   │   │   ├── OrderTracking.jsx       # Real-time order tracking
│   │   │   ├── AdminDashboard.jsx      # Revenue intelligence dashboard
│   │   │   └── AdminAuth.jsx           # Admin authentication
│   │   ├── store.js                    # Zustand state management
│   │   └── App.jsx                     # Router configuration
│   │
│   ├── backend/                        # Node.js API Server
│   │   ├── server.js                   # Express API — menu, orders, analytics, voice proxy
│   │   └── data/
│   │       └── menu.csv                # Restaurant menu dataset
│   │
│   ├── python_backend/                 # Python AI Engine
│   │   ├── main.py                     # FastAPI app — NLP pipeline, auth, POS sync
│   │   ├── realtime_voice_bot.py       # WebSocket voice calling agent (7-lang TTS)
│   │   ├── smart_matcher.py            # 3-tier matching engine (alias + fuzzy + FAISS)
│   │   ├── faiss_matcher.py            # Semantic search with sentence-transformers
│   │   ├── alias_generator.py          # Auto-generates multilingual aliases per item
│   │   ├── phrase_cleaner.py           # Filler word removal (7 languages)
│   │   ├── quantity_parser.py          # Multilingual quantity extraction
│   │   ├── llm_parser.py              # GPT-4o structured intent parsing + fallback
│   │   ├── upsell_engine.py           # Apriori association rules + domain pairings
│   │   ├── translator.py             # Google Translate integration
│   │   ├── asr_module.py             # Whisper ASR wrapper
│   │   ├── voice_flow.py             # Conversational flow state machine
│   │   ├── otp_service.py            # OTP via Twilio SMS or SMTP email
│   │   ├── address_geocoder.py       # Geocoding for spoken addresses
│   │   ├── delivery_validator.py     # Delivery radius validation
│   │   ├── database.py               # SQLAlchemy models (12 tables)
│   │   └── requirements.txt          # Python dependencies
│   │
│   ├── package.json                   # Node.js dependencies
│   └── vite.config.js                 # Vite build configuration
│
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### AI / ML Layer
| Component | Technology |
|-----------|-----------|
| Speech-to-Text | OpenAI Whisper (local `small` model) |
| Intent Parsing | GPT-4o / GPT-4o-mini (structured output) |
| Semantic Search | FAISS + `all-MiniLM-L6-v2` embeddings |
| Fuzzy Matching | `difflib.SequenceMatcher` |
| Upsell Engine | Apriori (mlxtend) association rule mining |
| Text-to-Speech | Piper TTS (7 language voice models) |
| Translation | Google Cloud Translate API |

### Backend
| Component | Technology |
|-----------|-----------|
| AI Engine | FastAPI (Python 3.9+) |
| API Server | Express.js (Node.js) |
| Database | SQLAlchemy ORM → SQLite / PostgreSQL |
| Auth | OTP via Twilio (SMS) + SMTP (Email) |
| WebSocket | FastAPI WebSocket (full-duplex voice) |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 |
| Build Tool | Vite |
| Styling | Tailwind CSS 4 |
| State Management | Zustand |
| Maps | React-Leaflet |
| Charts | Recharts |
| Icons | Lucide React |
| QR Codes | qrcode.react |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **OpenAI API Key** (for Whisper ASR & GPT intent parsing)

### 1. Clone the repository

```bash
git clone https://github.com/dtnotdt/AI-Voice-Food-Ordering-System.git
cd AI-Voice-Food-Ordering-System
```

### 2. Set up the Python AI engine

```bash
cd petpoojabot/python_backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Create `petpoojabot/python_backend/.env`:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional — OTP Authentication
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

Create `petpoojabot/backend/.env`:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 4. Install frontend dependencies

```bash
cd petpoojabot
npm install
```

### 5. Run the application

```bash
# Terminal 1 — Python AI Engine
cd petpoojabot/python_backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend + Node API (concurrent)
cd petpoojabot
npm run dev
```

Or run all services together:

```bash
cd petpoojabot
npm run dev    # Starts both Vite (frontend) + Node.js server concurrently
```

The app will be available at `http://localhost:5173` with the Node API at `http://localhost:3001` and the Python engine at `http://localhost:8000`.

---

## 🧪 Example Flows

### English Voice Order
```
👤 "I'd like two paneer pizzas and a cold coffee, extra sugar"
🎙️ Whisper → "i'd like two paneer pizzas and a cold coffee extra sugar"
🧹 Cleaner → "paneer pizzas cold coffee"
🧠 LLM    → intent: add_to_cart
             items: [{name: "Paneer Pizza", qty: 2}, {name: "Cold Coffee", qty: 1, instructions: "extra sugar"}]
🎯 Match  → Paneer Pizza: exact alias ✅ (1.00) | Cold Coffee: fuzzy ✅ (0.91)
```

### Hindi Voice Order (Code-Mixed)
```
👤 "ek veg burger aur do coke daal do, spicy banana"
🎙️ Whisper → "ek veg burger aur do coke daal do spicy banana"
🧹 Cleaner → "veg burger coke"
🧠 LLM    → intent: add_to_cart
             items: [{name: "Veg Burger", qty: 1, instructions: "spicy"}, {name: "Coke", qty: 2}]
🎯 Match  → Veg Burger: exact alias ✅ (1.00) | Coke: semantic ✅ (0.87)
```

### Ambiguity Handling
```
👤 "peri fries add karo"
🎯 SmartMatcher detects: Peri Peri Fries (0.82) vs Fries (0.78) — margin < 0.10
⚠️ Bot asks: "क्या आपको Peri Peri Fries चाहिए या Fries?"
```

---

## 📡 API Reference

### Python Engine (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/health/db` | GET | Database connectivity check |
| `/health/openai` | GET | OpenAI API key validation |
| `/nlp/pipeline` | POST | Full voice pipeline (audio → intent → reply) |
| `/nlp/transcribe` | POST | Text-only NLP pipeline (testing) |
| `/nlp/match` | POST | Direct FAISS semantic search |
| `/analytics/upsell` | POST | Get upsell recommendation for cart |
| `/pos/sync` | POST | Generate KOT and save order |
| `/voice/confirm` | POST | Voice flow — cart confirmation + upsell |
| `/voice/address` | POST | Voice flow — geocode spoken address |
| `/voice/final-confirm` | POST | Voice flow — final order placement |
| `/api/auth/request-otp` | POST | Request OTP via SMS or email |
| `/api/auth/verify-otp` | POST | Verify OTP and authenticate user |
| `/ws/voice-call` | WebSocket | Real-time full-duplex voice calling |

### Node.js API (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/menu` | GET | Full menu with BCG categories & ratings |
| `/api/order` | POST | Place order |
| `/api/dashboard` | GET | Admin dashboard stats |
| `/api/admin/analytics` | GET | Revenue intelligence & profitability |
| `/api/admin/ratings/:id` | PUT | Admin set item rating |
| `/api/ai/intent` | POST | Voice intent processing (proxied to Python) |
| `/api/ai/upsell` | POST | Smart upsell suggestion |
| `/api/ai/menu-query` | POST | Natural language menu Q&A |

---

## 🗃️ Database Schema

12 tables managed via SQLAlchemy ORM:

| Table | Purpose |
|-------|---------|
| `menu_items` | Menu catalog with pricing, cost, popularity, and BCG category |
| `customers` | Customer profiles keyed by phone number |
| `orders` | Order records with status tracking |
| `order_items` | Line items for each order |
| `users` | AI assistant users with verification status |
| `otp_records` | OTP tracking with cooldowns and attempt limits |
| `sessions` | User session tracking per conversation |
| `messages` | Full conversation transcript (user + AI) |
| `voice_metadata` | Audio file tracking and STT/TTS status |
| `ai_logs` | Model performance, latency, and intent logging |
| `error_logs` | System error tracking per session |
| `language_preferences` | Per-user language and voice settings |

---

## 🌍 Supported Languages

| Language | Script | Romanized | Whisper | Piper TTS |
|----------|--------|-----------|---------|-----------|
| English | ✅ | ✅ | `en` | `en_US-lessac-medium` |
| Hindi | ✅ देवनागरी | ✅ | `hi` | `hi_IN-sarika-medium` |
| Gujarati | ✅ ગુજરાતી | ✅ | `gu` | `hi_IN-sarika-medium`* |
| Marathi | ✅ मराठी | ✅ | `mr` | `hi_IN-sarika-medium`* |
| Tamil | ✅ தமிழ் | ✅ | `ta` | `ml_IN-maya-medium`* |
| Malayalam | ✅ മലയാളം | ✅ | `ml` | `ml_IN-maya-medium` |
| Arabic | ✅ العربية | ✅ | `ar` | `ar_JO-kareem-medium` |

_*Transliterated to a compatible script for Piper TTS output._

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

---


---

<div align="center">

<sub>AI Voice Food Ordering System — Where every language gets heard.</sub>

</div>
