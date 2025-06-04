# Test script for motea standalone Docker image (PowerShell)
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

param(
    [string]$ImageName = "motea",
    [string]$ContainerName = "motea-test",
    [int]$TestPort = 3001
)

# Configuration
$ErrorActionPreference = "Stop"

Write-Host "Testing motea standalone Docker image..." -ForegroundColor Blue

# Cleanup function
function Cleanup {
    Write-Host "Cleaning up test environment..." -ForegroundColor Yellow
    try {
        docker stop $ContainerName 2>$null
        docker rm $ContainerName 2>$null
        docker volume rm motea_test_data 2>$null
    } catch {
        # Ignore cleanup errors
    }
}

# Set up cleanup on exit
trap { Cleanup; exit }

# Check if image exists
$imageExists = docker images "$ImageName`:latest" --format "{{.Repository}}" | Select-String $ImageName
if (-not $imageExists) {
    Write-Host "Image $ImageName`:latest not found. Please build it first:" -ForegroundColor Red
    Write-Host "make build-standalone" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found image $ImageName`:latest" -ForegroundColor Green

# Start container
Write-Host "Starting test container..." -ForegroundColor Blue
docker run -d `
    --name $ContainerName `
    -p "$TestPort`:3000" `
    -v motea_test_data:/data `
    -e PASSWORD=test123 `
    -e LOG_LEVEL=debug `
    "$ImageName`:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start container" -ForegroundColor Red
    exit 1
}

# Wait for container to start
Write-Host "Waiting for container to start..." -ForegroundColor Blue
for ($i = 1; $i -le 60; $i++) {
    $status = docker ps --filter name=$ContainerName --format "{{.Status}}"
    if ($status -match "Up") {
        break
    }
    if ($i -eq 60) {
        Write-Host "Container failed to start within 60 seconds" -ForegroundColor Red
        docker logs $ContainerName
        exit 1
    }
    Start-Sleep 1
}

Write-Host "Container started successfully!" -ForegroundColor Green

# Wait for application to be ready
Write-Host "Waiting for application to be ready..." -ForegroundColor Blue
for ($i = 1; $i -le 120; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$TestPort/api/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "Application is ready!" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    
    if ($i -eq 120) {
        Write-Host "Application failed to start within 120 seconds" -ForegroundColor Red
        Write-Host "Container logs:" -ForegroundColor Yellow
        docker logs $ContainerName
        exit 1
    }
    Start-Sleep 1
}

# Test health endpoint
Write-Host "Testing health endpoint..." -ForegroundColor Blue
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:$TestPort/api/health" -UseBasicParsing
    $healthContent = $healthResponse.Content
    if ($healthContent -match '"status":"ok"') {
        Write-Host "Health check passed!" -ForegroundColor Green
    } else {
        Write-Host "Health check failed!" -ForegroundColor Red
        Write-Host "Response: $healthContent"
        exit 1
    }
} catch {
    Write-Host "Health check failed!" -ForegroundColor Red
    Write-Host "Error: $_"
    exit 1
}

# Test main page
Write-Host "Testing main page..." -ForegroundColor Blue
try {
    $mainResponse = Invoke-WebRequest -Uri "http://localhost:$TestPort/" -UseBasicParsing
    if ($mainResponse.StatusCode -eq 200) {
        Write-Host "Main page accessible!" -ForegroundColor Green
    } else {
        Write-Host "Main page not accessible!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Main page not accessible!" -ForegroundColor Red
    Write-Host "Error: $_"
    exit 1
}

# Test database connection
Write-Host "Testing database connection..." -ForegroundColor Blue
$dbCheck = docker exec $ContainerName su-exec postgres pg_isready 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Database connection successful!" -ForegroundColor Green
} else {
    Write-Host "Database connection failed!" -ForegroundColor Red
    exit 1
}

# Test database content
Write-Host "Testing database content..." -ForegroundColor Blue
$dbTest = docker exec $ContainerName su-exec postgres psql -U motea motea -t -c "SELECT 1;" 2>$null
if ($dbTest -match "1") {
    Write-Host "Database query successful!" -ForegroundColor Green
} else {
    Write-Host "Database query failed!" -ForegroundColor Red
    exit 1
}

Write-Host "All tests passed! 🎉" -ForegroundColor Green
Write-Host "Test summary:" -ForegroundColor Blue
Write-Host "  ✅ Container startup"
Write-Host "  ✅ Application health"
Write-Host "  ✅ Main page access"
Write-Host "  ✅ Database connection"
Write-Host "  ✅ Database queries"
Write-Host ""
Write-Host "Test application is running at: http://localhost:$TestPort" -ForegroundColor Yellow
Write-Host "Login with password: test123" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop the test container:" -ForegroundColor Blue
Write-Host "docker stop $ContainerName; docker rm $ContainerName" -ForegroundColor Yellow
