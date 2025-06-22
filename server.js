const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
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


const excludeKeywords = [
    'analysis', 'opinion', 'could', 'might', 'may', 'potential',
    'possible', 'fears', 'threatens', 'warning', 'diplomatic',
    'negotiations', 'talks', 'summit', 'meeting', 'conference',
    'history', 'background', 'explained', 'timeline', 'years ago',
    'months ago', 'previously', 'earlier', 'past', 'former'
];

// Enhanced filtering keywords for better quality control
const summaryIndicators = [
    'how', 'why', 'what', 'guide', 'defending', 'defense', 'overview',
    'context', 'understanding', 'explainer', 'breakdown', 'comprehensive',
    'complete', 'everything you need to know', 'here\'s what', 'what we know'
];

const strengthenedExcludeKeywords = [
    ...excludeKeywords,
    ...summaryIndicators,
    'sources suggest', 'it is believed', 'claim', 'claims'
];

// Require stronger action indicators for valid attacks
const strongActionKeywords = [
    'launched', 'fired', 'struck', 'hit', 'intercepted', 'destroyed',
    'exploded', 'detonated', 'crashed', 'shot down', 'eliminated'
];

// Utility functions for deduplication and content analysis
function generateArticleHash(article) {
    const hashContent = `${article.title}${article.url}${article.publishedAt}`;
    return crypto.createHash('md5').update(hashContent).digest('hex');
}

function calculateStringSimilarity(str1, str2) {
    // Simple Levenshtein distance implementation
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + 1
                );
            }
        }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
}

function isLocationTimeProximity(attack1, attack2, hoursThreshold = 6) {
    // Check if attacks are in same location and within time threshold
    const location1 = attack1.location.toLowerCase();
    const location2 = attack2.location.toLowerCase();
    
    if (location1 !== location2) return false;
    
    const timeDiff = Math.abs(new Date(attack1.date) - new Date(attack2.date));
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    return hoursDiff <= hoursThreshold;
}

function calculateContentQualityScore(article) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    let score = 50; // Base score
    
    // Penalty for summary/analysis indicators
    for (const indicator of summaryIndicators) {
        if (text.includes(indicator)) {
            score -= 15;
        }
    }
    
    // Penalty for weak reporting language
    const weakLanguage = ['reportedly', 'allegedly', 'sources say', 'it is believed'];
    for (const phrase of weakLanguage) {
        if (text.includes(phrase)) {
            score -= 10;
        }
    }
    
    // Bonus for strong action words
    for (const action of strongActionKeywords) {
        if (text.includes(action)) {
            score += 10;
        }
    }
    
    // Bonus for specific details (numbers, times, locations)
    if (/\d{1,2}:\d{2}/.test(text)) score += 5; // Time stamps
    if (/\d+\s+(killed|injured|casualties)/.test(text)) score += 8; // Casualty numbers
    if (text.includes('breaking') || text.includes('urgent')) score += 5; // Breaking news
    
    return Math.max(0, Math.min(100, score));
}

function isDuplicateAttack(newAttack, existingAttacks) {
    for (const existing of existingAttacks) {
        // Check URL duplication
        if (newAttack.url && existing.originalUrls && existing.originalUrls.includes(newAttack.url)) {
            return { isDuplicate: true, existingAttack: existing, reason: 'URL match' };
        }
        
        // Check title similarity (80% threshold)
        const titleSimilarity = calculateStringSimilarity(
            newAttack.description.toLowerCase(),
            existing.description.toLowerCase()
        );
        if (titleSimilarity > 0.8) {
            return { isDuplicate: true, existingAttack: existing, reason: 'Title similarity' };
        }
        
        // Check location-time proximity
        if (isLocationTimeProximity(newAttack, existing)) {
            const descSimilarity = calculateStringSimilarity(
                newAttack.description.toLowerCase(),
                existing.description.toLowerCase()
            );
            if (descSimilarity > 0.6) {
                return { isDuplicate: true, existingAttack: existing, reason: 'Location-time proximity' };
            }
        }
    }
    
    return { isDuplicate: false };
}

function consolidateAttack(existingAttack, newAttack) {
    // Merge two attacks that represent the same incident
    const consolidated = { ...existingAttack };
    
    // Keep the better quality description
    if (newAttack.confidence > existingAttack.confidence) {
        consolidated.description = newAttack.description;
        consolidated.type = newAttack.type;
        consolidated.casualties = newAttack.casualties;
    }
    
    // Merge source information
    consolidated.sourceCount = (consolidated.sourceCount || 1) + 1;
    consolidated.originalUrls = consolidated.originalUrls || [consolidated.url];
    if (newAttack.url && !consolidated.originalUrls.includes(newAttack.url)) {
        consolidated.originalUrls.push(newAttack.url);
    }
    
    // Use the most recent date
    if (new Date(newAttack.date) > new Date(consolidated.date)) {
        consolidated.date = newAttack.date;
    }
    
    // Update confidence based on multiple sources
    consolidated.confidence = Math.min(95, consolidated.confidence + 5);
    
    return consolidated;
}

async function fetchNewsData() {
    try {
        const newsAPIs = [
            {
                name: 'NewsAPI',
                url: `https://newsapi.org/v2/everything?q=(Israel AND Iran AND (attack OR strike OR missile OR rocket)) OR (Israel AND (intercepted OR fired OR launched)) OR (Iran AND (struck OR bombed OR targeted))&language=en&sortBy=publishedAt&pageSize=50&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`,
                headers: { 'X-API-Key': process.env.NEWS_API_KEY }
            },
            {
                name: 'Guardian',
                url: `https://content.guardianapis.com/search?q=(israel%20AND%20iran%20AND%20(attack%20OR%20strike%20OR%20missile))%20OR%20(israel%20AND%20intercepted)%20OR%20(iran%20AND%20struck)&show-fields=all&order-by=newest&page-size=20&from-date=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
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

        return parseArticlesToAttacks(allArticles, attacksCache);
        
    } catch (error) {
        console.error('Error fetching news data:', error.message);
        return await fetchRSSFallback();
    }
}

async function fetchRSSFallback() {
    try {
        console.log('Using RSS fallback feeds');
        return generateFallbackData();
        
    } catch (error) {
        console.error('RSS fallback failed:', error.message);
        return generateFallbackData();
    }
}

function parseArticlesToAttacks(articles, existingAttacks = []) {
    const newAttacks = [];
    const processedHashes = new Set();
    
    articles.forEach((article) => {
        const articleHash = generateArticleHash(article);
        
        // Skip if we've already processed this exact article
        if (processedHashes.has(articleHash)) {
            console.log(`Skipped duplicate article: ${article.title}`);
            return;
        }
        processedHashes.add(articleHash);
        
        const text = `${article.title} ${article.description} ${article.content}`.toLowerCase();
        
        // Enhanced exclusion keyword filtering
        const hasExcludeKeyword = strengthenedExcludeKeywords.some(keyword => text.includes(keyword));
        if (hasExcludeKeyword) {
            console.log(`Filtered out article: ${article.title} (exclusion keyword found)`);
            return;
        }
        
        // Calculate content quality score
        const qualityScore = calculateContentQualityScore(article);
        if (qualityScore < 25) {
            console.log(`Filtered out article: ${article.title} (low quality score: ${qualityScore})`);
            return;
        }
        
        // Must have both attack keywords AND stronger action keywords
        const hasAttackKeyword = attackKeywords.some(keyword => text.includes(keyword));
        const hasStrongActionKeyword = strongActionKeywords.some(keyword => text.includes(keyword));
        
        if (!hasAttackKeyword || !hasStrongActionKeyword) {
            console.log(`Filtered out article: ${article.title} (missing required action keywords)`);
            return;
        }
        
        const location = findLocationInText(text);
        if (!location) {
            console.log(`Filtered out article: ${article.title} (no location found)`);
            return;
        }
        
        // Check if article is recent (within last 7 days)
        const articleDate = new Date(article.publishedAt);
        const daysSincePublished = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished > 7) {
            console.log(`Filtered out article: ${article.title} (too old: ${daysSincePublished.toFixed(1)} days)`);
            return;
        }
        
        const attackType = determineAttackType(text);
        const casualties = extractCasualties(text);
        
        // Create new attack object with enhanced fields
        const newAttack = {
            id: articleHash.substring(0, 8), // Use hash prefix as stable ID
            articleHash: articleHash,
            lat: location.lat,
            lng: location.lng,
            location: `${location.name}, ${location.country}`,
            date: new Date(article.publishedAt),
            type: attackType,
            description: article.description || article.title,
            casualties: casualties,
            source: article.source,
            url: article.url,
            confidence: qualityScore,
            sourceCount: 1,
            originalUrls: [article.url]
        };
        
        // Check for duplicates against existing attacks
        const duplicateCheck = isDuplicateAttack(newAttack, existingAttacks);
        
        if (duplicateCheck.isDuplicate) {
            console.log(`Consolidating duplicate attack: ${article.title} (${duplicateCheck.reason})`);
            // Update the existing attack in the existingAttacks array
            const existingIndex = existingAttacks.findIndex(a => a.id === duplicateCheck.existingAttack.id);
            if (existingIndex !== -1) {
                existingAttacks[existingIndex] = consolidateAttack(duplicateCheck.existingAttack, newAttack);
            }
            return;
        }
        
        // Check for duplicates within new attacks
        const newDuplicate = isDuplicateAttack(newAttack, newAttacks);
        if (newDuplicate.isDuplicate) {
            console.log(`Consolidating new duplicate: ${article.title} (${newDuplicate.reason})`);
            const newIndex = newAttacks.findIndex(a => a.id === newDuplicate.existingAttack.id);
            if (newIndex !== -1) {
                newAttacks[newIndex] = consolidateAttack(newDuplicate.existingAttack, newAttack);
            }
            return;
        }
        
        console.log(`Added high-quality attack: ${article.title} (score: ${qualityScore})`);
        newAttacks.push(newAttack);
    });
    
    return newAttacks.sort((a, b) => new Date(b.date) - new Date(a.date));
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
        
        // Merge new attacks with existing cache instead of replacing
        const allAttacks = [...attacksCache, ...newAttacks];
        
        // Remove duplicates and sort by date
        const uniqueAttacks = allAttacks.filter((attack, index, self) => 
            index === self.findIndex(a => a.id === attack.id)
        );
        
        // Keep only the most recent 30 attacks and sort by date
        attacksCache = uniqueAttacks
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 30);
        
        lastUpdated = new Date();
        const newCount = newAttacks.length;
        const totalCount = attacksCache.length;
        
        console.log(`Updated: ${newCount} new attacks, ${totalCount} total attacks at ${lastUpdated}`);
        
        // Log attack quality statistics
        const avgConfidence = attacksCache.reduce((sum, attack) => sum + (attack.confidence || 50), 0) / attacksCache.length;
        const multiSourceAttacks = attacksCache.filter(attack => (attack.sourceCount || 1) > 1).length;
        console.log(`Average confidence: ${avgConfidence.toFixed(1)}, Multi-source attacks: ${multiSourceAttacks}`);
        
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