const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const fetch = require('node-fetch');

class AdapterSystem {
  constructor() {
    this.adapters = new Map();
    this.rateLimits = new Map();
    this.loadAdapters();
  }

  loadAdapters() {
    const adaptersDir = path.join(__dirname, '../adapters');
    
    if (!fs.existsSync(adaptersDir)) {
      console.log('No adapters directory found');
      return;
    }

    const files = fs.readdirSync(adaptersDir).filter(file => file.endsWith('.yaml'));
    
    files.forEach(file => {
      try {
        const adapterPath = path.join(adaptersDir, file);
        const adapterConfig = yaml.load(fs.readFileSync(adapterPath, 'utf8'));
        this.adapters.set(adapterConfig.name, adapterConfig);
        console.log(`Loaded adapter: ${adapterConfig.name}`);
      } catch (error) {
        console.error(`Error loading adapter ${file}:`, error.message);
      }
    });
  }

  async checkBookAvailability(place, isbn) {
    console.log(`🔍 Starting availability check for ${place.name} (ISBN: ${isbn})`);
    
    const adapter = this.findAdapter(place);
    console.log(`🔧 Adapter found: ${adapter ? adapter.name : 'None'}`);
    
    if (!adapter) {
      console.log(`❌ No adapter found for ${place.name}`);
      return {
        isbn,
        source: place.name,
        status: 'unknown',
        copies_available: 0,
        price: null,
        branch: null,
        call_number: null,
        url: null,
        last_checked: new Date().toISOString(),
        confidence: 0,
        error: 'No adapter found for this location'
      };
    }

    // Check rate limiting
    if (this.isRateLimited(adapter.name)) {
      console.log(`⏳ Rate limited for ${adapter.name}`);
      return {
        isbn,
        source: place.name,
        status: 'rate_limited',
        copies_available: 0,
        price: null,
        branch: null,
        call_number: null,
        url: null,
        last_checked: new Date().toISOString(),
        confidence: 0,
        error: 'Rate limited - please try again later'
      };
    }

    try {
      console.log(`🌐 Starting web scraping for ${adapter.name}...`);
      const result = await this.scrapeAvailability(adapter, isbn);
      this.updateRateLimit(adapter.name);
      console.log(`✅ Scraping completed for ${adapter.name}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Error checking availability for ${place.name}:`, error.message);
      return {
        isbn,
        source: place.name,
        status: 'error',
        copies_available: 0,
        price: null,
        branch: null,
        call_number: null,
        url: null,
        last_checked: new Date().toISOString(),
        confidence: 0,
        error: error.message
      };
    }
  }

  findAdapter(place) {
    const placeName = place.name.toLowerCase();
    const placeVicinity = (place.vicinity || '').toLowerCase();
    
    console.log(`🔍 Looking for adapter for: "${placeName}" in vicinity: "${placeVicinity}"`);
    
    // Try to match by name with more flexible matching
    for (const [name, adapter] of this.adapters) {
      const adapterName = name.toLowerCase();
      
      // Direct name match
      if (placeName.includes(adapterName) || adapterName.includes(placeName)) {
        console.log(`✅ Direct name match found: ${adapterName}`);
        return adapter;
      }
      
      // Match by key terms (e.g., "Hamilton Public Library" matches "Hamilton")
      const keyTerms = adapterName.split(' ').filter(term => term.length > 3);
      const matchCount = keyTerms.filter(term => 
        placeName.includes(term) || placeVicinity.includes(term)
      ).length;
      
      if (matchCount >= 1) {
        console.log(`✅ Key term match found: ${adapterName} (${matchCount} terms)`);
        return adapter;
      }
    }

    // Try to match by website domain
    if (place.website) {
      try {
        const domain = new URL(place.website).hostname;
        for (const [name, adapter] of this.adapters) {
          if (adapter.base_url) {
            const adapterDomain = new URL(adapter.base_url).hostname;
            if (domain.includes(adapterDomain) || adapterDomain.includes(domain)) {
              console.log(`✅ Domain match found: ${adapterDomain}`);
              return adapter;
            }
          }
        }
      } catch (e) {
        // Invalid URL, continue with other methods
      }
    }

    // Try to match by common library patterns
    const libraryPatterns = [
      { pattern: /public library/i, adapter: 'Toronto Public Library' },
      { pattern: /hamilton.*library/i, adapter: 'Hamilton Public Library' },
      { pattern: /university.*library/i, adapter: 'University of Toronto Library' },
      { pattern: /york.*library/i, adapter: 'York University Library' },
      { pattern: /indigo|chapters/i, adapter: 'Indigo/Chapters' },
      { pattern: /amazon/i, adapter: 'Amazon Canada' }
    ];

    for (const { pattern, adapter } of libraryPatterns) {
      if (pattern.test(placeName) || pattern.test(placeVicinity)) {
        console.log(`✅ Pattern match found: ${adapter}`);
        return this.adapters.get(adapter);
      }
    }

    console.log(`❌ No adapter found for ${placeName}`);
    return null;
  }

  async scrapeAvailability(adapter, isbn) {
    const searchUrl = `${adapter.base_url}${adapter.search_endpoint.replace('{isbn}', isbn)}`;
    
    console.log(`🌐 Scraping ${adapter.name}: ${searchUrl}`);
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000);
      });

      // Create the fetch promise
      const fetchPromise = fetch(searchUrl, {
        method: adapter.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow'
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`📄 Response received: ${html.length} characters`);
      
      const result = this.parseAvailability(adapter, html, searchUrl);
      console.log(`🔍 Parsed result:`, result);
      
      return {
        isbn,
        source: adapter.name,
        ...result,
        last_checked: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Scraping error for ${adapter.name}:`, error.message);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  parseAvailability(adapter, html, url) {
    console.log(`🔍 Parsing availability for ${adapter.name}...`);
    
    // Try structured data first
    if (adapter.structured_data?.schema_org || adapter.structured_data?.json_ld) {
      console.log(`🔍 Trying structured data parsing...`);
      const structuredResult = this.parseStructuredData(html, adapter);
      if (structuredResult.confidence > 0.5) {
        console.log(`✅ Structured data parsing successful:`, structuredResult);
        return structuredResult;
      }
    }

    // Fall back to HTML parsing
    console.log(`🔍 Falling back to HTML parsing...`);
    const htmlResult = this.parseHTML(html, adapter, url);
    console.log(`🔍 HTML parsing result:`, htmlResult);
    return htmlResult;
  }

  parseStructuredData(html, adapter) {
    // Look for JSON-LD structured data
    if (adapter.structured_data?.json_ld) {
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          try {
            const jsonData = JSON.parse(match.replace(/<script[^>]*type="application\/ld\+json"[^>]*>/, '').replace(/<\/script>/, ''));
            const result = this.extractFromStructuredData(jsonData, adapter);
            if (result.confidence > 0.5) {
              return result;
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }
    }

    return { confidence: 0 };
  }

  extractFromStructuredData(data, adapter) {
    // Look for book availability in structured data
    if (data['@type'] === 'Book' || data['@type'] === 'Product') {
      const availability = data.offers?.availability || data.availability;
      const price = data.offers?.price || data.price;
      
      if (availability) {
        const status = this.classifyAvailability(availability, adapter);
        return {
          status: status.status,
          copies_available: status.copies || 0,
          price: price || null,
          confidence: status.confidence
        };
      }
    }

    return { confidence: 0 };
  }

  parseHTML(html, adapter, url) {
    console.log(`🔍 Parsing HTML with selectors for ${adapter.name}...`);
    
    // Simple HTML parsing using regex (in production, use cheerio or similar)
    const result = {
      status: 'unknown',
      copies_available: 0,
      price: null,
      branch: null,
      call_number: null,
      url: url,
      confidence: 0
    };

    // Try to find availability using selectors
    if (adapter.selectors?.available) {
      console.log(`🔍 Checking available selectors: ${adapter.selectors.available}`);
      const availablePatterns = adapter.selectors.available.split(',').map(s => s.trim());
      for (const pattern of availablePatterns) {
        const availableMatch = html.match(new RegExp(pattern, 'gi'));
        if (availableMatch) {
          console.log(`✅ Found available pattern: ${pattern}`);
          result.status = 'available';
          result.confidence = 0.8;
          result.copies_available = 1; // Default to 1 if available
          break;
        }
      }
    }

    if (adapter.selectors?.unavailable) {
      console.log(`🔍 Checking unavailable selectors: ${adapter.selectors.unavailable}`);
      const unavailablePatterns = adapter.selectors.unavailable.split(',').map(s => s.trim());
      for (const pattern of unavailablePatterns) {
        const unavailableMatch = html.match(new RegExp(pattern, 'gi'));
        if (unavailableMatch) {
          console.log(`✅ Found unavailable pattern: ${pattern}`);
          result.status = 'unavailable';
          result.confidence = 0.8;
          break;
        }
      }
    }

    // Special handling for HPL website structure
    if (adapter.name === 'Hamilton Public Library') {
      console.log(`🔍 Special handling for Hamilton Public Library...`);
      // Look for specific HPL patterns
      if (html.includes('Available') && html.includes('Book') && html.includes('Visit')) {
        console.log(`✅ HPL available pattern found`);
        result.status = 'available';
        result.confidence = 0.9;
        result.copies_available = 1;
      } else if (html.includes('All copies in use') || html.includes('Checked Out')) {
        console.log(`✅ HPL unavailable pattern found`);
        result.status = 'unavailable';
        result.confidence = 0.9;
      }
    }

    // Try keyword classification as fallback
    if (result.confidence < 0.5) {
      console.log(`🔍 Trying keyword classification fallback...`);
      const keywordResult = this.classifyByKeywords(html, adapter);
      if (keywordResult.confidence > result.confidence) {
        console.log(`✅ Keyword classification successful:`, keywordResult);
        result.status = keywordResult.status;
        result.confidence = keywordResult.confidence;
      }
    }

    console.log(`🔍 Final parsing result:`, result);
    return result;
  }

  classifyByKeywords(html, adapter) {
    const text = html.toLowerCase();
    const availableKeywords = adapter.fallback_keywords?.available || [];
    const unavailableKeywords = adapter.fallback_keywords?.unavailable || [];

    console.log(`🔍 Available keywords: ${availableKeywords.join(', ')}`);
    console.log(`🔍 Unavailable keywords: ${unavailableKeywords.join(', ')}`);

    let availableScore = 0;
    let unavailableScore = 0;

    availableKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        availableScore++;
        console.log(`✅ Found available keyword: ${keyword}`);
      }
    });

    unavailableKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        unavailableScore++;
        console.log(`✅ Found unavailable keyword: ${keyword}`);
      }
    });

    console.log(`🔍 Keyword scores - Available: ${availableScore}, Unavailable: ${unavailableScore}`);

    if (availableScore > unavailableScore && availableScore > 0) {
      return { status: 'available', confidence: Math.min(0.7, availableScore * 0.2) };
    } else if (unavailableScore > availableScore && unavailableScore > 0) {
      return { status: 'unavailable', confidence: Math.min(0.7, unavailableScore * 0.2) };
    }

    return { status: 'unknown', confidence: 0 };
  }

  classifyAvailability(availability, adapter) {
    const availableKeywords = adapter.status_keywords?.available || [];
    const unavailableKeywords = adapter.status_keywords?.unavailable || [];

    const availabilityLower = availability.toLowerCase();

    for (const keyword of availableKeywords) {
      if (availabilityLower.includes(keyword.toLowerCase())) {
        return { status: 'available', copies: 1, confidence: 0.8 };
      }
    }

    for (const keyword of unavailableKeywords) {
      if (availabilityLower.includes(keyword.toLowerCase())) {
        return { status: 'unavailable', copies: 0, confidence: 0.8 };
      }
    }

    return { status: 'unknown', copies: 0, confidence: 0.3 };
  }

  isRateLimited(adapterName) {
    const lastRequest = this.rateLimits.get(adapterName);
    if (!lastRequest) return false;

    const adapter = this.adapters.get(adapterName);
    const rateLimitMs = (adapter?.rate_limit || 1) * 1000;
    
    return Date.now() - lastRequest < rateLimitMs;
  }

  updateRateLimit(adapterName) {
    this.rateLimits.set(adapterName, Date.now());
  }

  getAvailableAdapters() {
    return Array.from(this.adapters.keys());
  }
}

module.exports = AdapterSystem;