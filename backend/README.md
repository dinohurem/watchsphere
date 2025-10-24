# WatchSphere Backend

FastAPI backend for the WatchSphere watch trading platform.

## Features

- **FastAPI Framework**: Modern, fast, async Python web framework
- **AI Integration**: Ready for OpenAI and Anthropic integration
- **WebSocket Support**: For real-time chat and market updates
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT-based authentication
- **API Documentation**: Auto-generated with Swagger UI

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/    # API endpoints
│   │       └── router.py     # Main API router
│   ├── core/
│   │   └── config.py         # Configuration and settings
│   ├── models/               # Database models
│   ├── services/             # Business logic
│   └── db/                   # Database utilities
├── tests/                    # Test files
├── requirements.txt          # Python dependencies
└── .env.example             # Environment variables template
```

## Setup

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration
   ```

4. **Run the development server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Access the API**:
   - API: http://localhost:8000
   - Swagger Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Key Endpoints to Implement

- `/api/v1/auth` - Authentication and user management
- `/api/v1/market` - Market data, listings, orders
- `/api/v1/inventory` - User inventory management
- `/api/v1/orders` - Buy/sell order management
- `/api/v1/chat` - Messaging system
- `/api/v1/ai` - AI assistant endpoints
- `/api/v1/checks` - Serial number verification
- `/api/v1/news` - Market news feed

## AI Integration

The backend is set up to integrate with:
- **OpenAI GPT**: For the AI assistant feature
- **Anthropic Claude**: Alternative AI provider
- **Custom ML Models**: Can be added to the services layer

## Development

- Use `black` for code formatting
- Use `ruff` for linting
- Write tests in the `tests/` directory
- Run tests with `pytest`

## Database

The app uses PostgreSQL. To set up:
```bash
# Install PostgreSQL
# Create database
createdb watchsphere

# Run migrations (after setting up Alembic)
alembic upgrade head
```
