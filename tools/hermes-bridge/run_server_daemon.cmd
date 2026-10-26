@echo off
set PORT=3000
set NODE_ENV=production
set HERMES_ENABLED=true
cd /d "C:\Users\petit\Documents\GitHub\OpenNova-Finance"
"C:\Program Files\nodejs\node.exe" "tools\hermes-bridge\server-daemon.mjs"
