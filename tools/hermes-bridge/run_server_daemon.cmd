@echo off
set PORT=3000
set NODE_ENV=production
set HERMES_ENABLED=true
cd /d "C:\Users\petit\Documents\GitHub\OpenNova-Finance"
"C:\Program Files\nodejs\node.exe" "tools\hermes-bridge\server-daemon.mjs" >> "tools\hermes-bridge\logs\server.out.log" 2>> "tools\hermes-bridge\logs\server.err.log"
