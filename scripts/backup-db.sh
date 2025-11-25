#!/bin/bash

# ============================================================================
# VBallAgregator Database Backup Script
# ============================================================================
# This script creates a backup of the PostgreSQL database
# Usage: ./scripts/backup-db.sh
# ============================================================================

set -e

# Configuration
BACKUP_DIR="/opt/vball-aggregator/backups"
DB_CONTAINER="vball_db_prod"
DB_NAME="${DB_NAME:-vball_prod}"
DB_USER="${DB_USER:-vball_app}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Functions
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check if Docker is running
    if ! docker ps > /dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if database container exists
    if ! docker ps -a | grep -q "$DB_CONTAINER"; then
        log_error "Database container '$DB_CONTAINER' not found"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

create_backup() {
    log_info "Creating database backup..."
    log_info "Database: $DB_NAME"
    log_info "Backup file: $BACKUP_FILE_GZ"
    
    # Create backup
    if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
        log_info "Database dump completed"
    else
        log_error "Failed to create database dump"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
    
    # Compress backup
    log_info "Compressing backup..."
    if gzip "$BACKUP_FILE"; then
        log_info "Backup compressed successfully"
    else
        log_error "Failed to compress backup"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    log_info "Backup size: $BACKUP_SIZE"
}

verify_backup() {
    log_info "Verifying backup..."
    
    if [ ! -f "$BACKUP_FILE_GZ" ]; then
        log_error "Backup file not found: $BACKUP_FILE_GZ"
        exit 1
    fi
    
    # Check if file is valid gzip
    if gzip -t "$BACKUP_FILE_GZ" 2>/dev/null; then
        log_info "Backup verification passed"
    else
        log_error "Backup file is corrupted"
        rm -f "$BACKUP_FILE_GZ"
        exit 1
    fi
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Find and delete old backups
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
    log_info "Remaining backups: $BACKUP_COUNT"
}

send_notification() {
    local status=$1
    local message=$2
    
    # You can add notification logic here (email, Slack, etc.)
    # For now, just log it
    log_info "Backup notification: $status - $message"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "Starting database backup process..."
    log_info "Timestamp: $TIMESTAMP"
    
    check_prerequisites
    create_backup
    verify_backup
    cleanup_old_backups
    
    log_info "Database backup completed successfully!"
    log_info "Backup file: $BACKUP_FILE_GZ"
    
    send_notification "SUCCESS" "Database backup completed: $BACKUP_FILE_GZ"
}

# Error handling
trap 'log_error "Backup failed"; send_notification "FAILED" "Database backup failed"; exit 1' ERR

# Run main function
main "$@"
