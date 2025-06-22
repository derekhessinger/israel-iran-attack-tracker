# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start Development Environment:**
```bash
npm run dev    # Backend with auto-reload (nodemon on port 3000)
npm run client # Frontend server (Python HTTP server on port 8080)
```

**Production:**
```bash
npm start      # Production backend server
```

**Setup:**
```bash
npm install           # Install dependencies
cp .env.example .env  # Configure API keys (optional)
```

## Architecture Overview

This is a **dual-server real-time web application** that tracks Israel/Iran military attacks:

- **Backend** (server.js): Express.js API server on port 3000
- **Frontend** (index.html): Static files served on port 8080 via Python HTTP server
- **Data Flow**: Backend fetches from NewsAPI/Guardian API → processes/filters → serves to frontend via REST API

### Key Architecture Points

1. **No Database**: Uses in-memory caching with scheduled refresh every 15 minutes
2. **Fallback Mode**: Application works offline with sample data when APIs unavailable  
3. **Real-time Updates**: Frontend polls backend every 30 seconds for new data
4. **Geographic Mapping**: News articles are parsed and mapped to coordinates for visualization

## File Structure

- `server.js` - Main backend entry point with Express routes and news API integration
- `index.html` - Main application interface with Leaflet.js map
- `script.js` - Frontend JavaScript handling map interactions and data display
- `styles.css` - Application styling with dark theme
- `test.html`, `button-test.html` - Manual testing utilities

## API Integration

**External APIs:**
- NewsAPI (optional): Real-time news aggregation
- Guardian API (optional): Additional news coverage
- Both APIs work with free tier limits

**Internal Endpoints:**
- `GET /api/attacks` - Current attack data
- `POST /api/attacks/refresh` - Force data refresh
- `GET /api/status` - Server health check

## Data Processing

The application uses intelligent news filtering that:
1. Searches for attack-related keywords in news articles
2. Filters by Israel/Iran relevance
3. Extracts location data for map visualization
4. Classifies attacks by recency (Recent/Moderate/Old)

## Development Notes

- Frontend and backend must run on separate ports (3000 and 8080)
- CORS is enabled for cross-origin requests
- No formal testing framework - uses manual test files
- Environment variables in `.env` are optional (app has fallback mode)
- Uses Leaflet.js for mapping with OpenStreetMap tiles