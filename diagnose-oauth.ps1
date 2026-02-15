# Savitara - Complete Google OAuth Fix and Test Script
# This script will diagnose and help fix all OAuth related issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Savitara Google OAuth Diagnostic" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test counter
$issues = @()
$fixes = @()

# 1. Check Backend Env
Write-Host "1. Checking Backend Environment..." -ForegroundColor Yellow
$backendEnv = Get-Content "backend\.env" -Raw

if ($backendEnv -match "GOOGLE_CLIENT_ID=([^\r\n]+)") {
    $clientId = $matches[1]
    Write-Host "   Google Client ID: $clientId" -ForegroundColor Green
}
else {
    $issues += "Google Client ID not found in backend .env"
    Write-Host "   ERROR: Google Client ID not found" -ForegroundColor Red
}

if ($backendEnv -match "GOOGLE_CLIENT_SECRET=([^\r\n]+)" -and $matches[1] -ne "") {
    Write-Host "   Google Client Secret: *** (configured)" -ForegroundColor Green
}
else {
    Write-Host "   WARNING: Google Client Secret is empty" -ForegroundColor Yellow
    Write-Host "   NOTE: For Firebase Auth, this may not be required" -ForegroundColor Gray
}

# 2. Check Frontend Env
Write-Host "`n2. Checking Frontend Environment..." -ForegroundColor Yellow
if (Test-Path "savitara-web\.env") {
    $frontendEnv = Get-Content "savitara-web\.env" -Raw
    
    if ($frontendEnv -match "VITE_FIREBASE_API_KEY=([^\r\n]+)") {
        Write-Host "   Firebase API Key: *** (configured)" -ForegroundColor Green
    }
    else {
        $issues += "Firebase API Key not found in savitara-web .env"
        Write-Host "   ERROR: Firebase API Key not found" -ForegroundColor Red
    }
    
    if ($frontendEnv -match "VITE_FIREBASE_PROJECT_ID=([^\r\n]+)") {
        $projectId = $matches[1]
        Write-Host "   Firebase Project ID: $projectId" -ForegroundColor Green
    }
    else {
        $issues += "Firebase Project ID not found"
        Write-Host "   ERROR: Firebase Project ID not found" -ForegroundColor Red
    }
    
    if ($frontendEnv -match "VITE_API_BASE_URL=([^\r\n]+)") {
        $apiUrl = $matches[1]
        Write-Host "   API Base URL: $apiUrl" -ForegroundColor Green
    }
}

# 3. Test Backend Connectivity
Write-Host "`n3. Testing Backend Connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "   Backend: ONLINE" -ForegroundColor Green
}
catch {
    $issues += "Backend not reachable at http://localhost:8000"
    Write-Host "   ERROR: Backend not reachable" -ForegroundColor Red
}

# 4. Test Google OAuth Endpoint
Write-Host "`n4. Testing Google OAuth Endpoint..." -ForegroundColor Yellow
try {
    $testPayload = @{
        id_token = "test_token"
        role = "grihasta"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/auth/google" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testPayload `
        -UseBasicParsing `
        -TimeoutSec 3 2>&1
        
    if ($response.StatusCode -eq 401 -or $response -like "*401*") {
        Write-Host "   Endpoint exists (401 for test token is expected)" -ForegroundColor Green
    }
    elseif ($response.StatusCode -eq 422 -or $response -like "*422*") {
        Write-Host "   Endpoint exists (validation error is expected)" -ForegroundColor Green
    }
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401 -or $_.Exception.Response.StatusCode.value__ -eq 422) {
        Write-Host "   Endpoint exists and responding" -ForegroundColor Green
    }
    else {
        Write-Host "   WARNING: Unexpected response from endpoint" -ForegroundColor Yellow
    }
}

# 5. Check Frontend is Running
Write-Host "`n5. Testing Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3
    Write-Host "   Frontend: ONLINE" -ForegroundColor Green
}
catch {
    $issues += "Frontend not reachable at http://localhost:3000"
    Write-Host "   ERROR: Frontend not reachable" -ForegroundColor Red
}

# 6. Check if there are users in database
Write-Host "`n6. Checking Database..." -ForegroundColor Yellow
Write-Host "   Run this to check users: python backend\scripts\check_db_data.py" -ForegroundColor Gray

# Report
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($issues.Count -eq 0) {
    Write-Host "No critical issues found!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If Google Sign-In still doesn't work, check these:" -ForegroundColor Yellow
    Write-Host "1. Open http://localhost:3000 in your browser" -ForegroundColor White
    Write-Host "2. Open Developer Tools (F12)" -ForegroundColor White
    Write-Host "3. Go to Console tab" -ForegroundColor White
    Write-Host "4. Click 'Sign in with Google'" -ForegroundColor White
    Write-Host "5. Look for errors in console" -ForegroundColor White
    Write-Host ""
    Write-Host "Common Firebase Errors:" -ForegroundColor Yellow
    Write-Host "- auth/operation-not-allowed: Enable Google Sign-In in Firebase Console" -ForegroundColor White
    Write-Host "- auth/unauthorized-domain: Add localhost to authorized domains" -ForegroundColor White
    Write-Host "- auth/invalid-api-key: Check Firebase API key in .env" -ForegroundColor White
    Write-Host ""
    Write-Host "Firebase Console: https://console.firebase.google.com/project/savitara-90a1c" -ForegroundColor Cyan
}
else {
    Write-Host "Issues Found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS TO TEST GOOGLE LOGIN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser to: http://localhost:3000" -ForegroundColor White
Write-Host "2. Press F12 to open Developer Tools" -ForegroundColor White
Write-Host "3. Click 'Sign in with Google' button" -ForegroundColor White
Write-Host "4. Watch for errors in Console tab" -ForegroundColor White
Write-Host "5. Watch Network tab for failed requests" -ForegroundColor White
Write-Host ""
Write-Host "Share any error messages for further diagnosis." -ForegroundColor Yellow
Write-Host ""
