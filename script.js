let map;
let attackData = [];

function initMap() {
    map = L.map('map').setView([31.5, 35.0], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    loadAttackData();
}

function loadAttackData() {
    attackData = [
        {
            id: 1,
            lat: 31.7683,
            lng: 35.2137,
            location: "Jerusalem, Israel",
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            type: "Missile Strike",
            description: "Multiple missiles intercepted by Iron Dome system",
            casualties: "No casualties reported"
        },
        {
            id: 2,
            lat: 32.0853,
            lng: 34.7818,
            location: "Tel Aviv, Israel",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            type: "Drone Attack",
            description: "Drone intercepted over metropolitan area",
            casualties: "Minor injuries reported"
        },
        {
            id: 3,
            lat: 35.6944,
            lng: 51.4215,
            location: "Tehran, Iran",
            date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
            type: "Retaliatory Strike",
            description: "Targeted military installation",
            casualties: "Unknown"
        },
        {
            id: 4,
            lat: 33.5138,
            lng: 36.2765,
            location: "Damascus, Syria",
            date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
            type: "Air Strike",
            description: "Strike on weapons depot",
            casualties: "Military personnel"
        },
        {
            id: 5,
            lat: 32.7940,
            lng: 35.0308,
            location: "Haifa, Israel",
            date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
            type: "Rocket Attack",
            description: "Rockets fired from Lebanon border",
            casualties: "Property damage only"
        }
    ];
    
    displayAttacks();
}

function getAttackAge(attackDate) {
    const now = new Date();
    const diffTime = Math.abs(now - attackDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getMarkerStyle(daysOld) {
    if (daysOld <= 7) {
        return {
            color: '#ff4444',
            size: 15,
            opacity: 1.0,
            className: 'recent'
        };
    } else if (daysOld <= 30) {
        return {
            color: '#ffaa00',
            size: 12,
            opacity: 0.8,
            className: 'moderate'
        };
    } else {
        return {
            color: '#888888',
            size: 8,
            opacity: 0.6,
            className: 'old'
        };
    }
}

function displayAttacks() {
    attackData.forEach(attack => {
        const daysOld = getAttackAge(attack.date);
        const style = getMarkerStyle(daysOld);
        
        const marker = L.circleMarker([attack.lat, attack.lng], {
            radius: style.size,
            fillColor: style.color,
            color: '#ffffff',
            weight: 2,
            opacity: style.opacity,
            fillOpacity: 0.8
        }).addTo(map);
        
        if (daysOld <= 7) {
            marker.bindPopup(createPopupContent(attack), {
                className: 'attack-popup'
            });
            
            setInterval(() => {
                marker.setStyle({
                    fillOpacity: marker.options.fillOpacity === 0.8 ? 0.4 : 0.8
                });
            }, 1000);
        } else {
            marker.bindPopup(createPopupContent(attack), {
                className: 'attack-popup'
            });
        }
        
        marker.on('click', () => {
            displayAttackDetails(attack);
        });
    });
}

function createPopupContent(attack) {
    const daysOld = getAttackAge(attack.date);
    const timeAgo = daysOld === 0 ? 'Today' : 
                   daysOld === 1 ? '1 day ago' : 
                   `${daysOld} days ago`;
    
    return `
        <div class="attack-popup">
            <h4>${attack.type}</h4>
            <div class="date">${timeAgo}</div>
            <div class="location">${attack.location}</div>
            <div class="description">${attack.description}</div>
        </div>
    `;
}

function displayAttackDetails(attack) {
    const daysOld = getAttackAge(attack.date);
    const timeAgo = daysOld === 0 ? 'Today' : 
                   daysOld === 1 ? '1 day ago' : 
                   `${daysOld} days ago`;
    
    const detailsHTML = `
        <h4>${attack.type}</h4>
        <p><strong>Date:</strong> ${attack.date.toLocaleDateString()} (${timeAgo})</p>
        <p><strong>Location:</strong> ${attack.location}</p>
        <p><strong>Description:</strong> ${attack.description}</p>
        <p><strong>Casualties:</strong> ${attack.casualties}</p>
    `;
    
    document.getElementById('attack-details').innerHTML = detailsHTML;
}

document.addEventListener('DOMContentLoaded', initMap);