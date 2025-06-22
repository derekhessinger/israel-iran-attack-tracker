let map;
let attackData = [];
let mapMarkers = [];
let selectedAttackId = null;

function initMap() {
    try {
        map = L.map('map').setView([31.5, 35.0], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);
        
        loadAttackData();
    } catch (error) {
        console.error('Error initializing map:', error);
        showError('Failed to initialize map. Some features may not work.');
    }
    
    // Always set up event listeners regardless of map initialization
    setupEventListeners();
}

async function loadAttackData() {
    try {
        showLoadingState(true);
        const response = await fetch('http://localhost:3000/api/attacks');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        attackData = data.attacks.map(attack => ({
            ...attack,
            date: new Date(attack.date)
        }));
        
        displayAttacks();
        populateAttacksTable();
        
        if (data.lastUpdated) {
            document.getElementById('update-time').textContent = 
                new Date(data.lastUpdated).toLocaleTimeString();
        }
        
        showLoadingState(false);
        
    } catch (error) {
        console.error('Error loading attack data:', error);
        showError('Failed to load attack data. Using offline mode.');
        loadFallbackData();
        showLoadingState(false);
    }
}

function loadFallbackData() {
    attackData = [
        {
            id: 1,
            lat: 31.7683,
            lng: 35.2137,
            location: "Jerusalem, Israel",
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: "Missile Strike",
            description: "Multiple missiles intercepted by Iron Dome system (Offline Data)",
            casualties: "No casualties reported"
        },
        {
            id: 2,
            lat: 32.0853,
            lng: 34.7818,
            location: "Tel Aviv, Israel",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            type: "Drone Attack",
            description: "Drone intercepted over metropolitan area (Offline Data)",
            casualties: "Minor injuries reported"
        }
    ];
    
    displayAttacks();
    populateAttacksTable();
    updateLastUpdatedTime();
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
    clearMapMarkers();
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
            selectTableRow(attack.id);
        });
        
        marker.attackId = attack.id;
        mapMarkers.push(marker);
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
    
    // Quality assessment
    const confidence = attack.confidence || 50;
    const sourceCount = attack.sourceCount || 1;
    
    let confidenceColor = '#ff4444';
    let confidenceText = 'Low Confidence';
    if (confidence >= 70) {
        confidenceColor = '#44ff44';
        confidenceText = 'High Confidence';
    } else if (confidence >= 50) {
        confidenceColor = '#ffaa00';
        confidenceText = 'Medium Confidence';
    }
    
    // Source verification
    const sourceVerification = sourceCount > 1 
        ? `<span style="color: #44ff44;">✓ Verified by ${sourceCount} sources</span>`
        : `<span style="color: #ffaa00;">⚠ Single source report</span>`;
    
    // Multiple source URLs
    let sourceLinks = '';
    if (attack.originalUrls && attack.originalUrls.length > 1) {
        sourceLinks = '<p><strong>Sources:</strong></p><ul>';
        attack.originalUrls.forEach((url, index) => {
            sourceLinks += `<li><a href="${url}" target="_blank" style="color: #88ccff;">Source ${index + 1}</a></li>`;
        });
        sourceLinks += '</ul>';
    } else if (attack.url && attack.url !== '#') {
        sourceLinks = `<p><strong>Source:</strong> <a href="${attack.url}" target="_blank" style="color: #88ccff;">View original report</a></p>`;
    }
    
    const detailsHTML = `
        <h4>${attack.type}</h4>
        <div class="quality-assessment" style="margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 4px;">
            <div style="color: ${confidenceColor};">🎯 ${confidenceText} (${confidence}%)</div>
            <div>${sourceVerification}</div>
        </div>
        <p><strong>Date:</strong> ${attack.date.toLocaleDateString()} (${timeAgo})</p>
        <p><strong>Location:</strong> ${attack.location}</p>
        <p><strong>Description:</strong> ${attack.description}</p>
        <p><strong>Casualties:</strong> ${attack.casualties}</p>
        <p><strong>Primary Source:</strong> ${attack.source || 'Unknown'}</p>
        ${sourceLinks}
    `;
    
    document.getElementById('attack-details').innerHTML = detailsHTML;
    selectedAttackId = attack.id;
}

function clearMapMarkers() {
    mapMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    mapMarkers = [];
}

function setupEventListeners() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', updateAttackData);
    }
}

async function updateAttackData() {
    const updateBtn = document.getElementById('update-btn');
    if (!updateBtn) {
        console.error('Update button not found in updateAttackData');
        return;
    }
    
    updateBtn.textContent = '🔄 Updating...';
    updateBtn.disabled = true;
    
    try {
        showLoadingState(true);
        const response = await fetch('http://localhost:3000/api/attacks/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const oldAttackCount = attackData.length;
        const newAttackData = data.attacks.map(attack => ({
            ...attack,
            date: new Date(attack.date)
        }));
        
        attackData = newAttackData;
        displayAttacks();
        populateAttacksTable();
        
        if (data.lastUpdated) {
            document.getElementById('update-time').textContent = 
                new Date(data.lastUpdated).toLocaleTimeString();
        }
        
        const newAttackCount = newAttackData.length;
        if (newAttackCount > oldAttackCount) {
            const newAttacks = newAttackCount - oldAttackCount;
            showSuccess(`Updated successfully! Found ${newAttacks} new attack${newAttacks === 1 ? '' : 's'}.`);
        } else {
            showSuccess('Updated successfully! No new attacks found.');
        }
        
    } catch (error) {
        console.error('Error updating attack data:', error);
        showError('Failed to update data from server.');
    } finally {
        if (updateBtn) {
            updateBtn.textContent = '🔄 Update Data';
            updateBtn.disabled = false;
        }
        showLoadingState(false);
    }
}

function showLoadingState(isLoading) {
    const loadingElements = document.querySelectorAll('.loading-indicator');
    const contentElements = document.querySelectorAll('#attacks-table, #map');
    
    if (isLoading) {
        contentElements.forEach(el => el.style.opacity = '0.5');
        if (loadingElements.length === 0) {
            const loader = document.createElement('div');
            loader.className = 'loading-indicator';
            loader.innerHTML = '<div class="spinner"></div><p>Loading attack data...</p>';
            document.getElementById('attacks-table-container').appendChild(loader);
        }
    } else {
        contentElements.forEach(el => el.style.opacity = '1');
        loadingElements.forEach(el => el.remove());
    }
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function populateAttacksTable() {
    const tbody = document.getElementById('attacks-tbody');
    tbody.innerHTML = '';
    
    // Handle empty state
    if (attackData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="5" class="empty-state">
                <div class="empty-content">
                    <span class="empty-icon">🔍</span>
                    <h3>No attacks detected</h3>
                    <p>System is monitoring for new incidents...</p>
                </div>
            </td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }
    
    // Handle low activity state
    if (attackData.length <= 2) {
        const infoRow = document.createElement('tr');
        infoRow.innerHTML = `
            <td colspan="5" class="low-activity-notice">
                <span class="info-icon">ℹ️</span>
                Limited recent activity detected (${attackData.length} incident${attackData.length === 1 ? '' : 's'})
            </td>
        `;
        tbody.appendChild(infoRow);
    }
    
    attackData.forEach(attack => {
        const row = document.createElement('tr');
        row.setAttribute('data-attack-id', attack.id);
        
        const daysOld = getAttackAge(attack.date);
        const timeAgo = daysOld === 0 ? 'Today' : 
                       daysOld === 1 ? '1 day ago' : 
                       `${daysOld} days ago`;
        
        let statusClass = 'status-old';
        let statusText = 'Old';
        if (daysOld <= 7) {
            statusClass = 'status-recent';
            statusText = 'Recent';
        } else if (daysOld <= 30) {
            statusClass = 'status-moderate';
            statusText = 'Moderate';
        }
        
        // Quality indicators
        const confidence = attack.confidence || 50;
        const sourceCount = attack.sourceCount || 1;
        
        let confidenceClass = 'confidence-low';
        let confidenceText = 'Low';
        if (confidence >= 70) {
            confidenceClass = 'confidence-high';
            confidenceText = 'High';
        } else if (confidence >= 50) {
            confidenceClass = 'confidence-medium';
            confidenceText = 'Medium';
        }
        
        const sourceIcon = sourceCount > 1 ? '🔗' : '📰';
        const sourceTitle = sourceCount > 1 ? `Verified by ${sourceCount} sources` : 'Single source';
        
        row.innerHTML = `
            <td>${attack.location}</td>
            <td>${attack.type}</td>
            <td>${timeAgo}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="quality-cell">
                <div class="quality-indicators">
                    <span class="confidence-badge ${confidenceClass}" title="Confidence: ${confidence}%">${confidenceText}</span>
                    <span class="source-indicator" title="${sourceTitle}">${sourceIcon}${sourceCount}</span>
                </div>
            </td>
        `;
        
        row.addEventListener('click', () => {
            displayAttackDetails(attack);
            selectTableRow(attack.id);
            highlightMapMarker(attack.id);
        });
        
        tbody.appendChild(row);
    });
}

function selectTableRow(attackId) {
    document.querySelectorAll('#attacks-table tbody tr').forEach(row => {
        row.classList.remove('selected');
    });
    
    const selectedRow = document.querySelector(`[data-attack-id="${attackId}"]`);
    if (selectedRow) {
        selectedRow.classList.add('selected');
    }
}

function highlightMapMarker(attackId) {
    const marker = mapMarkers.find(m => m.attackId === attackId);
    if (marker) {
        marker.openPopup();
        map.setView(marker.getLatLng(), 8);
    }
}

function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('update-time').textContent = timeString;
}

document.addEventListener('DOMContentLoaded', initMap);