#!/bin/bash

echo "Stopping existing backend process on port 8000..."

# Find and kill process using port 8000
PID=$(netstat -ano | grep :8000 | awk '{print $5}' | head -n 1)

if [ ! -z "$PID" ]; then
    echo "Found process $PID, killing it..."
    cmd.exe /c "taskkill /PID $PID /F" 2>/dev/null
    sleep 1
else
    echo "No process found on port 8000"
fi

echo "Starting backend..."
python -m uvicorn app.main:app --reload
