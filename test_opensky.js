const https = require('https');
const options = {
    hostname: 'opensky-network.org',
    path: '/api/states/all',
    auth: 'nishal21-api-client:PAHKVJ6R5W4Cu3XXEi3prCIkqnr9XqIP',
    headers: {
        'User-Agent': 'node.js HTTPS-test'
    }
};
https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Total states:', json.states ? json.states.length : 'none');
            if (json.states) {
                const filtered = json.states.filter(s => s[5] != null && s[6] != null && !s[8]);
                console.log('Filtered states:', filtered.length);
            } else {
                console.log(json)
            }
        } catch (e) {
            console.log("Parse error:", e)
            console.log("Raw:", data.slice(0, 500))
        }
    });
}).on('error', console.error);
