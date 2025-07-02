#!/bin/bash
# Build script for motea standalone Docker image
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="motea-standalone"
VERSION=${VERSION:-"latest"}
BUILDTIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo -e "${BLUE}Building motea standalone Docker image...${NC}"
echo -e "${YELLOW}Image: ${IMAGE_NAME}:${VERSION}${NC}"
echo -e "${YELLOW}Build time: ${BUILDTIME}${NC}"
echo -e "${YELLOW}Revision: ${REVISION}${NC}"

# Build the image
echo -e "${GREEN}Starting Docker build...${NC}"
docker build \
    --build-arg BUILDTIME="${BUILDTIME}" \
    --build-arg VERSION="${VERSION}" \
    --build-arg REVISION="${REVISION}" \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    .

echo -e "${GREEN}Build completed successfully!${NC}"

# Show image info
echo -e "${BLUE}Image information:${NC}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "${GREEN}To run the standalone container:${NC}"
echo -e "${YELLOW}docker-compose -f docker-compose.standalone.yml up -d${NC}"
echo ""
echo -e "${GREEN}Or run directly:${NC}"
echo -e "${YELLOW}docker run -d -p 3000:3000 -v motea_data:/data --name motea ${IMAGE_NAME}:${VERSION}${NC}"
