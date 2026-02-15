# Savitara API - Comprehensive Test Suite
# Tests all major API endpoints without authentication

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Savitara API Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000/api/v1"
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Body = $null,
        [int[]]$ExpectedCodes = @(200, 201)
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 5
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        
        if ($ExpectedCodes -contains $response.StatusCode) {
            Write-Host " PASS ($($response.StatusCode))" -ForegroundColor Green
            $script:passed++
            return $true
        }
        else {
            Write-Host " FAIL (Expected one of $ExpectedCodes, got $($response.StatusCode))" -ForegroundColor Red
            $script:failed++
            return $false
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($ExpectedCodes -contains $statusCode) {
            Write-Host " PASS ($statusCode - expected)" -ForegroundColor Green
            $script:passed++
            return $true
        }
        else {
            Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
            $script:failed++
            return $false
        }
    }
}

Write-Host "--- Public Endpoints (No Auth Required) ---" -ForegroundColor Yellow
Write-Host ""

# Health Check
Test-Endpoint -Name "Health Check" -Method GET -Url "http://localhost:8000/health"

# Content Endpoints
Test-Endpoint -Name "Get Testimonials" -Method GET -Url "$baseUrl/content/testimonials"

# User Endpoints (should fail with 401)
Test-Endpoint -Name "Get Current User (should fail)" -Method GET -Url "$baseUrl/auth/me" -ExpectedCodes @(401)

Write-Host "`n--- Authentication Endpoints ---" -ForegroundColor Yellow
Write-Host ""

# Test Google OAuth endpoint (should fail with invalid token)
Test-Endpoint -Name "Google OAuth (invalid token)" `
    -Method POST `
    -Url "$baseUrl/auth/google" `
    -Body @{id_token="test"; role="grihasta"} `
    -ExpectedCodes @(401, 422)

# Test email login (should fail with no user)
Test-Endpoint -Name "Email Login (no user)" `
    -Method POST `
    -Url "$baseUrl/auth/login" `
    -Body @{email="test@example.com"; password="password123"} `
    -ExpectedCodes @(401)

Write-Host "`n--- Public User/Acharya Endpoints ---" -ForegroundColor Yellow
Write-Host ""

# List Acharyas (public endpoint)
Test-Endpoint -Name "List Acharyas" -Method GET -Url "$baseUrl/users/acharyas"

Write-Host "`n--- Documentation Endpoints ---" -ForegroundColor Yellow
Write-Host ""

# API Docs
Test-Endpoint -Name "API Documentation" -Method GET -Url "http://localhost:8000/docs"
Test-Endpoint -Name "OpenAPI JSON" -Method GET -Url "http://localhost:8000/openapi.json"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All tests passed! API is working correctly." -ForegroundColor Green
}
else {
    Write-Host "Some tests failed. Check the output above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MANUAL TESTING GUIDE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test the complete user journey:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SIGN UP / SIGN IN" -ForegroundColor White
Write-Host "   a. Go to http://localhost:3000" -ForegroundColor Gray
Write-Host "   b. Click 'Sign in with Google'" -ForegroundColor Gray
Write-Host "   c. Choose Grihasta or Acharya role" -ForegroundColor Gray
Write-Host "   d. Complete the sign-in flow" -ForegroundColor Gray
Write-Host ""
Write-Host "2. COMPLETE ONBOARDING" -ForegroundColor White
Write-Host "   a. Fill in your profile information" -ForegroundColor Gray
Write-Host "   b. Add preferences (Grihasta) or skills/services (Acharya)" -ForegroundColor Gray
Write-Host "   c. Complete the onboarding wizard" -ForegroundColor Gray
Write-Host ""
Write-Host "3. GRIHASTA JOURNEY" -ForegroundColor White
Write-Host "   a. Browse available Acharyas" -ForegroundColor Gray
Write-Host "   b. View Acharya profiles and reviews" -ForegroundColor Gray
Write-Host "   c. Create a booking" -ForegroundColor Gray
Write-Host "   d. Make payment (use Razorpay test mode)" -ForegroundColor Gray
Write-Host "   e. View your bookings" -ForegroundColor Gray
Write-Host "   f. Submit review after consultation" -ForegroundColor Gray
Write-Host ""
Write-Host "4. ACHARYA JOURNEY" -ForegroundColor White
Write-Host "   a. Set up your profile and services" -ForegroundColor Gray
Write-Host "   b. Set availability and pricing" -ForegroundColor Gray
Write-Host "   c. Receive booking notifications" -ForegroundColor Gray
Write-Host "   d. Accept/reject bookings" -ForegroundColor Gray
Write-Host "   e. Mark attendance and complete consultations" -ForegroundColor Gray
Write-Host "   f. View earnings and analytics" -ForegroundColor Gray
Write-Host ""
Write-Host "5. ADMIN DASHBOARD" -ForegroundColor White
Write-Host "   a. Go to http://localhost:3001" -ForegroundColor Gray
Write-Host "   b. Log in with admin credentials" -ForegroundColor Gray
Write-Host "   c. View all users, bookings, and analytics" -ForegroundColor Gray
Write-Host "   d. Verify Acharya KYC documents" -ForegroundColor Gray
Write-Host "   e. Manage content and configurations" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TROUBLESHOOTING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Google Sign-In Not Working:" -ForegroundColor Yellow
Write-Host "1. Check browser console (F12) for Firebase errors" -ForegroundColor White
Write-Host "2. Verify Firebase Google Sign-In is enabled:" -ForegroundColor White
Write-Host "   https://console.firebase.google.com/project/savitara-90a1c/authentication/providers" -ForegroundColor Cyan
Write-Host "3. Ensure 'localhost' is in authorized domains" -ForegroundColor White
Write-Host "4. Check backend logs for token verification errors" -ForegroundColor White
Write-Host ""
Write-Host "Payment Not Working:" -ForegroundColor Yellow
Write-Host "1. Verify Razorpay test keys in backend\.env" -ForegroundColor White
Write-Host "2. Use Razorpay test card: 4111 1111 1111 1111" -ForegroundColor White
Write-Host "3. Check backend logs for payment webhook errors" -ForegroundColor White
Write-Host ""
Write-Host "Backend Connection Failed:" -ForegroundColor Yellow
Write-Host "1. Ensure backend is running on port 8000" -ForegroundColor White
Write-Host "2. Check CORS settings in backend\.env" -ForegroundColor White
Write-Host "3. Verify API URL in frontend .env files" -ForegroundColor White
Write-Host ""

