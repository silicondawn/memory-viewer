#!/bin/bash
set -e

# Docker Image Build Script for Memory Viewer
# Usage: ./scripts/build-docker.sh [tag]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
IMAGE_NAME="${DOCKER_IMAGE_NAME:-silicondawn/memory-viewer}"
TAG="${1:-latest}"
FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$TAG"

echo "🐳 Building Memory Viewer Docker Image"
echo "======================================"
echo "Registry: $REGISTRY"
echo "Image:    $IMAGE_NAME"
echo "Tag:      $TAG"
echo "Full:     $FULL_IMAGE"
echo ""

# Navigate to project root
cd "$PROJECT_ROOT"

# Build the image
echo "📦 Building Docker image..."
docker build -t "$FULL_IMAGE" .

# Tag additional tags
if [ "$TAG" != "latest" ]; then
    docker tag "$FULL_IMAGE" "$REGISTRY/$IMAGE_NAME:latest"
    echo "🏷️  Tagged as latest"
fi

echo ""
echo "✅ Build complete!"
echo ""

# Push if requested
if [ "${PUSH:-false}" = "true" ]; then
    echo "📤 Pushing to registry..."
    docker push "$FULL_IMAGE"
    if [ "$TAG" != "latest" ]; then
        docker push "$REGISTRY/$IMAGE_NAME:latest"
    fi
    echo "✅ Push complete!"
else
    echo "💡 To push the image, run: PUSH=true $0 $TAG"
    echo "   Or manually: docker push $FULL_IMAGE"
fi

echo ""
echo "🚀 To run the container:"
echo "   docker run -d -p 8901:8901 -v ~/.openclaw/workspace:/app/workspace:ro $FULL_IMAGE"
echo ""
echo "   Or use docker-compose:"
echo "   docker-compose up -d"
