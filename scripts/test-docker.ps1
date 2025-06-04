# Docker test script for motea (PowerShell version)
# waycaan mit, 2025

param(
    [string]$ImageName = "motea",
    [string]$Tag = "test",
    [string]$ContainerName = "motea-test",
    [int]$TestPort = 3001,
    [switch]$Help
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    Write-Host "Usage: .\test-docker.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -ImageName NAME       Image name (default: motea)"
    Write-Host "  -Tag TAG             Image tag (default: test)"
    Write-Host "  -ContainerName NAME  Container name (default: motea-test)"
    Write-Host "  -TestPort PORT       Test port (default: 3001)"
    Write-Host "  -Help                Show this help message"
}

# Show help if requested
if ($Help) {
    Show-Usage
    exit 0
}

# Cleanup function
function Cleanup {
    Write-Status "Cleaning up..."
    try {
        docker stop $ContainerName 2>$null
        docker rm $ContainerName 2>$null
    } catch {
        # Ignore errors during cleanup
    }
}

# Function to wait for service
function Wait-ForService {
    param(
        [string]$Url,
        [int]$Timeout = 30
    )
    
    Write-Status "Waiting for service at $Url..."
    
    for ($i = 0; $i -lt $Timeout; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Service is ready!"
                return $true
            }
        } catch {
            # Service not ready yet
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    
    Write-Host ""
    Write-Error "Service failed to start within $Timeout seconds"
    return $false
}

# Main test function
function Run-Tests {
    Write-Status "Starting Docker tests for ${ImageName}:${Tag}"
    
    try {
        # Test 1: Build image
        Write-Status "Test 1: Building Docker image..."
        Push-Location -Path "motea"
        
        $buildResult = docker build -t "${ImageName}:${Tag}" .
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Image built successfully"
        } else {
            Write-Error "Failed to build image"
            throw "Build failed"
        }
        
        Pop-Location
        
        # Test 2: Check image size
        Write-Status "Test 2: Checking image size..."
        $imageSize = docker images "${ImageName}:${Tag}" --format "{{.Size}}"
        Write-Status "Image size: $imageSize"
        
        # Test 3: Run container
        Write-Status "Test 3: Running container..."
        $runResult = docker run -d `
            --name $ContainerName `
            -p "${TestPort}:3000" `
            -e NODE_ENV=production `
            -e DISABLE_PASSWORD=true `
            "${ImageName}:${Tag}"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Container started successfully"
        } else {
            Write-Error "Failed to start container"
            throw "Container start failed"
        }
        
        # Test 4: Wait for service to be ready
        Write-Status "Test 4: Waiting for service to be ready..."
        if (Wait-ForService "http://localhost:${TestPort}/api/health" 60) {
            Write-Success "Service is responding"
        } else {
            Write-Error "Service failed to respond"
            docker logs $ContainerName
            throw "Service not responding"
        }
        
        # Test 5: Test health endpoint
        Write-Status "Test 5: Testing health endpoint..."
        try {
            $healthResponse = Invoke-RestMethod -Uri "http://localhost:${TestPort}/api/health" -TimeoutSec 10
            if ($healthResponse.status -eq "healthy" -or $healthResponse.status -eq "error") {
                Write-Success "Health endpoint is working"
                Write-Status "Health response: $($healthResponse | ConvertTo-Json -Compress)"
            } else {
                Write-Error "Unexpected health response: $($healthResponse | ConvertTo-Json -Compress)"
                throw "Health check failed"
            }
        } catch {
            Write-Error "Health endpoint test failed: $_"
            throw "Health endpoint failed"
        }
        
        # Test 6: Test main page
        Write-Status "Test 6: Testing main page..."
        try {
            $mainPageResponse = Invoke-WebRequest -Uri "http://localhost:${TestPort}/" -UseBasicParsing -TimeoutSec 10
            if ($mainPageResponse.StatusCode -eq 200) {
                Write-Success "Main page is accessible"
            } else {
                Write-Warning "Main page returned status: $($mainPageResponse.StatusCode)"
            }
        } catch {
            Write-Warning "Main page test failed (might be expected without database): $_"
        }
        
        # Test 7: Check container logs
        Write-Status "Test 7: Checking container logs..."
        $logs = docker logs $ContainerName 2>&1
        if ($logs -match "ready|started|listening") {
            Write-Success "Container logs look good"
        } else {
            Write-Warning "Container logs might indicate issues:"
            $logs | Select-Object -Last 10 | ForEach-Object { Write-Host $_ }
        }
        
        # Test 8: Check container health
        Write-Status "Test 8: Checking container health..."
        try {
            $healthStatus = docker inspect $ContainerName --format='{{.State.Health.Status}}' 2>$null
            if (-not $healthStatus) {
                $healthStatus = "no-healthcheck"
            }
            Write-Status "Container health status: $healthStatus"
        } catch {
            Write-Status "Container health status: unknown"
        }
        
        # Test 9: Test container stop/start
        Write-Status "Test 9: Testing container stop/start..."
        docker stop $ContainerName | Out-Null
        docker start $ContainerName | Out-Null
        
        if (Wait-ForService "http://localhost:${TestPort}/api/health" 30) {
            Write-Success "Container restart test passed"
        } else {
            Write-Error "Container restart test failed"
            throw "Restart test failed"
        }
        
        Write-Success "All tests passed!"
        
    } catch {
        Write-Error "Test failed: $_"
        exit 1
    } finally {
        Cleanup
    }
}

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker is not running or not accessible"
    exit 1
}

# Check if port is available
$portInUse = Get-NetTCPConnection -LocalPort $TestPort -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Error "Port $TestPort is already in use"
    exit 1
}

# Run tests
Run-Tests

Write-Success "Docker test completed successfully!"
Write-Status "Image: ${ImageName}:${Tag}"
Write-Status "Test port: $TestPort"
