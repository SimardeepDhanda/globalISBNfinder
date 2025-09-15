# 📚 Book Finder

A sleek web application that helps you find books at nearby libraries and bookstores using ISBN numbers. Built with Google Maps API and designed for the Greater Toronto Area.

## ✨ Features

- **ISBN Search**: Enter any 13-digit ISBN to search for books
- **Location-Based**: Automatically finds libraries and bookstores near you
- **Progressive Search**: Expands search radius (20km → 50km → 100km) if no results found
- **Real-Time Results**: Shows distance, ratings, and availability status
- **Sleek Design**: Modern black and white UI with glassmorphism effects
- **Mobile Responsive**: Works perfectly on all devices

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Google Maps API key

### Installation

1. **Clone or download the project**
   ```bash
   cd codedex-cafe-curator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

### Development Mode
```bash
npm run dev
```

## 🔧 Configuration

The app uses your Google Maps API key. Make sure you have:
- Places API enabled
- Geocoding API enabled (for location services)

## 📱 How to Use

1. **Enter ISBN**: Type a 13-digit ISBN number (e.g., 9781234567890)
2. **Allow Location**: Grant location permission when prompted
3. **View Results**: See nearby libraries and bookstores with book availability
4. **Expand Search**: Click "Search Further" if no results found nearby

## 🏗️ Architecture

### Frontend
- **HTML/CSS/JavaScript**: Clean, modern interface
- **Google Maps Places API**: Find nearby libraries and bookstores
- **Geolocation API**: Get user's current location
- **Responsive Design**: Works on all screen sizes

### Backend
- **Express.js**: Simple server for CORS handling
- **CORS Proxy**: Handles cross-origin requests to Google Maps API
- **Static File Serving**: Serves the frontend application

## 🔮 Phase 1 Complete

✅ Clean HTML structure with ISBN search  
✅ Sleek black and white CSS styling  
✅ Location detection and caching  
✅ Google Maps API integration  
✅ ISBN validation  
✅ Progressive search radius  
✅ Results display with location cards  
✅ Basic Express server for CORS  

## 🚧 Upcoming Features (Phase 2+)

- **Book Availability Checking**: Real-time availability at each location
- **Adapter System**: Handle different library/bookstore websites
- **Book Details**: Title, author, and cover images from ISBN
- **Historical Tracking**: Track availability changes over time
- **Notifications**: Alert when books become available

## 🛠️ Technical Details

- **ISBN Validation**: Full ISBN-13 checksum validation
- **Distance Calculation**: Haversine formula for accurate distances
- **Location Caching**: 10-minute cache for better performance
- **Error Handling**: Comprehensive error handling and user feedback
- **Progressive Enhancement**: Works without JavaScript for basic functionality

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

This is Phase 1 of the Book Finder project. Future phases will add:
- Backend scraping system
- Database integration
- Advanced availability checking
- User accounts and notifications

---

**Ready to find your next book?** 📚✨