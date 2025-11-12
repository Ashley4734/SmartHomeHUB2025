#!/usr/bin/env bash
#
# Backup Script for SmartHomeHUB
# Creates backups of database and configuration files
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${1:-/opt/smarthomehub/backups}"
PROJECT_DIR="${2:-/opt/smarthomehub}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

log "========================================="
log "Starting backup process"
log "========================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Files to backup
FILES_TO_BACKUP=(
    "backend/smarthome.db"
    "backend/.env"
    "backend/package.json"
    "backend/package-lock.json"
    "docker-compose.yml"
    "docker-compose.staging.yml"
    "docker-compose.production.yml"
)

# Create temporary directory for backup
TEMP_DIR=$(mktemp -d)
log "Created temporary directory: $TEMP_DIR"

# Copy files to temp directory
for file in "${FILES_TO_BACKUP[@]}"; do
    if [[ -f "$PROJECT_DIR/$file" ]]; then
        mkdir -p "$TEMP_DIR/$(dirname "$file")"
        cp "$PROJECT_DIR/$file" "$TEMP_DIR/$file"
        log "Backed up: $file"
    else
        log "Skipped (not found): $file"
    fi
done

# Create tar archive
log "Creating archive: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .

# Cleanup temp directory
rm -rf "$TEMP_DIR"

# Verify backup
if [[ -f "$BACKUP_FILE" ]]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup created successfully: $BACKUP_FILE ($SIZE)"
else
    error "Backup failed to create"
fi

# Cleanup old backups (keep last 30)
log "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +31 | xargs -r rm --

log "========================================="
log "Backup completed successfully!"
log "========================================="
