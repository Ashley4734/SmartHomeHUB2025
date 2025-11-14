#!/bin/bash
# Frontend starter script for use with nohup/daemon
cd "$(dirname "$0")/../frontend/web"
exec npm run dev
