# Israel/Iran Attack Tracker

A real-time web application that displays recent attacks between Israel and Iran on an interactive map with tabular data display.

## Features

- **Interactive Map**: Leaflet.js-powered map with attack location markers
- **Recency-Based Visualization**: Recent attacks show larger, more prominent markers
- **Real-Time Data**: Pulls attack data from news APIs (NewsAPI, Guardian)
- **Side Table**: Detailed attack information with clickable rows
- **Auto-Updates**: Scheduled data refresh every 15 minutes
- **Fallback Mode**: Works offline with sample data if APIs are unavailable

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys (Optional)
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Add your API keys:
- **NewsAPI**: Get free key at https://newsapi.org/register
- **Guardian API**: Get free key at https://open-platform.theguardian.com/access/

### 3. Start the Application

**Start Backend Server:**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

**Serve Frontend:**
```bash
npm run client
```

### 4. Access the Application
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000

## API Endpoints

- `GET /api/attacks` - Get current attack data
- `POST /api/attacks/refresh` - Force refresh attack data
- `GET /api/status` - Server status and statistics

## Data Sources

The application fetches data from:
1. **NewsAPI** - Global news articles about Israel/Iran attacks
2. **Guardian API** - The Guardian's coverage of Middle East conflicts
3. **Fallback Data** - Sample data when APIs are unavailable

## Attack Classification

Attacks are classified by recency:
- **Recent** (0-7 days): Large red markers with pulsing animation
- **Moderate** (7-30 days): Medium orange markers
- **Old** (30+ days): Small gray markers

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript ES6+, Leaflet.js
- **Backend**: Node.js, Express.js
- **APIs**: NewsAPI, Guardian API
- **Deployment**: Can be deployed to any Node.js hosting platform

## Development

- Data updates automatically every 15 minutes
- Manual refresh available via "Update Data" button
- Error handling with fallback to offline mode
- Responsive design for mobile and desktop

## License

MIT License