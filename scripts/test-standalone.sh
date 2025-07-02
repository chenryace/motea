#!/bin/bash
# Test script for motea standalone Docker image
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
IMAGE_NAME="motea"
CONTAINER_NAME="motea-test"
TEST_PORT="3001"

echo -e "${BLUE}Testing motea standalone Docker image...${NC}"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up test environment...${NC}"
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    docker volume rm motea_test_data 2>/dev/null || true
}

# Set up signal handlers
trap cleanup EXIT

# Check if image exists
if ! docker images $IMAGE_NAME:latest --format "{{.Repository}}" | grep -q $IMAGE_NAME; then
    echo -e "${RED}Image $IMAGE_NAME:latest not found. Please build it first:${NC}"
    echo -e "${YELLOW}make build-standalone${NC}"
    exit 1
fi

echo -e "${GREEN}Found image $IMAGE_NAME:latest${NC}"

# Start container
echo -e "${BLUE}Starting test container...${NC}"
docker run -d \
    --name $CONTAINER_NAME \
    -p $TEST_PORT:3000 \
    -v motea_test_data:/data \
    -e PASSWORD=test123 \
    -e LOG_LEVEL=debug \
    $IMAGE_NAME:latest

# Wait for container to start
echo -e "${BLUE}Waiting for container to start...${NC}"
for i in {1..60}; do
    if docker ps --filter name=$CONTAINER_NAME --format "{{.Status}}" | grep -q "Up"; then
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}Container failed to start within 60 seconds${NC}"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}Container started successfully!${NC}"

# Wait for application to be ready
echo -e "${BLUE}Waiting for application to be ready...${NC}"
for i in {1..120}; do
    if curl -f http://localhost:$TEST_PORT/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}Application is ready!${NC}"
        break
    fi
    if [ $i -eq 120 ]; then
        echo -e "${RED}Application failed to start within 120 seconds${NC}"
        echo -e "${YELLOW}Container logs:${NC}"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    sleep 1
done

# Test health endpoint
echo -e "${BLUE}Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$TEST_PORT/api/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}Health check passed!${NC}"
else
    echo -e "${RED}Health check failed!${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# Test main page
echo -e "${BLUE}Testing main page...${NC}"
if curl -f http://localhost:$TEST_PORT/ >/dev/null 2>&1; then
    echo -e "${GREEN}Main page accessible!${NC}"
else
    echo -e "${RED}Main page not accessible!${NC}"
    exit 1
fi

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
if docker exec $CONTAINER_NAME su-exec postgres pg_isready >/dev/null 2>&1; then
    echo -e "${GREEN}Database connection successful!${NC}"
else
    echo -e "${RED}Database connection failed!${NC}"
    exit 1
fi

# Test database content
echo -e "${BLUE}Testing database content...${NC}"
DB_TEST=$(docker exec $CONTAINER_NAME su-exec postgres psql -U motea motea -t -c "SELECT 1;" 2>/dev/null | tr -d ' \n')
if [ "$DB_TEST" = "1" ]; then
    echo -e "${GREEN}Database query successful!${NC}"
else
    echo -e "${RED}Database query failed!${NC}"
    exit 1
fi

echo -e "${GREEN}All tests passed! 🎉${NC}"
echo -e "${BLUE}Test summary:${NC}"
echo -e "  ✅ Container startup"
echo -e "  ✅ Application health"
echo -e "  ✅ Main page access"
echo -e "  ✅ Database connection"
echo -e "  ✅ Database queries"
echo ""
echo -e "${YELLOW}Test application is running at: http://localhost:$TEST_PORT${NC}"
echo -e "${YELLOW}Login with password: test123${NC}"
echo ""
echo -e "${BLUE}To stop the test container:${NC}"
echo -e "${YELLOW}docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME${NC}"
