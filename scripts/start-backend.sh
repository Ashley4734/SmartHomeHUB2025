#!/bin/bash
# Backend starter script for use with nohup/daemon
cd "$(dirname "$0")/../backend"
exec node src/index.js
