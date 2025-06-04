#!/bin/bash
# Script to use pre-built GitHub image
# Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
# Modified and maintained by waycaan, 2025.

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="ghcr.io"
OWNER="waycaan"
IMAGE_NAME="motea"
TAG="${1:-latest}"
FULL_IMAGE_NAME="${REGISTRY}/${OWNER}/${IMAGE_NAME}:${TAG}"

echo -e "${BLUE}Using pre-built motea standalone image from GitHub...${NC}"
echo -e "${YELLOW}Image: ${FULL_IMAGE_NAME}${NC}"

# Pull the image
echo -e "${BLUE}Pulling image...${NC}"
docker pull "${FULL_IMAGE_NAME}"

# Create configuration file if not exists
if [ ! -f "motea.conf" ]; then
    echo -e "${BLUE}Creating configuration file...${NC}"
    cp motea.conf.example motea.conf
    echo -e "${YELLOW}Please edit motea.conf to set your password and preferences${NC}"
fi

# Run the container
echo -e "${BLUE}Starting container...${NC}"
docker run -d \
    --name motea \
    -p 3000:3000 \
    -v motea_data:/data \
    -v "$(pwd)/motea.conf:/app/motea.conf:ro" \
    --restart unless-stopped \
    "${FULL_IMAGE_NAME}"

echo -e "${GREEN}Container started successfully!${NC}"
echo -e "${BLUE}Application: http://localhost:3000${NC}"
echo -e "${YELLOW}Please edit motea.conf and restart container if needed:${NC}"
echo -e "${YELLOW}docker restart motea${NC}"
