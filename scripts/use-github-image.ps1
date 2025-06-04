# Script to use pre-built GitHub image (PowerShell)
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

param(
    [string]$Tag = "latest"
)

# Configuration
$Registry = "ghcr.io"
$Owner = "waycaan"
$ImageName = "motea"
$FullImageName = "$Registry/$Owner/$ImageName`:$Tag"

Write-Host "Using pre-built motea standalone image from GitHub..." -ForegroundColor Blue
Write-Host "Image: $FullImageName" -ForegroundColor Yellow

# Pull the image
Write-Host "Pulling image..." -ForegroundColor Blue
docker pull $FullImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to pull image. Please check if the image exists and you have access." -ForegroundColor Red
    exit 1
}

# Create configuration file if not exists
if (-not (Test-Path "motea.conf")) {
    Write-Host "Creating configuration file..." -ForegroundColor Blue
    Copy-Item "motea.conf.example" "motea.conf"
    Write-Host "Please edit motea.conf to set your password and preferences" -ForegroundColor Yellow
}

# Run the container
Write-Host "Starting container..." -ForegroundColor Blue
$currentDir = (Get-Location).Path
docker run -d `
    --name motea `
    -p 3000:3000 `
    -v motea_data:/data `
    -v "$currentDir/motea.conf:/app/motea.conf:ro" `
    --restart unless-stopped `
    $FullImageName

if ($LASTEXITCODE -eq 0) {
    Write-Host "Container started successfully!" -ForegroundColor Green
    Write-Host "Application: http://localhost:3000" -ForegroundColor Blue
    Write-Host "Please edit motea.conf and restart container if needed:" -ForegroundColor Yellow
    Write-Host "docker restart motea" -ForegroundColor Yellow
} else {
    Write-Host "Failed to start container" -ForegroundColor Red
    exit 1
}
