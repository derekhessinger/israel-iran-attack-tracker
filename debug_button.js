// Simple test to debug the update button functionality
const express = require('express');
const path = require('path');

// Create a simple test server
const app = express();
app.use(express.static(__dirname));

app.get('/debug', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Debug Update Button</title>
</head>
<body>
    <h1>Debug Update Button</h1>
    <button id="update-btn">🔄 Update Data</button>
    <div id="status"></div>
    <div id="console-log"></div>
    
    <script>
        const statusDiv = document.getElementById('status');
        const consoleDiv = document.getElementById('console-log');
        
        function log(message) {
            console.log(message);
            consoleDiv.innerHTML = consoleDiv.innerHTML + '<br>' + message;
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            log('DOM loaded');
            const updateBtn = document.getElementById('update-btn');
            
            if (updateBtn) {
                log('Update button found');
                updateBtn.addEventListener('click', async function() {
                    log('Button clicked!');
                    statusDiv.innerHTML = 'Button clicked! Making request...';
                    
                    try {
                        const response = await fetch('/api/attacks/refresh', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            log('API response received: ' + JSON.stringify(data, null, 2));
                            statusDiv.innerHTML = 'SUCCESS: Got ' + data.count + ' attacks';
                        } else {
                            log('API error: ' + response.status);
                            statusDiv.innerHTML = 'API ERROR: ' + response.status;
                        }
                    } catch (error) {
                        log('Fetch error: ' + error.message);
                        statusDiv.innerHTML = 'FETCH ERROR: ' + error.message;
                    }
                });
            } else {
                log('Update button NOT found');
            }
        });
    </script>
</body>
</html>
    `);
});

app.listen(8080, () => {
    console.log('Debug server running on http://localhost:8080/debug');
});