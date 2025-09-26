# ParkAudit Pro

A comprehensive Progressive Web App (PWA) for hotel parking lot audits with real-time license plate recognition, automated violation detection, and cloud-based data management.

## ✨ Features

### Core Functionality
- **📱 Cross-Platform PWA**: Works seamlessly on iOS and Android devices through modern web browsers
- **🔍 Real-Time OCR**: Advanced license plate recognition using Tesseract.js
- **📍 GPS Tracking**: Automatic location capture with each audit entry
- **🌐 Offline Support**: Continue auditing even without internet connection with automatic sync
- **☁️ Cloud Storage**: Secure image and data storage using Google Cloud Storage

### Advanced Management
- **🚨 Real-Time Notifications**: Instant violation alerts via WebSocket connections
- **📊 Analytics Dashboard**: Comprehensive reporting with charts and trends
- **🔧 Advanced Filtering**: Date ranges, confidence levels, zones, and location-based filtering
- **📤 Data Export**: CSV and PDF export with filtered data support
- **⌨️ Keyboard Shortcuts**: Desktop optimization with productivity shortcuts
- **🎯 Bulk Operations**: Select and manage multiple audit entries efficiently

### Integrations
- **📋 Google Sheets**: Real-time synchronization of audit data
- **🔐 User Authentication**: Secure session-based authentication system
- **🗄️ PostgreSQL Database**: Robust data persistence with Drizzle ORM
- **📧 Notification Settings**: Customizable alert preferences and thresholds

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Google Cloud Storage account (optional)
- Google Sheets API credentials (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd parkaudit-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/parkaudit
   SESSION_SECRET=your-secure-session-secret
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=your-base64-encoded-private-key
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open http://localhost:5000 in your browser
   - Default login: `admin` / `admin123`

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** + **shadcn/ui** for styling
- **React Query** for server state management
- **Wouter** for lightweight routing
- **Recharts** for data visualization
- **date-fns** for date manipulation

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Passport.js** for authentication
- **WebSocket** for real-time notifications
- **Express Session** for session management

### External Services
- **Tesseract.js** for OCR processing
- **Google Cloud Storage** for file storage
- **Google Sheets API v4** for data synchronization
- **Neon Database** for serverless PostgreSQL

## 📱 PWA Features

- **Offline First**: Continue working without internet connection
- **Background Sync**: Automatic data synchronization when online
- **Push Notifications**: Real-time violation alerts
- **App-Like Experience**: Install on device home screen
- **Camera Integration**: Direct access to device camera for license plate capture

## 🔧 API Documentation

### Authentication
```bash
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

### Audit Entries
```bash
GET /api/audit-entries          # List entries with filtering
POST /api/audit-entries         # Create new entry
PUT /api/audit-entries/:id      # Update entry
DELETE /api/audit-entries/:id   # Delete entry
POST /api/audit-entries/bulk/status  # Bulk status update
DELETE /api/audit-entries/bulk  # Bulk delete
```

### Notifications
```bash
GET /api/notifications          # Get user notifications
POST /api/notifications         # Create notification
PUT /api/notifications/:id/read # Mark as read
DELETE /api/notifications/:id   # Delete notification
GET /api/notification-settings  # Get user preferences
PUT /api/notification-settings  # Update preferences
```

### Analytics
```bash
GET /api/stats                  # Dashboard statistics
```

### WebSocket
- **Endpoint**: `/ws`
- **Authentication**: Session-based
- **Events**: Real-time notifications, system alerts

## 🎯 Usage Guide

### Basic Workflow
1. **Login** to the dashboard
2. **Navigate** to the scan page for mobile auditing
3. **Capture** license plates using camera
4. **Review** OCR results and verify accuracy
5. **Submit** audit entries with location data
6. **Monitor** real-time notifications for violations
7. **Analyze** data using the dashboard analytics

### Desktop Features
- **Ctrl+E**: Export data
- **Ctrl+F**: Open filters
- **Ctrl+A**: Select all entries
- **Ctrl+H**: Show help and shortcuts
- **Delete**: Remove selected entries

### Mobile Optimization
- Touch-friendly interface
- Camera access for plate capture
- GPS location tracking
- Offline mode with sync
- PWA installation

## 🔒 Security Features

- **Session-based Authentication**: Secure login system
- **CSRF Protection**: Request validation
- **Input Sanitization**: SQL injection prevention
- **Secure File Upload**: Validated image uploads
- **Access Control**: Role-based permissions
- **Environment Variables**: Secure credential management

## 📊 Analytics & Reporting

### Dashboard Metrics
- Total scans and trends
- Authorization status distribution
- Confidence rate analytics
- Top parking zones
- Daily/hourly activity patterns

### Export Options
- **CSV Export**: Raw data for analysis
- **PDF Reports**: Formatted reports with charts
- **Filtered Exports**: Export based on search criteria
- **Google Sheets**: Real-time synchronization

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Setup
- Configure production database
- Set up Google Cloud Storage
- Enable Google Sheets API
- Configure domain and SSL
- Set secure session secrets

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use existing UI components from shadcn/ui
- Write tests for new features
- Update documentation for API changes
- Follow the existing code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tesseract.js** for OCR capabilities
- **shadcn/ui** for beautiful UI components
- **Neon Database** for serverless PostgreSQL
- **Google Cloud** for storage and APIs
- **Replit** for development platform

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation for common solutions
- Review the API documentation for integration help

---

**ParkAudit Pro** - Making parking lot audits efficient, accurate, and data-driven. 🚗📊