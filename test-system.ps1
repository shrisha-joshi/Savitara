# Savitara Platform - Comprehensive System Test Script
# This script tests all components and identifies issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Savitara Platform - System Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0
$SuccessCount = 0

function Test-Service {
    param(
        [string]$Name,
        [string]$Url
    )
    
    Write-Host "Testing $Name..." -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404) {
            Write-Host " OK" -ForegroundColor Green
            $script:SuccessCount++
            return $true
        }
    }
    catch {
        if ($_.Exception.Message -like "*Connection refused*" -or $_.Exception.Message -like "*Unable to connect*" -or $_.Exception.Message -like "*failed to connect*") {
            Write-Host " NOT RUNNING" -ForegroundColor Red
            $script:ErrorCount++
            return $false
        }
        elseif ($_.Exception.Response.StatusCode.value__ -eq 401 -or $_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Host " RUNNING" -ForegroundColor Green
            $script:SuccessCount++
            return $true
        }
        else {
            Write-Host " WARNING" -ForegroundColor Yellow
            $script:WarningCount++
            return $false
        }
    }
    return $false
}

function Test-MongoDBConnection {
    Write-Host "Testing MongoDB Connection..." -NoNewline
    try {
        $envContent = Get-Content "backend\.env" -Raw
        if ($envContent -match "MONGODB_URL=mongodb") {
            Write-Host " Config Found" -ForegroundColor Green
            $script:SuccessCount++
            return $true
        }
        else {
            Write-Host " Not Configured" -ForegroundColor Red
            $script:ErrorCount++
            return $false
        }
    }
    catch {
        Write-Host " Error checking config" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

function Test-EnvironmentFile {
    param(
        [string]$Path,
        [string]$Name
    )
    
    Write-Host "Checking $Name .env file..." -NoNewline
    if (Test-Path $Path) {
        Write-Host " EXISTS" -ForegroundColor Green
        $script:SuccessCount++
        return $true
    }
    else {
        Write-Host " NOT FOUND" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

Write-Host "`n--- ENVIRONMENT FILES ---" -ForegroundColor Cyan
Test-EnvironmentFile "backend\.env" "Backend"
Test-EnvironmentFile "savitara-web\.env" "Savitara Web"
Test-EnvironmentFile "admin-savitara-web\.env" "Admin Web"

Write-Host "`n--- DATABASE CONNECTIVITY ---" -ForegroundColor Cyan
Test-MongoDBConnection

Write-Host "`n--- SERVICE STATUS ---" -ForegroundColor Cyan
$backendRunning = Test-Service "Backend API" "http://localhost:8000/health"
$webRunning = Test-Service "Savitara Web" "http://localhost:3000"
$adminWebRunning = Test-Service "Admin Web" "http://localhost:3001"

Write-Host "`n--- BACKEND ENDPOINTS ---" -ForegroundColor Cyan
if ($backendRunning) {
    Test-Service "  Auth Endpoint" "http://localhost:8000/api/v1/auth/me"
    Test-Service "  Docs Endpoint" "http://localhost:8000/docs"
}
else {
    Write-Host "  Skipped (Backend not running)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Success: $SuccessCount" -ForegroundColor Green
Write-Host "Warnings: $WarningCount" -ForegroundColor Yellow
Write-Host "Errors: $ErrorCount" -ForegroundColor Red
Write-Host ""

if ($ErrorCount -gt 0) {
    Write-Host "CRITICAL ISSUES FOUND!" -ForegroundColor Red
}
elseif ($WarningCount -gt 0) {
    Write-Host "Some warnings detected." -ForegroundColor Yellow
}
else {
    Write-Host "All systems operational!" -ForegroundColor Green
}

Write-Host ""
