# Build script for motea standalone Docker image (PowerShell)
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

param(
    [string]$Version = "latest",
    [string]$ImageName = "motea-standalone"
)

# Configuration
$BuildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Revision = try { 
    (git rev-parse --short HEAD 2>$null) 
} catch { 
    "unknown" 
}

Write-Host "Building motea standalone Docker image..." -ForegroundColor Blue
Write-Host "Image: $ImageName`:$Version" -ForegroundColor Yellow
Write-Host "Build time: $BuildTime" -ForegroundColor Yellow
Write-Host "Revision: $Revision" -ForegroundColor Yellow

# Build the image
Write-Host "Starting Docker build..." -ForegroundColor Green
docker build `
    --build-arg BUILDTIME="$BuildTime" `
    --build-arg VERSION="$Version" `
    --build-arg REVISION="$Revision" `
    -t "$ImageName`:$Version" `
    -t "$ImageName`:latest" `
    .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
    
    # Show image info
    Write-Host "Image information:" -ForegroundColor Blue
    docker images $ImageName --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    Write-Host "To run the standalone container:" -ForegroundColor Green
    Write-Host "docker-compose -f docker-compose.standalone.yml up -d" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run directly:" -ForegroundColor Green
    Write-Host "docker run -d -p 3000:3000 -v motea_data:/data --name motea $ImageName`:$Version" -ForegroundColor Yellow
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
