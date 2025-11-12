# Smart Home Hub - Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Database Management](#database-management)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### Required Software
- **Node.js**: v20.x or later
- **Docker**: v24.0 or later
- **Docker Compose**: v2.20 or later
- **Git**: v2.30 or later

### Optional Software
- **Redis**: v7.0 or later (for caching)
- **Zigbee Adapter**: For Zigbee device support
- **Matter-compatible devices**: For Matter protocol support

### System Requirements

#### Minimum (Development)
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free space

#### Recommended (Production)
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB free space (SSD recommended)
- Network: Stable internet connection

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/SmartHomeHUB2025.git
cd SmartHomeHUB2025
```

### 2. Configure Environment Variables

#### Backend Configuration

Copy the example environment file:
```bash
cd backend
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Required Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=3000
HOST=0.0.0.0

# Database
DB_PATH=./data/smart-home.db

# CORS (update with your frontend URL)
CORS_ORIGIN=http://localhost:5173

# AI Providers (configure at least one)
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434

# Optional: OpenAI
OPENAI_ENABLED=false
OPENAI_API_KEY=sk-...

# IoT Protocols
ZIGBEE_ENABLED=false
ZIGBEE_PORT=/dev/ttyUSB0

MATTER_ENABLED=false
```

### 3. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend/web
npm install
```

## Local Development

### Option 1: Direct Execution

#### Start Backend
```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3000`

#### Start Frontend
```bash
cd frontend/web
npm run dev
```

The frontend will start on `http://localhost:5173`

### Option 2: Docker Compose (Development)

```bash
# From project root
docker-compose -f docker-compose.dev.yml up
```

This starts:
- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`
- Redis on `localhost:6379`

### Running Tests

```bash
cd backend
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

### Database Setup

```bash
cd backend
npm run setup           # Initialize database
npm run migrate         # Run migrations
```

## Docker Deployment

### Building Images

#### Backend
```bash
cd backend
docker build -t smart-home-backend:latest .
```

#### Frontend
```bash
cd frontend/web
docker build -t smart-home-frontend:latest .
```

### Using Docker Compose

#### Production Deployment
```bash
# From project root
docker-compose up -d
```

This starts:
- Backend on `http://localhost:3000`
- Frontend on `http://localhost:8080`
- Prometheus on `http://localhost:9090`
- Grafana on `http://localhost:3001`
- Redis on `localhost:6379`

#### Check Services
```bash
docker-compose ps
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### Stop Services
```bash
docker-compose down
```

#### Stop and Remove Volumes
```bash
docker-compose down -v
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update environment variables in `.env.production`
- [ ] Set strong `JWT_SECRET`
- [ ] Configure production `CORS_ORIGIN`
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up backup automation
- [ ] Configure monitoring alerts
- [ ] Test disaster recovery procedures

### 1. Server Setup

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/SmartHomeHUB2025.git
cd SmartHomeHUB2025

# Set up environment
cp backend/.env.production backend/.env
# Edit backend/.env with production values

# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 3. SSL/TLS Configuration

#### Using Let's Encrypt with Nginx

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

#### Update Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 4. Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## Database Management

### Backup Database

#### Manual Backup
```bash
cd backend
npm run backup
```

#### List Backups
```bash
npm run backup:list
```

#### Restore from Backup
```bash
npm run backup:restore <backup-filename>
```

### Automated Backups

#### Using Cron
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/SmartHomeHUB2025/backend && npm run backup
```

#### Using Docker Compose
The backup cron is included in the container. Configure via environment variables:
```yaml
environment:
  - BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
  - MAX_BACKUPS=30
```

### Database Migrations

#### Run Migrations
```bash
cd backend
npm run migrate:up
```

#### Rollback Last Migration
```bash
npm run migrate:down
```

#### Check Migration Status
```bash
npm run migrate:status
```

#### Create New Migration
```bash
npm run migrate:create add-new-table
```

## Monitoring Setup

### Access Monitoring Tools

#### Prometheus
```
http://your-domain:9090
```

#### Grafana
```
http://your-domain:3001
Username: admin
Password: admin (change on first login)
```

### Configure Grafana

1. **Login** to Grafana
2. **Data Source** is auto-configured (Prometheus)
3. **Dashboard** is auto-loaded
4. **Customize** as needed

### Set Up Alerts

#### Prometheus Alerting Rules
Create `monitoring/prometheus/alerts.yml`:

```yaml
groups:
  - name: smart_home_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: DeviceOffline
        expr: smart_home_devices_total{status="offline"} > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Multiple devices offline"
```

### Log Management

#### View Logs
```bash
# Application logs
docker-compose logs -f backend

# Specific time range
docker-compose logs --since 1h backend

# Follow logs from multiple services
docker-compose logs -f backend frontend
```

#### Log Rotation
Logs are automatically rotated using Winston:
- Daily rotation
- Max 20MB per file
- Keeps last 14 days for application logs
- Keeps last 30 days for error logs

## Troubleshooting

### Common Issues

#### 1. Database Locked Error
```bash
# Check for zombie processes
ps aux | grep node

# Kill if necessary
kill -9 <PID>

# Remove lock file
rm backend/data/smart-home.db-wal
```

#### 2. Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### 3. Permission Denied (Zigbee/Serial Port)
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Set permissions
sudo chmod 666 /dev/ttyUSB0

# Reboot
sudo reboot
```

#### 4. Docker Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d

# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

#### 5. Frontend Build Fails
```bash
# Clear cache
cd frontend/web
rm -rf node_modules dist
npm install
npm run build
```

### Health Checks

#### Backend Health
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Database Connection
```bash
cd backend
node -e "const db = require('better-sqlite3')('./data/smart-home.db'); console.log(db.prepare('SELECT COUNT(*) FROM users').get());"
```

#### WebSocket Connection
```bash
# Install wscat
npm install -g wscat

# Test connection
wscat -c ws://localhost:3000
```

## Maintenance

### Regular Tasks

#### Daily
- Monitor logs for errors
- Check system resources
- Verify backups completed

#### Weekly
- Review monitoring dashboards
- Check disk space
- Update documentation

#### Monthly
- Update dependencies
- Security audit
- Performance review
- Backup restoration test

### Updating the Application

#### 1. Backup First
```bash
cd backend
npm run backup
```

#### 2. Pull Latest Changes
```bash
git pull origin main
```

#### 3. Update Dependencies
```bash
cd backend && npm install
cd ../frontend/web && npm install
```

#### 4. Run Migrations
```bash
cd backend
npm run migrate
```

#### 5. Restart Services
```bash
docker-compose down
docker-compose up -d
```

#### 6. Verify
```bash
docker-compose ps
docker-compose logs -f
curl http://localhost:3000/api/health
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Auto-fix
npm audit fix

# Manual review required
npm audit fix --force
```

### Database Maintenance

```bash
# Vacuum database (optimize)
sqlite3 backend/data/smart-home.db "VACUUM;"

# Analyze (update statistics)
sqlite3 backend/data/smart-home.db "ANALYZE;"

# Check integrity
sqlite3 backend/data/smart-home.db "PRAGMA integrity_check;"
```

### Performance Tuning

#### 1. Database
```sql
-- Enable WAL mode
PRAGMA journal_mode=WAL;

-- Increase cache size
PRAGMA cache_size=-64000; -- 64MB

-- Optimize queries
CREATE INDEX IF NOT EXISTS idx_devices_protocol ON devices(protocol);
```

#### 2. Redis Cache
```bash
# Monitor cache hit rate
redis-cli INFO stats | grep keyspace_hits

# Flush cache if needed
redis-cli FLUSHALL
```

#### 3. Docker Resources
```yaml
# In docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Support

### Getting Help
- **Documentation**: Check `/docs` folder
- **Issues**: GitHub Issues
- **Community**: Discord/Slack (if available)

### Reporting Issues
Include:
1. Environment details (OS, Node version, Docker version)
2. Error messages and logs
3. Steps to reproduce
4. Expected vs actual behavior

## Best Practices

1. **Always backup before updates**
2. **Test in staging before production**
3. **Monitor logs and metrics regularly**
4. **Keep dependencies updated**
5. **Use environment-specific configs**
6. **Enable automatic backups**
7. **Set up monitoring alerts**
8. **Document custom configurations**
9. **Regular security audits**
10. **Disaster recovery testing**
