# Quick Test - WhatsApp Chat Features
# Run this script to start all services for testing

Write-Host "`n=== WHATSAPP CHAT - QUICK TEST GUIDE ===" -ForegroundColor Green

Write-Host "`n🚀 STEP 1: Start Backend" -ForegroundColor Cyan
Write-Host "In Terminal 1:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  uvicorn app.main:app --reload" -ForegroundColor White
Write-Host ""

Write-Host "🌐 STEP 2: Start Web App" -ForegroundColor Cyan
Write-Host "In Terminal 2:" -ForegroundColor Yellow
Write-Host "  cd savitara-web" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  Open: http://localhost:3000/chat" -ForegroundColor White
Write-Host ""

Write-Host "📱 STEP 3: Start Mobile App" -ForegroundColor Cyan
Write-Host "In Terminal 3:" -ForegroundColor Yellow
Write-Host "  cd savitara-app" -ForegroundColor White
Write-Host "  npx expo start" -ForegroundColor White
Write-Host "  Scan QR or press 'a' for Android" -ForegroundColor White
Write-Host ""

Write-Host "✅ NEW FEATURES TO TEST:" -ForegroundColor Green
Write-Host ""
Write-Host "WEB - Open http://localhost:3000/chat :" -ForegroundColor Yellow
Write-Host "  1. Search conversations - type in search bar at top" -ForegroundColor White
Write-Host "  2. Context menu - right-click any conversation" -ForegroundColor White
Write-Host "  3. Pin conversation - see 📌 icon, moves to top" -ForegroundColor White
Write-Host "  4. Voice message - click mic button, record, send" -ForegroundColor White
Write-Host "  5. Forward message - right-click message, select Forward" -ForegroundColor White
Write-Host "  6. Unread badge - send message from another account" -ForegroundColor White
Write-Host ""

Write-Host "MOBILE (React Native App):" -ForegroundColor Yellow
Write-Host "  1. Search conversations - search bar at top" -ForegroundColor White
Write-Host "  2. Long-press menu - long-press any conversation" -ForegroundColor White
Write-Host "  3. Pull to refresh - swipe down on conversation list" -ForegroundColor White
Write-Host "  4. Unread badge - badge shows count" -ForegroundColor White
Write-Host "  5. Pin conversation - see 📌 emoji" -ForegroundColor White
Write-Host "  6. Mute conversation - see 🔕 emoji" -ForegroundColor White
Write-Host ""

Write-Host "📋 FULL TEST CHECKLIST:" -ForegroundColor Cyan
Write-Host "See WHATSAPP_CHAT_IMPLEMENTATION_COMPLETE.md - Section 'Phase 8: Integration Testing'" -ForegroundColor White
Write-Host ""

Write-Host "🐛 TROUBLESHOOTING:" -ForegroundColor Cyan
Write-Host "  - WebSocket not connecting? Check backend is running on port 8000" -ForegroundColor White
Write-Host "  - CORS errors? Verify ALLOWED_ORIGINS in backend/.env includes frontend URL" -ForegroundColor White
Write-Host "  - 401 Unauthorized? Login again to get fresh JWT token" -ForegroundColor White
Write-Host "  - Voice recorder not showing? Check browser supports MediaRecorder" -ForegroundColor White
Write-Host "    (Chrome 47+, Firefox 25+, Safari 14.1+)" -ForegroundColor White
Write-Host ""

Write-Host "📦 INSTALLED FEATURES:" -ForegroundColor Green
Write-Host "  ✅ Search conversations (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Context menus (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Pin/Archive/Mute/Delete (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Unread badges (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Voice messages (web)" -ForegroundColor White
Write-Host "  ✅ Message forwarding (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Conversation settings (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Real-time typing indicators (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Read receipts (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Message reactions (web + mobile)" -ForegroundColor White
Write-Host "  ✅ Offline message queue (mobile)" -ForegroundColor White
Write-Host ""

Write-Host "🎉 ALL PHASES COMPLETE!" -ForegroundColor Green
Write-Host "Ready for testing and deployment!" -ForegroundColor Green
Write-Host ""
