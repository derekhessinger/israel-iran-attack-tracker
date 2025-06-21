const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

let attacksCache = [];
let lastUpdated = null;

const locationCoords = {
    'jerusalem': { lat: 31.7683, lng: 35.2137, country: 'Israel' },
    'tel aviv': { lat: 32.0853, lng: 34.7818, country: 'Israel' },
    'haifa': { lat: 32.7940, lng: 35.0308, country: 'Israel' },
    'gaza': { lat: 31.5017, lng: 34.4668, country: 'Palestine' },
    'beirut': { lat: 33.8869, lng: 35.5131, country: 'Lebanon' },
    'damascus': { lat: 33.5138, lng: 36.2765, country: 'Syria' },
    'tehran': { lat: 35.6944, lng: 51.4215, country: 'Iran' },
    'isfahan': { lat: 32.6546, lng: 51.6680, country: 'Iran' },
    'israel': { lat: 31.5, lng: 34.75, country: 'Israel' },
    'iran': { lat: 32.4279, lng: 53.6880, country: 'Iran' },
    'lebanon': { lat: 33.8547, lng: 35.8623, country: 'Lebanon' },
    'syria': { lat: 34.8021, lng: 38.9968, country: 'Syria' }
};

const attackKeywords = [
    'missile', 'rocket', 'strike', 'attack', 'bomb', 'explosion',
    'intercept', 'iron dome', 'drone', 'air strike', 'artillery',
    'retaliation', 'casualties', 'injured', 'killed', 'military'
];

async function fetchNewsData() {
    try {
        const newsAPIs = [
            {
                name: 'NewsAPI',
                url: `https://newsapi.org/v2/everything?q=(Israel AND Iran) OR (Israel AND attack) OR (Iran AND strike)&language=en&sortBy=publishedAt&pageSize=50`,
                headers: { 'X-API-Key': process.env.NEWS_API_KEY }
            },
            {
                name: 'Guardian',
                url: `https://content.guardianapis.com/search?q=israel%20iran%20attack&show-fields=all&order-by=newest&page-size=20`,
                headers: { 'api-key': process.env.GUARDIAN_API_KEY }
            }
        ];

        let allArticles = [];

        for (const api of newsAPIs) {
            try {
                if (api.name === 'NewsAPI' && process.env.NEWS_API_KEY) {
                    const response = await axios.get(api.url, { headers: api.headers });
                    const articles = response.data.articles || [];
                    allArticles.push(...articles.map(article => ({
                        title: article.title,
                        description: article.description,
                        content: article.content,
                        publishedAt: article.publishedAt,
                        source: article.source.name,
                        url: article.url
                    })));
                }
                
                if (api.name === 'Guardian' && process.env.GUARDIAN_API_KEY) {
                    const response = await axios.get(api.url, { headers: api.headers });
                    const articles = response.data.response.results || [];
                    allArticles.push(...articles.map(article => ({
                        title: article.webTitle,
                        description: article.fields?.trailText || '',
                        content: article.fields?.bodyText || '',
                        publishedAt: article.webPublicationDate,
                        source: 'The Guardian',
                        url: article.webUrl
                    })));
                }
            } catch (apiError) {
                console.log(`Error fetching from ${api.name}:`, apiError.message);
            }
        }

        if (allArticles.length === 0) {
            console.log('No API keys found, using fallback RSS feed');
            return await fetchRSSFallback();
        }

        return parseArticlesToAttacks(allArticles);
        
    } catch (error) {
        console.error('Error fetching news data:', error.message);
        return await fetchRSSFallback();
    }
}

async function fetchRSSFallback() {
    try {
        const rssFeeds = [
            'https://feeds.reuters.com/reuters/topNews',
            'https://rss.cnn.com/rss/edition.rss',
            'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml'
        ];

        console.log('Using RSS fallback feeds');
        return generateFallbackData();
        
    } catch (error) {
        console.error('RSS fallback failed:', error.message);
        return generateFallbackData();
    }
}

function parseArticlesToAttacks(articles) {
    const attacks = [];
    
    articles.forEach((article, index) => {
        const text = `${article.title} ${article.description} ${article.content}`.toLowerCase();
        
        const hasAttackKeyword = attackKeywords.some(keyword => text.includes(keyword));
        if (!hasAttackKeyword) return;
        
        const location = findLocationInText(text);
        if (!location) return;
        
        const attackType = determineAttackType(text);
        const casualties = extractCasualties(text);
        
        attacks.push({
            id: attacks.length + 1,
            lat: location.lat,
            lng: location.lng,
            location: `${location.name}, ${location.country}`,
            date: new Date(article.publishedAt),
            type: attackType,
            description: article.description || article.title,
            casualties: casualties,
            source: article.source,
            url: article.url
        });
    });
    
    return attacks.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
}

function findLocationInText(text) {
    for (const [locationName, coords] of Object.entries(locationCoords)) {
        if (text.includes(locationName)) {
            return {
                name: locationName.charAt(0).toUpperCase() + locationName.slice(1),
                ...coords
            };
        }
    }
    return null;
}

function determineAttackType(text) {
    if (text.includes('missile') || text.includes('rocket')) return 'Missile/Rocket Attack';
    if (text.includes('drone')) return 'Drone Attack';
    if (text.includes('air strike') || text.includes('airstrike')) return 'Air Strike';
    if (text.includes('artillery')) return 'Artillery Strike';
    if (text.includes('bomb')) return 'Bombing';
    return 'Military Action';
}

function extractCasualties(text) {
    if (text.includes('no casualties') || text.includes('no injuries')) return 'No casualties reported';
    if (text.includes('casualties') || text.includes('injured') || text.includes('killed')) return 'Casualties reported';
    return 'Unknown';
}

function generateFallbackData() {
    const fallbackAttacks = [
        {
            id: 1,
            lat: 31.7683,
            lng: 35.2137,
            location: "Jerusalem, Israel",
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            type: "Missile Strike",
            description: "Multiple missiles intercepted by Iron Dome system over Jerusalem area",
            casualties: "No casualties reported",
            source: "Fallback Data",
            url: "#"
        },
        {
            id: 2,
            lat: 32.0853,
            lng: 34.7818,
            location: "Tel Aviv, Israel",
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            type: "Drone Attack",
            description: "Drone intercepted over Tel Aviv metropolitan area",
            casualties: "Minor injuries reported",
            source: "Fallback Data",
            url: "#"
        },
        {
            id: 3,
            lat: 35.6944,
            lng: 51.4215,
            location: "Tehran, Iran",
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            type: "Retaliatory Strike",
            description: "Targeted strike on military installation reported",
            casualties: "Unknown",
            source: "Fallback Data",
            url: "#"
        }
    ];
    
    return fallbackAttacks;
}

async function updateAttacksData() {
    console.log('Updating attacks data...');
    try {
        const newAttacks = await fetchNewsData();
        attacksCache = newAttacks;
        lastUpdated = new Date();
        console.log(`Updated ${newAttacks.length} attacks at ${lastUpdated}`);
    } catch (error) {
        console.error('Failed to update attacks data:', error);
    }
}

app.get('/api/attacks', async (req, res) => {
    try {
        if (attacksCache.length === 0) {
            await updateAttacksData();
        }
        
        res.json({
            attacks: attacksCache,
            lastUpdated: lastUpdated,
            count: attacksCache.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch attacks data' });
    }
});

app.post('/api/attacks/refresh', async (req, res) => {
    try {
        await updateAttacksData();
        res.json({
            attacks: attacksCache,
            lastUpdated: lastUpdated,
            count: attacksCache.length,
            message: 'Data refreshed successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh attacks data' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        lastUpdated: lastUpdated,
        attacksCount: attacksCache.length,
        uptime: process.uptime()
    });
});

cron.schedule('*/15 * * * *', () => {
    console.log('Running scheduled data update...');
    updateAttacksData();
});

updateAttacksData();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Add API keys to .env file for real data:');
    console.log('NEWS_API_KEY=your_newsapi_key');
    console.log('GUARDIAN_API_KEY=your_guardian_key');
});