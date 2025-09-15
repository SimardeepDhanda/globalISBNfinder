const express = require('express');
const cors = require('cors');
const path = require('path');
const AdapterSystem = require('./lib/adapter-system');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize adapter system
const adapterSystem = new AdapterSystem();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase body size limit
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// CORS proxy endpoint for Google Maps API
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Check book availability endpoint
app.post('/api/check-availability', async (req, res) => {
  try {
    const { places, isbn } = req.body;
    
    if (!places || !isbn) {
      return res.status(400).json({ error: 'Places and ISBN are required' });
    }

    console.log(`Checking availability for ISBN ${isbn} at ${places.length} locations...`);
    
    // Check availability for each place
    const availabilityResults = await Promise.allSettled(
      places.map(place => adapterSystem.checkBookAvailability(place, isbn))
    );

    const results = availabilityResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          isbn,
          source: places[index].name,
          status: 'error',
          copies_available: 0,
          price: null,
          branch: null,
          call_number: null,
          url: null,
          last_checked: new Date().toISOString(),
          confidence: 0,
          error: result.reason.message
        };
      }
    });

    res.json({
      isbn,
      results,
      total_checked: results.length,
      available_count: results.filter(r => r.status === 'available').length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Get available adapters
app.get('/api/adapters', (req, res) => {
  res.json({
    adapters: adapterSystem.getAvailableAdapters(),
    count: adapterSystem.getAvailableAdapters().length
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    adapters_loaded: adapterSystem.getAvailableAdapters().length
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Book Finder v1.1.0 server running on port ${PORT}`);
  console.log(`📚 Open http://localhost:${PORT} to view the app`);
  console.log(`🔧 Loaded ${adapterSystem.getAvailableAdapters().length} adapters`);
  console.log(`✨ Enhanced with loading animations and better error handling`);
});
