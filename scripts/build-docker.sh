#!/bin/bash
# Docker build script for motea
# waycaan mit, 2025

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="motea"
TAG="latest"
PLATFORM="linux/amd64,linux/arm64"
PUSH=false
BUILD_ARGS=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME       Image name (default: motea)"
    echo "  -t, --tag TAG         Image tag (default: latest)"
    echo "  -p, --platform ARCH   Target platform (default: linux/amd64,linux/arm64)"
    echo "  --push               Push image to registry"
    echo "  --local              Build for local platform only"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Build local image"
    echo "  $0 --local                          # Build for local platform only"
    echo "  $0 -n myapp -t v1.0.0               # Build with custom name and tag"
    echo "  $0 --push                           # Build and push to registry"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --local)
            PLATFORM=""
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Get build information
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=${TAG}
REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Prepare build arguments
BUILD_ARGS="--build-arg BUILDTIME=${BUILD_TIME}"
BUILD_ARGS="${BUILD_ARGS} --build-arg VERSION=${VERSION}"
BUILD_ARGS="${BUILD_ARGS} --build-arg REVISION=${REVISION}"

# Full image name
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

print_status "Building Docker image: ${FULL_IMAGE_NAME}"
print_status "Build time: ${BUILD_TIME}"
print_status "Version: ${VERSION}"
print_status "Revision: ${REVISION}"

# Check if buildx is available for multi-platform builds
if [[ -n "$PLATFORM" ]]; then
    if ! docker buildx version >/dev/null 2>&1; then
        print_error "Docker buildx is required for multi-platform builds"
        print_status "Installing buildx..."
        docker buildx create --use
    fi
    
    print_status "Building for platforms: ${PLATFORM}"
    
    if [[ "$PUSH" == "true" ]]; then
        docker buildx build \
            --platform "${PLATFORM}" \
            --tag "${FULL_IMAGE_NAME}" \
            ${BUILD_ARGS} \
            --push \
            .
    else
        docker buildx build \
            --platform "${PLATFORM}" \
            --tag "${FULL_IMAGE_NAME}" \
            ${BUILD_ARGS} \
            --load \
            .
    fi
else
    # Local build
    print_status "Building for local platform"
    docker build \
        --tag "${FULL_IMAGE_NAME}" \
        ${BUILD_ARGS} \
        .
    
    if [[ "$PUSH" == "true" ]]; then
        print_status "Pushing image to registry..."
        docker push "${FULL_IMAGE_NAME}"
    fi
fi

print_success "Docker image built successfully: ${FULL_IMAGE_NAME}"

# Show image information
print_status "Image information:"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
