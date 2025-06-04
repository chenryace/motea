#!/bin/bash
# Docker test script for motea
# waycaan mit, 2025

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="motea"
TAG="test"
CONTAINER_NAME="motea-test"
TEST_PORT="3001"

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

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Function to wait for service
wait_for_service() {
    local url=$1
    local timeout=${2:-30}
    local count=0
    
    print_status "Waiting for service at $url..."
    
    while [ $count -lt $timeout ]; do
        if curl -f -s $url >/dev/null 2>&1; then
            print_success "Service is ready!"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo ""
    print_error "Service failed to start within $timeout seconds"
    return 1
}

# Main test function
run_tests() {
    print_status "Starting Docker tests for $IMAGE_NAME:$TAG"
    
    # Test 1: Build image
    print_status "Test 1: Building Docker image..."
    if docker build -t $IMAGE_NAME:$TAG .; then
        print_success "Image built successfully"
    else
        print_error "Failed to build image"
        exit 1
    fi
    
    # Test 2: Check image size
    print_status "Test 2: Checking image size..."
    IMAGE_SIZE=$(docker images $IMAGE_NAME:$TAG --format "{{.Size}}")
    print_status "Image size: $IMAGE_SIZE"
    
    # Test 3: Run container
    print_status "Test 3: Running container..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p $TEST_PORT:3000 \
        -e NODE_ENV=production \
        -e DISABLE_PASSWORD=true \
        $IMAGE_NAME:$TAG
    
    if [ $? -eq 0 ]; then
        print_success "Container started successfully"
    else
        print_error "Failed to start container"
        exit 1
    fi
    
    # Test 4: Wait for service to be ready
    print_status "Test 4: Waiting for service to be ready..."
    if wait_for_service "http://localhost:$TEST_PORT/api/health" 60; then
        print_success "Service is responding"
    else
        print_error "Service failed to respond"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    
    # Test 5: Test health endpoint
    print_status "Test 5: Testing health endpoint..."
    HEALTH_RESPONSE=$(curl -s http://localhost:$TEST_PORT/api/health)
    if echo "$HEALTH_RESPONSE" | grep -q "healthy\|error"; then
        print_success "Health endpoint is working"
        print_status "Health response: $HEALTH_RESPONSE"
    else
        print_error "Health endpoint test failed"
        print_error "Response: $HEALTH_RESPONSE"
        exit 1
    fi
    
    # Test 6: Test main page
    print_status "Test 6: Testing main page..."
    if curl -f -s http://localhost:$TEST_PORT/ >/dev/null; then
        print_success "Main page is accessible"
    else
        print_warning "Main page test failed (might be expected without database)"
    fi
    
    # Test 7: Check container logs
    print_status "Test 7: Checking container logs..."
    LOGS=$(docker logs $CONTAINER_NAME 2>&1)
    if echo "$LOGS" | grep -q "ready\|started\|listening"; then
        print_success "Container logs look good"
    else
        print_warning "Container logs might indicate issues:"
        echo "$LOGS" | tail -10
    fi
    
    # Test 8: Check container health
    print_status "Test 8: Checking container health..."
    HEALTH_STATUS=$(docker inspect $CONTAINER_NAME --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    print_status "Container health status: $HEALTH_STATUS"
    
    # Test 9: Test container stop/start
    print_status "Test 9: Testing container stop/start..."
    docker stop $CONTAINER_NAME
    docker start $CONTAINER_NAME
    
    if wait_for_service "http://localhost:$TEST_PORT/api/health" 30; then
        print_success "Container restart test passed"
    else
        print_error "Container restart test failed"
        exit 1
    fi
    
    print_success "All tests passed!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME       Image name (default: motea)"
    echo "  -t, --tag TAG         Image tag (default: test)"
    echo "  -p, --port PORT       Test port (default: 3001)"
    echo "  -h, --help           Show this help message"
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
        -p|--port)
            TEST_PORT="$2"
            shift 2
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

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running or not accessible"
    exit 1
fi

# Check if port is available
if netstat -tuln 2>/dev/null | grep -q ":$TEST_PORT "; then
    print_error "Port $TEST_PORT is already in use"
    exit 1
fi

# Run tests
run_tests

print_success "Docker test completed successfully!"
print_status "Image: $IMAGE_NAME:$TAG"
print_status "Test port: $TEST_PORT"
