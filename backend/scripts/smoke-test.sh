#!/usr/bin/env bash
#
# Smoke Tests for SmartHomeHUB
# Verifies critical functionality after deployment
# Usage: ./smoke-test.sh [base_url]
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_status="${3:-200}"
    local method="${4:-GET}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    local response
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" 2>&1 || echo "ERROR")

    if [[ "$response" == "ERROR" ]]; then
        fail "$name - Connection failed"
        return 1
    fi

    local status_code
    status_code=$(echo "$response" | tail -n1)

    if [[ "$status_code" == "$expected_status" ]]; then
        pass "$name"
        return 0
    else
        fail "$name - Expected $expected_status, got $status_code"
        return 1
    fi
}

test_endpoint_with_body() {
    local name="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="${4:-200}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$BASE_URL$endpoint" 2>&1 || echo "ERROR")

    if [[ "$response" == "ERROR" ]]; then
        fail "$name - Connection failed"
        return 1
    fi

    local status_code
    status_code=$(echo "$response" | tail -n1)

    if [[ "$status_code" == "$expected_status" ]]; then
        pass "$name"
        return 0
    else
        fail "$name - Expected $expected_status, got $status_code"
        return 1
    fi
}

echo "========================================"
echo "SmartHomeHUB Smoke Tests"
echo "Target: $BASE_URL"
echo "Started: $(date)"
echo "========================================"
echo ""

# Test 1: Health Check
echo "Running Health Checks..."
test_endpoint "Health endpoint" "/api/health" 200

# Test 2: Authentication Endpoints
echo ""
echo "Running Authentication Tests..."
test_endpoint "CSRF token endpoint" "/api/csrf-token" 200
test_endpoint_with_body "Register endpoint (should reject invalid data)" "/api/auth/register" '{"username":"test"}' 400
test_endpoint "Auth me endpoint (should reject without token)" "/api/auth/me" 401

# Test 3: Device Endpoints (require authentication)
echo ""
echo "Running Device Tests..."
test_endpoint "List devices (should reject without auth)" "/api/devices" 401

# Test 4: Static Assets
echo ""
echo "Running Static Asset Tests..."
if [[ -f "frontend/index.html" ]]; then
    test_endpoint "Frontend index" "/" 200
else
    echo -e "${YELLOW}⊘${NC} Frontend not found (backend-only deployment)"
fi

# Test 5: Database Connection
echo ""
echo "Running Database Tests..."
# Health endpoint includes database check
test_endpoint "Database health (via health endpoint)" "/api/health" 200

# Test 6: Response Time
echo ""
echo "Running Performance Tests..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
start_time=$(date +%s%N)
curl -s -f "$BASE_URL/api/health" > /dev/null
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [[ $response_time -lt 1000 ]]; then
    pass "Response time: ${response_time}ms (< 1s)"
else
    fail "Response time: ${response_time}ms (> 1s threshold)"
fi

# Test 7: Memory Check
echo ""
echo "Running Resource Checks..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if command -v docker &> /dev/null; then
    container_memory=$(docker stats --no-stream --format "{{.MemUsage}}" smarthomehub-backend 2>/dev/null | head -n1 || echo "N/A")
    if [[ "$container_memory" != "N/A" ]]; then
        pass "Container memory usage: $container_memory"
    else
        echo -e "${YELLOW}⊘${NC} Container stats not available"
        TOTAL_TESTS=$((TOTAL_TESTS - 1))
    fi
else
    echo -e "${YELLOW}⊘${NC} Docker not available, skipping container checks"
    TOTAL_TESTS=$((TOTAL_TESTS - 1))
fi

# Test 8: Log Error Check
echo ""
echo "Running Log Checks..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [[ -f "/var/log/smarthomehub/error.log" ]]; then
    recent_errors=$(tail -n 100 /var/log/smarthomehub/error.log 2>/dev/null | grep -c "ERROR" || echo "0")
    if [[ $recent_errors -eq 0 ]]; then
        pass "No recent errors in logs"
    else
        fail "Found $recent_errors recent errors in logs"
    fi
else
    echo -e "${YELLOW}⊘${NC} Error log not found, skipping"
    TOTAL_TESTS=$((TOTAL_TESTS - 1))
fi

# Summary
echo ""
echo "========================================"
echo "Smoke Test Summary"
echo "========================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
echo "Completed: $(date)"
echo "========================================"

# Exit with error if any tests failed
if [[ $FAILED_TESTS -gt 0 ]]; then
    echo ""
    echo -e "${RED}Smoke tests failed!${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}All smoke tests passed!${NC}"
    exit 0
fi
