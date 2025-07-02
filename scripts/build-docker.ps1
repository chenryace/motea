# Docker build script for motea (PowerShell version)
# waycaan mit, 2025

param(
    [string]$ImageName = "motea",
    [string]$Tag = "latest",
    [string]$Platform = "linux/amd64,linux/arm64",
    [switch]$Push,
    [switch]$Local,
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
    Write-Host "Usage: .\build-docker.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -ImageName NAME       Image name (default: motea)"
    Write-Host "  -Tag TAG             Image tag (default: latest)"
    Write-Host "  -Platform ARCH       Target platform (default: linux/amd64,linux/arm64)"
    Write-Host "  -Push                Push image to registry"
    Write-Host "  -Local               Build for local platform only"
    Write-Host "  -Help                Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\build-docker.ps1                                    # Build local image"
    Write-Host "  .\build-docker.ps1 -Local                           # Build for local platform only"
    Write-Host "  .\build-docker.ps1 -ImageName myapp -Tag v1.0.0     # Build with custom name and tag"
    Write-Host "  .\build-docker.ps1 -Push                            # Build and push to registry"
}

# Show help if requested
if ($Help) {
    Show-Usage
    exit 0
}

# Set platform for local build
if ($Local) {
    $Platform = ""
}

# Get build information
$BuildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$Version = $Tag

# Try to get git revision
try {
    $Revision = git rev-parse --short HEAD 2>$null
    if (-not $Revision) {
        $Revision = "unknown"
    }
} catch {
    $Revision = "unknown"
}

# Prepare build arguments
$BuildArgs = @(
    "--build-arg", "BUILDTIME=$BuildTime",
    "--build-arg", "VERSION=$Version",
    "--build-arg", "REVISION=$Revision"
)

# Full image name
$FullImageName = "${ImageName}:${Tag}"

Write-Status "Building Docker image: $FullImageName"
Write-Status "Build time: $BuildTime"
Write-Status "Version: $Version"
Write-Status "Revision: $Revision"

# Change to motea directory
Push-Location -Path "motea"

try {
    # Check if buildx is available for multi-platform builds
    if ($Platform) {
        try {
            docker buildx version | Out-Null
        } catch {
            Write-Error "Docker buildx is required for multi-platform builds"
            Write-Status "Installing buildx..."
            docker buildx create --use
        }
        
        Write-Status "Building for platforms: $Platform"
        
        if ($Push) {
            docker buildx build --platform $Platform --tag $FullImageName @BuildArgs --push .
        } else {
            docker buildx build --platform $Platform --tag $FullImageName @BuildArgs --load .
        }
    } else {
        # Local build
        Write-Status "Building for local platform"
        docker build --tag $FullImageName @BuildArgs .
        
        if ($Push) {
            Write-Status "Pushing image to registry..."
            docker push $FullImageName
        }
    }

    Write-Success "Docker image built successfully: $FullImageName"

    # Show image information
    Write-Status "Image information:"
    docker images $ImageName --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

} catch {
    Write-Error "Build failed: $_"
    exit 1
} finally {
    Pop-Location
}
