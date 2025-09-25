# ParkAudit Pro - Cross-Platform Parking Lot Audit App

## Overview

ParkAudit Pro is a Progressive Web App (PWA) designed for hotel parking lot audits. The application enables staff to use smartphone cameras to scan vehicle license plates, automatically detect and read plate numbers using OCR technology, and maintain comprehensive audit logs. The system supports both online and offline functionality, with automatic synchronization to cloud storage and optional Google Sheets integration.

The application features real-time license plate recognition, GPS location tracking, image capture capabilities, whitelist management for authorized vehicles, and a desktop dashboard for reporting and management. Built as a cross-platform solution, it works seamlessly on both iOS and Android devices through modern web browsers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Environment Configuration
The application requires the following environment variables for full functionality:
- **Database**: `DATABASE_URL` (PostgreSQL connection string)
- **Object Storage**: Google Cloud Storage credentials via object storage integration
- **Google Sheets API**: Service account authentication
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email address
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Service account private key (base64 encoded with escaped newlines)
- **Session Management**: `SESSION_SECRET` for secure session handling

### Frontend Architecture
The frontend is built using React with TypeScript and utilizes a modern component-based architecture. The application uses Vite as the build tool and development server, providing fast hot-reload capabilities. The UI is constructed with shadcn/ui components built on top of Radix UI primitives, styled with Tailwind CSS for consistent design patterns.

Key frontend decisions include:
- **Routing**: Uses Wouter for lightweight client-side routing
- **State Management**: Leverages React Query (@tanstack/react-query) for server state management and caching
- **Styling**: Tailwind CSS with CSS custom properties for theming support
- **PWA Features**: Service worker implementation for offline functionality and caching
- **Camera Integration**: Direct browser API access for camera functionality with getUserMedia()

### Backend Architecture  
The backend follows a REST API pattern built with Express.js and TypeScript. The server implements a modular route structure with dedicated endpoints for audit entries, file uploads, whitelist management, and settings.

Core backend components:
- **API Layer**: Express.js server with middleware for logging, error handling, and CORS
- **Storage Abstraction**: Interface-based storage layer supporting multiple implementations
- **File Management**: Google Cloud Storage integration for image and document storage
- **OCR Processing**: Server-side integration with Tesseract.js for license plate recognition

### Data Storage Solutions
The application uses a PostgreSQL database with Drizzle ORM for type-safe database operations. The database schema supports audit entries, user management, whitelist plates, and application settings with proper indexing for performance.

Database design decisions:
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe queries and migrations
- **Schema Management**: Version-controlled migrations with Drizzle Kit
- **Offline Storage**: Browser localStorage for offline audit entry caching

### Authentication and Authorization
The system implements a simple user-based authentication system with session management. User roles and permissions are handled through the backend API with proper middleware validation.

### File Storage and Management
Images and documents are stored using Google Cloud Storage with a comprehensive access control system. The application supports both public and private file access patterns with proper ACL management.

## External Dependencies

### Cloud Services
- **Neon Database**: Serverless PostgreSQL hosting for primary data storage with complete database persistence
- **Google Cloud Storage**: Object storage for images and file attachments with ACL support
- **Google Sheets API v4**: Real-time integration for audit data synchronization using service account authentication

### Third-Party Libraries and APIs
- **Tesseract.js**: Client-side OCR engine for license plate recognition
- **Uppy**: File upload handling with drag-and-drop support and progress tracking
- **Radix UI**: Accessible component primitives for the user interface
- **React Query**: Server state management and caching layer
- **Wouter**: Lightweight routing library for single-page application navigation

### Development and Build Tools
- **Vite**: Build tool and development server with hot module replacement
- **TypeScript**: Type safety across the entire application stack
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Drizzle Kit**: Database schema management and migration tools
- **ESBuild**: Fast JavaScript bundling for production builds

### Browser APIs
- **MediaDevices API**: Camera access for license plate capture
- **Geolocation API**: GPS coordinates for audit entry location tracking
- **Service Worker API**: Offline functionality and background synchronization
- **LocalStorage API**: Client-side data persistence for offline mode