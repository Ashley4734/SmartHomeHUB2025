#!/usr/bin/env bash
#
# Deployment Script for SmartHomeHUB
# Usage: ./deploy.sh [staging|production]
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-staging}"
PROJECT_DIR="/opt/smarthomehub"
BACKUP_DIR="/opt/smarthomehub/backups"
LOG_FILE="/var/log/smarthomehub/deploy-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'."
fi

log "========================================="
log "Starting deployment to $ENVIRONMENT"
log "========================================="

# Step 1: Pre-deployment checks
log "Step 1: Pre-deployment checks..."

if [[ ! -d "$PROJECT_DIR" ]]; then
    error "Project directory not found: $PROJECT_DIR"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running"
fi

# Step 2: Create backup
log "Step 2: Creating backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"

if [[ -f "$PROJECT_DIR/backend/smarthome.db" ]]; then
    tar -czf "$BACKUP_FILE" -C "$PROJECT_DIR" backend/smarthome.db
    log "Backup created: $BACKUP_FILE"
else
    warn "No database file found to backup"
fi

# Step 3: Pull latest code
log "Step 3: Pulling latest code..."
cd "$PROJECT_DIR"
git fetch origin
if [[ "$ENVIRONMENT" == "production" ]]; then
    git checkout main
    git pull origin main
else
    git checkout develop
    git pull origin develop
fi

# Step 4: Build and restart services
log "Step 4: Building and restarting services..."
docker-compose -f docker-compose.yml -f "docker-compose.$ENVIRONMENT.yml" build
docker-compose -f docker-compose.yml -f "docker-compose.$ENVIRONMENT.yml" up -d

# Step 5: Run database migrations (if any)
log "Step 5: Running database migrations..."
# Add migration commands here if needed

# Step 6: Health check
log "Step 6: Performing health check..."
sleep 5  # Wait for services to start

MAX_RETRIES=30
RETRY_COUNT=0
HEALTH_URL="http://localhost:3000/api/health"

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    if curl -f -s "$HEALTH_URL" > /dev/null; then
        log "Health check passed!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    warn "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed. Retrying..."
    sleep 2
done

if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
    error "Health check failed after $MAX_RETRIES attempts"
fi

# Step 7: Cleanup old backups (keep last 30)
log "Step 7: Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +31 | xargs -r rm --

log "========================================="
log "Deployment to $ENVIRONMENT completed successfully!"
log "========================================="
