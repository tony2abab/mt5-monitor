#!/bin/bash
# MT5 Monitor API Test Script (Bash)
# 測試後端 API 的心跳和統計上報功能

API_BASE="http://localhost:8080/api"
API_KEY="your_secret_api_key_change_this"

echo "==========================================="
echo "MT5 Monitor API Test Script"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}[Test 1] Health Check...${NC}"
response=$(curl -s http://localhost:8080/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server is healthy${NC}"
    echo -e "${GRAY}  Response: $response${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi
echo ""

# Test 2: Send Heartbeat
echo -e "${YELLOW}[Test 2] Sending Heartbeat...${NC}"
response=$(curl -s -X POST "$API_BASE/heartbeat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{
        "id": "TEST_NODE_01",
        "name": "Test EA Node",
        "broker": "Test Broker Co.",
        "account": "88888888",
        "meta": {
            "symbols": ["XAUUSD", "EURUSD"]
        }
    }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Heartbeat sent successfully${NC}"
    echo -e "${GRAY}  Response: $response${NC}"
else
    echo -e "${RED}✗ Heartbeat failed${NC}"
fi
echo ""

# Test 3: Send Stats
echo -e "${YELLOW}[Test 3] Sending Daily Stats...${NC}"
today=$(date +%Y-%m-%d)
response=$(curl -s -X POST "$API_BASE/stats" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "{
        \"id\": \"TEST_NODE_01\",
        \"date\": \"$today\",
        \"profit_loss\": 250.75,
        \"interest\": 5.50,
        \"avg_lots_success\": 0.68,
        \"lots_traded\": 15.5,
        \"ab_lots_diff\": 3.2
    }")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Stats sent successfully${NC}"
    echo -e "${GRAY}  Response: $response${NC}"
else
    echo -e "${RED}✗ Stats failed${NC}"
fi
echo ""

# Test 4: Get All Nodes
echo -e "${YELLOW}[Test 4] Getting All Nodes...${NC}"
response=$(curl -s "$API_BASE/nodes")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Retrieved nodes${NC}"
    echo -e "${GRAY}  Response (truncated):${NC}"
    echo "$response" | jq '.summary' 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Get nodes failed${NC}"
fi
echo ""

# Test 5: Get Single Node
echo -e "${YELLOW}[Test 5] Getting Single Node...${NC}"
response=$(curl -s "$API_BASE/nodes/TEST_NODE_01?days=7")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Retrieved node details${NC}"
    echo -e "${GRAY}  Response (truncated):${NC}"
    echo "$response" | jq '.node | {id, name, status}' 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Get node failed${NC}"
fi
echo ""

echo "==========================================="
echo "Tests completed!"
echo "==========================================="
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check the frontend at http://localhost:3000 (dev) or http://localhost (production)"
echo "2. Attach MT4/MT5 EA to start real monitoring"
echo "3. Configure Telegram notifications in .env"
