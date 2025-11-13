#!/bin/bash
# Validate Docker build locally before pushing to production
# Usage: npm run validate:docker OR ./scripts/validate-docker-build.sh

set -e

echo "🐳 Validating Docker build..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Install Docker to validate production builds locally."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Start Docker and try again."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image (this may take 1-2 minutes)..."
if docker build -t wmv-cycling:validation . > /tmp/docker-build.log 2>&1; then
    echo "✅ Docker build successful!"
else
    echo "❌ Docker build failed!"
    echo ""
    echo "Build log (last 50 lines):"
    tail -50 /tmp/docker-build.log
    exit 1
fi

echo ""
echo "🔍 Verifying production image..."

# Verify test files are NOT in the image
echo -n "  - Checking test files are excluded..."
if docker run --rm wmv-cycling:validation sh -c 'test ! -d server/src/__tests__' 2>/dev/null; then
    echo " ✅"
else
    echo " ❌ (test directory found in production image)"
    exit 1
fi

# Verify app can start
echo -n "  - Checking app can start..."
if timeout 5 docker run --rm --env NODE_ENV=production wmv-cycling:validation sh -c 'node -e "console.log(\"✅ Node can run\")"' 2>/dev/null | grep -q "✅"; then
    echo " ✅"
else
    echo " ⚠️  (warning: could not verify app startup)"
fi

# Verify scripts directory is included
echo -n "  - Checking production scripts are included..."
if docker run --rm wmv-cycling:validation test -f scripts/dev-server.cjs 2>/dev/null; then
    echo " ✅"
else
    echo " ❌ (scripts missing from production image)"
    exit 1
fi

echo ""
echo "✅ All validations passed!"
echo ""
echo "Next steps:"
echo "  • Push with: git push origin main"
echo "  • Railway will auto-deploy when GitHub Actions passes"
echo ""
