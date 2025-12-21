# Multi-User Testing Strategy

## Objective
Verify that multiple users can access the application while the backend only hits the VBB API once (via the poller), ensuring the caching mechanism works correctly.

---

## Architecture Summary

### Data Flow
1. **VBB Poller** ([`vbbPoller.js`](../backend/vbbPoller.js)) fetches from VBB API every 20 seconds (19 bounding boxes)
2. **Cache** ([`cache.js`](../backend/cache.js)) stores the fetched data in memory
3. **Express Server** ([`index.js`](../backend/index.js)) serves cached data via `/api/movements`
4. **Multiple Clients** fetch from the Express server (not directly from VBB API)

### Expected Behavior
- **VBB API calls**: Fixed at 19 requests every 20 seconds (from poller only)
- **Client requests**: Can be unlimited, all served from cache
- **Rate limit tracker**: Should only increment for poller requests

---

## Testing Methods

### Method 1: Manual Browser Testing

**Purpose**: Quick validation with real browsers

**Steps**:
1. Start the backend server
2. Open the app in multiple browser windows/tabs
3. Monitor the backend console logs
4. Check rate limit UI in each browser

**Expected Results**:
- Rate limit counter shows ~19 requests every 20 seconds (consistent regardless of client count)
- All clients receive the same data from cache
- Console logs show multiple client requests but consistent VBB poller activity

**Tools Needed**: 
- 3-5 browser windows/tabs
- Developer console open in each

---

### Method 2: Automated Concurrent Request Testing

**Purpose**: Simulate many simultaneous users programmatically

**Test Script**: Create a Node.js script that simulates 10-50 concurrent clients

**Expected Results**:
- Backend handles all concurrent requests
- VBB API call count remains at 19 requests/20 seconds
- All clients receive valid cached data
- Server responds quickly (cache is fast)

---

### Method 3: Rate Limit Monitoring

**Purpose**: Prove VBB API is only hit by the poller

**Monitoring Points**:
1. [`rateLimitTracker.js`](../backend/rateLimitTracker.js) - tracks VBB API calls
2. Backend console logs - shows poller activity
3. Frontend rate limit UI - displays current count

**Expected Results**:
- Rate limit count increases by 19 every 20 seconds
- Count does NOT increase when clients refresh manually
- Count pattern is consistent and predictable

---

### Method 4: Network Traffic Analysis

**Purpose**: Visual confirmation of request flow

**Steps**:
1. Open browser DevTools Network tab
2. Filter by "movements" endpoint
3. Refresh multiple times in quick succession
4. Check that all requests go to `localhost:3000/api/movements` (not VBB API)

**Expected Results**:
- No direct requests to `v6.vbb.transport.rest`
- All frontend requests go to local backend
- Fast response times (cache is instant)

---

## Implementation Plan

### Enhancement 1: Client Connection Logging

**Goal**: Track how many unique clients are connected

**Changes Needed**:
- Add middleware to log unique client IPs/sessions
- Add counter for active connections
- Add endpoint `/api/stats/clients` to show client count

**File**: [`backend/index.js`](../backend/index.js)

```javascript
// Track unique clients
const activeClients = new Set();

app.use((req, res, next) => {
    const clientId = req.ip || req.socket.remoteAddress;
    activeClients.add(clientId);
    
    // Clean up old clients periodically
    setTimeout(() => activeClients.delete(clientId), 60000);
    
    next();
});
```

---

### Enhancement 2: Enhanced Statistics Endpoint

**Goal**: Provide detailed metrics for testing validation

**New Endpoint**: `GET /api/stats/detailed`

**Response**:
```json
{
    "cache": {
        "count": 245,
        "lastUpdated": "2024-01-20T12:00:00Z",
        "ageMs": 5000,
        "isHealthy": true
    },
    "vbbApi": {
        "requestsInLastMinute": 57,
        "limit": 100,
        "percentage": 57
    },
    "clients": {
        "uniqueInLastMinute": 5,
        "totalRequests": 123
    },
    "poller": {
        "lastPollTime": "2024-01-20T12:00:00Z",
        "pollCount": 42,
        "boxCount": 19
    }
}
```

---

### Enhancement 3: Test Automation Script

**Goal**: Automated concurrent user simulation

**File**: Create `backend/test-multi-user.js`

**Features**:
- Simulate N concurrent clients
- Each client requests `/api/movements` at random intervals
- Track response times
- Monitor rate limit endpoint
- Generate report showing VBB API calls vs client requests

**Usage**:
```bash
node backend/test-multi-user.js --clients=20 --duration=60
```

---

### Enhancement 4: Poller Activity Logging

**Goal**: Make poller activity more visible

**Changes Needed** in [`vbbPoller.js`](../backend/vbbPoller.js):
- Log each poll cycle with timestamp
- Log VBB API request count
- Log cache update confirmation
- Add counter for total polls executed

---

## Testing Procedure

### Phase 1: Baseline Testing
1. Start backend with no clients
2. Observe poller activity for 2 minutes
3. Record VBB API request pattern
4. Expected: 19 requests every 20 seconds = ~57 requests/minute

### Phase 2: Single Client Testing
1. Connect one frontend client
2. Observe for 2 minutes
3. Client auto-refreshes every 20 seconds
4. Expected: VBB requests still at ~57/minute

### Phase 3: Multiple Browser Testing
1. Open 5 browser tabs
2. All tabs auto-refresh every 20 seconds
3. Manually refresh several tabs
4. Expected: VBB requests still at ~57/minute

### Phase 4: Automated Load Testing
1. Run test script with 20 concurrent clients
2. Each client requests every 5 seconds
3. Run for 2 minutes
4. Expected: VBB requests still at ~57/minute

### Phase 5: Rate Limit Verification
1. Check `/api/rate-limit` endpoint during all phases
2. Verify count only increases from poller
3. Verify count doesn't spike with client activity
4. Expected: Consistent pattern regardless of client count

---

## Success Criteria

### ✅ Test Passes If:
1. VBB API request count remains constant at ~57/minute (19 boxes × 3 polls)
2. Multiple clients all receive fresh data from cache
3. Cache age stays under 20 seconds consistently
4. Backend responds quickly to all client requests (<100ms)
5. Rate limit tracker only counts poller requests
6. No 429 (rate limit) errors from VBB API

### ❌ Test Fails If:
1. VBB API requests increase with client count
2. Clients receive stale data (cache age >60 seconds)
3. Rate limit errors occur during normal operation
4. Backend becomes unresponsive under client load
5. Different clients receive different data at same time

---

## Metrics to Track

| Metric | Baseline | 1 Client | 5 Clients | 20 Clients |
|--------|----------|----------|-----------|------------|
| VBB API requests/min | ~57 | ~57 | ~57 | ~57 |
| Rate limit % | 57% | 57% | 57% | 57% |
| Backend requests/min | 0 | 3 | 15 | 240 |
| Cache age (avg) | - | <10s | <10s | <10s |
| Response time (avg) | - | <50ms | <50ms | <100ms |

---

## Troubleshooting Guide

### Issue: VBB requests increase with clients
**Cause**: Clients might be directly calling VBB API
**Fix**: Check [`vbb_data.js`](../vbb_data.js) - ensure it only calls backend

### Issue: Cache shows stale data
**Cause**: Poller might have stopped
**Fix**: Check poller logs, verify it's running

### Issue: Rate limit errors
**Cause**: Too many bounding boxes or too fast polling
**Fix**: Reduce poll frequency or box count in [`config.js`](../backend/config.js)

### Issue: Slow backend responses with many clients
**Cause**: Server overload or expensive operations
**Fix**: Add response caching, optimize data serialization

---

## Next Steps After Testing

1. **Document Results**: Record actual metrics from tests
2. **Performance Tuning**: Optimize based on bottlenecks found
3. **Deployment Testing**: Repeat tests on production environment
4. **Monitoring Setup**: Add ongoing monitoring for production
5. **Documentation**: Update README with multi-user capabilities

---

## Tools Required

- **Node.js**: For running test scripts
- **Browser**: Chrome/Firefox with DevTools
- **Terminal**: For monitoring backend logs
- **Optional**: `curl` or Postman for API testing
- **Optional**: Load testing tools (Artillery, k6, Apache Bench)

---

## Timeline

- **Planning**: 30 minutes (this document)
- **Implementation**: 2-3 hours (logging, test scripts)
- **Manual Testing**: 30 minutes
- **Automated Testing**: 1 hour (run and analyze)
- **Documentation**: 30 minutes (results and report)

**Total**: ~5 hours for comprehensive testing
