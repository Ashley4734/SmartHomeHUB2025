# Smart Home Hub - Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Security Architecture](#security-architecture)
- [Monitoring & Observability](#monitoring--observability)
- [Deployment Architecture](#deployment-architecture)

## Overview

Smart Home Hub is a comprehensive AI-powered home automation platform supporting multiple IoT protocols (Zigbee, Matter, MQTT) with voice control, automation, and intelligent device management.

### Key Features
- Multi-protocol device support (Zigbee, Matter, MQTT)
- AI-powered automation and natural language processing
- Voice control integration
- Real-time device monitoring via WebSockets
- Progressive Web App (PWA) interface
- Role-based access control (RBAC)
- Comprehensive monitoring and logging

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   React PWA  │  │  WebSocket   │  │    Vite      │         │
│  │   (Zustand)  │  │   Client     │  │   Builder    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   HTTPS / WSS     │
                    └─────────┬─────────┘
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Backend                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Express.js Server                       │  │
│  │  • Helmet Security  • CORS  • Rate Limiting              │  │
│  │  • Request Logger   • Error Handler  • Metrics          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────┬────────┬───────┴────────┬────────┬──────────┐   │
│  │   Auth   │ Device │  Automation    │   AI   │  Voice   │   │
│  │  Module  │Manager │     Engine     │Service │  Control │   │
│  └──────────┴────────┴────────────────┴────────┴──────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
┌───────────────────┴───┐   ┌──────────┴──────────┐
│   Protocol Layer      │   │   Data Layer         │
│  ┌─────────────────┐ │   │  ┌────────────────┐ │
│  │ Zigbee Handler  │ │   │  │  SQLite DB     │ │
│  ├─────────────────┤ │   │  │  (Better-SQLite)│ │
│  │ Matter Handler  │ │   │  └────────────────┘ │
│  ├─────────────────┤ │   │  ┌────────────────┐ │
│  │ MQTT Handler    │ │   │  │  Redis Cache   │ │
│  └─────────────────┘ │   │  └────────────────┘ │
└───────────────────────┘   └─────────────────────┘
           │
┌──────────┴──────────┐
│   IoT Devices       │
│  • Zigbee Devices   │
│  • Matter Devices   │
│  • MQTT Devices     │
└─────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js 4.18
- **Database**: SQLite (better-sqlite3)
- **Caching**: Redis
- **Real-time**: Socket.io
- **Authentication**: JWT + bcrypt
- **Validation**: Zod
- **Logging**: Winston
- **Metrics**: prom-client (Prometheus)
- **Testing**: Jest

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **State Management**: Zustand
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **PWA**: vite-plugin-pwa

### IoT Protocols
- **Zigbee**: zigbee-herdsman
- **Matter**: @project-chip/matter.js
- **MQTT**: mqtt

### AI/NLP
- **NLP**: node-nlp
- **AI Providers**: Ollama, OpenAI, Claude, Gemini

### DevOps & Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Web Server**: Nginx (for frontend)

## Backend Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│        Presentation Layer           │
│  (API Routes, WebSocket, Metrics)   │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│         Application Layer           │
│  (Business Logic, Services)         │
│  • Auth Service                     │
│  • Device Manager                   │
│  • Automation Engine                │
│  • AI Service                       │
│  • Voice Control                    │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│          Domain Layer               │
│  (Core Entities, Protocols)         │
│  • Device                           │
│  • Automation                       │
│  • User                             │
│  • Scene                            │
└─────────────────────────────────────┘
                  │
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│  (Database, External Services)      │
│  • SQLite Repository                │
│  • Protocol Handlers                │
│  • AI Provider Clients              │
└─────────────────────────────────────┘
```

### Core Modules

#### 1. Authentication & Authorization (RBAC)
- JWT-based authentication
- Three roles: Admin, User, Guest
- Middleware-based authorization
- Password hashing with bcrypt
- Token refresh mechanism

#### 2. Device Manager
- Multi-protocol device abstraction
- Device state management
- Real-time state synchronization
- Device history tracking
- Protocol-agnostic control interface

#### 3. Automation Engine
- Rule-based automation
- Trigger conditions: time, device state, sensor values
- Action execution: device control, scenes, notifications
- Natural language automation creation via AI
- Automation execution logging

#### 4. AI Service
- Multi-provider support (Ollama, OpenAI, Claude, Gemini)
- Conversation management
- Pattern analysis
- Device control via natural language
- Suggestion generation

#### 5. Voice Control
- Speech-to-text processing
- Natural language command parsing
- Voice command history
- Multi-language support

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── common/           # Reusable UI components
│   ├── devices/          # Device-related components
│   ├── automations/      # Automation components
│   └── layouts/          # Layout components
├── pages/
│   ├── Dashboard.jsx     # Main dashboard
│   ├── Devices.jsx       # Device management
│   ├── Automations.jsx   # Automation management
│   ├── AI.jsx            # AI assistant
│   └── Settings.jsx      # Settings
├── services/
│   ├── api.js            # REST API client
│   └── socket.js         # WebSocket client
├── stores/
│   ├── authStore.js      # Authentication state
│   ├── deviceStore.js    # Device state
│   └── automationStore.js # Automation state
└── styles/
    └── global.css        # Global styles
```

### State Management

- **Zustand** for global state
- Separate stores for different domains
- Real-time updates via WebSocket
- Optimistic UI updates
- Persistent authentication state

## Database Design

### Schema Overview

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Devices Table
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  protocol TEXT NOT NULL,
  ieee_address TEXT UNIQUE,
  model TEXT,
  manufacturer TEXT,
  room_id TEXT,
  online BOOLEAN DEFAULT 0,
  state TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);
```

#### Automations Table
```sql
CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT 1,
  triggers TEXT NOT NULL,
  conditions TEXT,
  actions TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Indexes
- Performance-optimized queries
- Composite indexes on frequently queried columns
- Unique constraints for data integrity

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP methods: GET, POST, PATCH, DELETE
- Standard HTTP status codes
- JSON request/response format

### Authentication
```
Authorization: Bearer <JWT_TOKEN>
```

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Pagination
```
GET /api/devices?page=1&limit=20&sortBy=name&sortOrder=asc
```

## Security Architecture

### Defense in Depth

1. **Network Security**
   - HTTPS/TLS encryption
   - CORS configuration
   - Rate limiting

2. **Application Security**
   - Input validation (Zod)
   - SQL injection prevention
   - XSS protection (Helmet)
   - CSRF protection

3. **Authentication & Authorization**
   - JWT tokens
   - Password hashing (bcrypt)
   - Role-based access control
   - Token expiration

4. **Data Security**
   - Environment variable management
   - Secrets management
   - Database encryption (optional)

5. **Container Security**
   - Non-root users
   - Minimal base images
   - Security scanning

## Monitoring & Observability

### Logging
- **Winston** for structured logging
- Log levels: error, warn, info, http, debug
- Daily log rotation
- Separate log files by level
- JSON format for machine parsing

### Metrics (Prometheus)
- HTTP request metrics
- Device statistics
- Automation execution metrics
- AI request metrics
- Voice command metrics
- System metrics (CPU, memory)

### Visualization (Grafana)
- Real-time dashboards
- 11 visualization panels
- Custom metrics queries
- Alerting (configurable)

### Health Checks
- `/api/health` - Application health
- `/metrics` - Prometheus metrics
- Container health checks

## Deployment Architecture

### Docker Containers

```
┌─────────────────────────────────────────┐
│         Load Balancer / Nginx           │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────┴──────┐    ┌──────┴───────┐
│   Frontend   │    │   Backend    │
│  Container   │    │  Container   │
│  (Nginx)     │    │  (Node.js)   │
└──────────────┘    └──────┬───────┘
                           │
                  ┌────────┴────────┐
                  │                 │
          ┌───────┴──────┐  ┌──────┴────────┐
          │    Redis     │  │  Prometheus   │
          │  Container   │  │  Container    │
          └──────────────┘  └───────┬───────┘
                                    │
                            ┌───────┴───────┐
                            │    Grafana    │
                            │   Container   │
                            └───────────────┘
```

### Scaling Considerations

1. **Horizontal Scaling**
   - Stateless backend containers
   - Load balancing
   - Session storage in Redis

2. **Vertical Scaling**
   - Resource limits in Docker
   - CPU/Memory allocation

3. **Database Scaling**
   - Read replicas (future)
   - Database sharding (future)
   - Connection pooling

### High Availability

- Container restart policies
- Health check monitoring
- Automated backups
- Disaster recovery procedures
- Multi-zone deployment (recommended)

## Performance Optimization

1. **Caching Strategy**
   - Redis for frequently accessed data
   - HTTP caching headers
   - Static asset caching

2. **Database Optimization**
   - Prepared statements
   - Index optimization
   - Query optimization
   - Connection pooling

3. **Frontend Optimization**
   - Code splitting
   - Lazy loading
   - Asset minification
   - PWA caching

4. **API Optimization**
   - Pagination
   - Field filtering
   - Compression (gzip)
   - Rate limiting

## Future Enhancements

1. **Scalability**
   - Migrate to PostgreSQL for larger deployments
   - Implement message queue (RabbitMQ/Kafka)
   - Add caching layer (Redis Cluster)

2. **Features**
   - Mobile apps (React Native)
   - Scene scheduling
   - Energy monitoring
   - Multi-user households

3. **Integrations**
   - Third-party services (IFTTT, Alexa, Google Home)
   - Additional IoT protocols
   - Weather service integration

4. **DevOps**
   - Kubernetes deployment
   - Auto-scaling
   - Blue-green deployments
   - Canary releases
