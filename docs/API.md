# Smart Home Hub - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

## Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success message (optional)"
}
```

### Error Response
```json
{
  "status": "error" | "fail",
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

## HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User
Create a new user account.

**POST** `/api/auth/register`

#### Request Body
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123",
  "fullName": "John Doe",
  "role": "user"  // Optional: admin, user, guest (default: user)
}
```

#### Response (201)
```json
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

---

### Login
Authenticate and receive JWT token.

**POST** `/api/auth/login`

#### Request Body
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

#### Response (200)
```json
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

---

### Get Current User
Get authenticated user profile.

**GET** `/api/auth/me`

**Authentication Required**

#### Response (200)
```json
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Device Endpoints

### List Devices
Get all registered devices with optional filtering.

**GET** `/api/devices`

**Authentication Required**

#### Query Parameters
- `protocol` (optional): Filter by protocol (zigbee, matter, mqtt)
- `type` (optional): Filter by device type (light, switch, sensor, etc.)
- `roomId` (optional): Filter by room UUID
- `online` (optional): Filter by online status (true, false)

#### Response (200)
```json
{
  "devices": [
    {
      "id": "uuid",
      "name": "Living Room Light",
      "type": "light",
      "protocol": "zigbee",
      "manufacturer": "Philips",
      "model": "Hue White",
      "ieeeAddress": "0x00124b001234abcd",
      "roomId": "room-uuid",
      "online": true,
      "state": {
        "on": true,
        "brightness": 255
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastSeen": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Get Device Details
Get detailed information about a specific device.

**GET** `/api/devices/:id`

**Authentication Required**

#### Response (200)
```json
{
  "device": {
    "id": "uuid",
    "name": "Living Room Light",
    "type": "light",
    "protocol": "zigbee",
    "manufacturer": "Philips",
    "model": "Hue White",
    "ieeeAddress": "0x00124b001234abcd",
    "roomId": "room-uuid",
    "online": true,
    "state": {
      "on": true,
      "brightness": 255,
      "color_temp": 370
    },
    "capabilities": ["on_off", "brightness", "color_temp"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastSeen": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### Control Device
Send commands to control a device.

**POST** `/api/devices/:id/control`

**Authentication Required**

#### Request Body
```json
{
  "command": "set_state",
  "value": {
    "on": true,
    "brightness": 200
  }
}
```

#### Common Commands
- **Lights**: `set_state` with `{on, brightness, color_temp, color}`
- **Switches**: `toggle` or `set_state` with `{on}`
- **Thermostats**: `set_temperature` with `{target}`

#### Response (200)
```json
{
  "success": true,
  "device": {
    "id": "uuid",
    "state": {
      "on": true,
      "brightness": 200
    }
  }
}
```

---

### Update Device
Update device metadata.

**PATCH** `/api/devices/:id`

**Authentication Required**

#### Request Body
```json
{
  "name": "New Device Name",
  "roomId": "room-uuid"
}
```

#### Response (200)
```json
{
  "device": {
    "id": "uuid",
    "name": "New Device Name",
    "roomId": "room-uuid"
    // ... other fields
  }
}
```

---

### Delete Device
Remove a device from the system.

**DELETE** `/api/devices/:id`

**Authentication Required** (Admin only)

#### Response (200)
```json
{
  "message": "Device deleted successfully"
}
```

---

### Get Device History
Get historical state changes for a device.

**GET** `/api/devices/:id/history`

**Authentication Required**

#### Query Parameters
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `limit` (optional): Maximum number of records (default: 100)

#### Response (200)
```json
{
  "history": [
    {
      "id": "uuid",
      "deviceId": "device-uuid",
      "state": {"on": true, "brightness": 255},
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Automation Endpoints

### List Automations
Get all automation rules.

**GET** `/api/automations`

**Authentication Required**

#### Response (200)
```json
{
  "automations": [
    {
      "id": "uuid",
      "name": "Turn on lights at sunset",
      "description": "Automatically turn on living room lights",
      "enabled": true,
      "triggers": [
        {
          "type": "time",
          "time": "sunset"
        }
      ],
      "actions": [
        {
          "type": "device_control",
          "deviceId": "device-uuid",
          "command": "set_state",
          "value": {"on": true}
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Create Automation
Create a new automation rule.

**POST** `/api/automations`

**Authentication Required**

#### Request Body
```json
{
  "name": "Morning Routine",
  "description": "Turn on lights and adjust temperature",
  "enabled": true,
  "triggers": [
    {
      "type": "time",
      "time": "07:00"
    }
  ],
  "conditions": [
    {
      "type": "device_state",
      "deviceId": "motion-sensor-uuid",
      "property": "occupancy",
      "operator": "eq",
      "value": true
    }
  ],
  "actions": [
    {
      "type": "device_control",
      "deviceId": "light-uuid",
      "command": "set_state",
      "value": {"on": true, "brightness": 200}
    },
    {
      "type": "device_control",
      "deviceId": "thermostat-uuid",
      "command": "set_temperature",
      "value": {"target": 22}
    }
  ]
}
```

#### Trigger Types
- `time`: Time-based trigger (time, schedule)
- `device_state`: Device state change
- `sensor`: Sensor value threshold
- `schedule`: Recurring schedule

#### Action Types
- `device_control`: Control a device
- `scene`: Activate a scene
- `notification`: Send notification
- `delay`: Wait before next action

#### Response (201)
```json
{
  "automation": {
    "id": "uuid",
    "name": "Morning Routine",
    // ... full automation object
  }
}
```

---

### Create Automation from Text
Create automation using natural language.

**POST** `/api/automations/from-text`

**Authentication Required**

#### Request Body
```json
{
  "text": "Turn on living room lights when motion is detected after sunset"
}
```

#### Response (201)
```json
{
  "automation": {
    "id": "uuid",
    "name": "Motion-activated lights",
    "triggers": [...],
    "actions": [...]
  },
  "interpretation": "AI interpretation of the request"
}
```

---

### Trigger Automation Manually
Manually execute an automation.

**POST** `/api/automations/:id/trigger`

**Authentication Required**

#### Response (200)
```json
{
  "success": true,
  "message": "Automation triggered successfully",
  "executionId": "uuid"
}
```

---

## AI Endpoints

### Chat with AI
Send a message to the AI assistant.

**POST** `/api/ai/chat`

**Authentication Required**

#### Request Body
```json
{
  "message": "Turn on the living room lights",
  "conversationId": "uuid",  // Optional: for conversation continuity
  "provider": "ollama"  // Optional: ollama, openai, claude, gemini
}
```

#### Response (200)
```json
{
  "response": "I've turned on the living room lights for you.",
  "conversationId": "uuid",
  "actions": [
    {
      "type": "device_control",
      "deviceId": "device-uuid",
      "executed": true
    }
  ]
}
```

---

### Analyze Patterns
Analyze usage patterns and get insights.

**POST** `/api/ai/analyze-patterns`

**Authentication Required**

#### Request Body
```json
{
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.000Z",
  "deviceId": "device-uuid"  // Optional: specific device
}
```

#### Response (200)
```json
{
  "patterns": [
    {
      "type": "daily_routine",
      "description": "Lights are typically turned on around 7 AM",
      "confidence": 0.85
    }
  ],
  "suggestions": [
    {
      "type": "automation",
      "description": "Create automation to turn on lights at 7 AM",
      "priority": "medium"
    }
  ]
}
```

---

## Voice Control Endpoints

### Process Voice Command
Process a voice command.

**POST** `/api/voice/command`

**Authentication Required**

#### Request Body
```json
{
  "command": "turn on the bedroom lights"
}
```

#### Response (200)
```json
{
  "understood": true,
  "action": "device_control",
  "response": "Turning on the bedroom lights",
  "executed": true
}
```

---

### Get Voice History
Get voice command history.

**GET** `/api/voice/history`

**Authentication Required**

#### Query Parameters
- `limit` (optional): Maximum number of records (default: 50)
- `offset` (optional): Pagination offset

#### Response (200)
```json
{
  "commands": [
    {
      "id": "uuid",
      "command": "turn on lights",
      "understood": true,
      "executed": true,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

## Protocol Endpoints

### Start Zigbee Pairing
Enable Zigbee pairing mode.

**POST** `/api/protocols/zigbee/pairing`

**Authentication Required** (Admin only)

#### Request Body
```json
{
  "timeout": 120  // Optional: seconds (default: 60)
}
```

#### Response (200)
```json
{
  "success": true,
  "message": "Pairing mode enabled",
  "timeout": 120
}
```

---

### Stop Zigbee Pairing
Disable Zigbee pairing mode.

**POST** `/api/protocols/zigbee/pairing/stop`

**Authentication Required** (Admin only)

#### Response (200)
```json
{
  "success": true,
  "message": "Pairing mode disabled"
}
```

---

### Start Matter Commissioning
Start Matter device commissioning.

**POST** `/api/protocols/matter/commissioning`

**Authentication Required** (Admin only)

#### Response (200)
```json
{
  "success": true,
  "qrCode": "MT:...",
  "manualPairingCode": "34970112332"
}
```

---

## Metrics Endpoint

### Get Prometheus Metrics
Get Prometheus-formatted metrics.

**GET** `/metrics`

**No Authentication Required**

#### Response (200)
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/devices",status_code="200"} 150

# HELP smart_home_devices_total Total number of registered devices
# TYPE smart_home_devices_total gauge
smart_home_devices_total{protocol="zigbee",type="light",status="online"} 5
```

---

## WebSocket Events

Connect to WebSocket for real-time updates.

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

#### `device:state_changed`
Device state has changed.
```javascript
socket.on('device:state_changed', (data) => {
  console.log(data);
  // {
  //   deviceId: 'uuid',
  //   state: { on: true, brightness: 255 },
  //   timestamp: '2024-01-01T12:00:00.000Z'
  // }
});
```

#### `device:registered`
New device registered.
```javascript
socket.on('device:registered', (device) => {
  console.log('New device:', device);
});
```

#### `device:online` / `device:offline`
Device connectivity changed.
```javascript
socket.on('device:online', (data) => {
  console.log('Device online:', data.deviceId);
});
```

#### `automation:triggered`
Automation was triggered.
```javascript
socket.on('automation:triggered', (data) => {
  console.log('Automation triggered:', data.automationId);
});
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Window**: 15 minutes
- **Max Requests**: 100 per window (adjustable)
- **Headers**:
  - `X-RateLimit-Limit`: Total limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (Unix timestamp)

---

## Pagination

Endpoints that return lists support pagination:

### Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc`

### Response Format
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `AUTH_INVALID` | Invalid credentials |
| `AUTH_EXPIRED` | Token expired |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Input validation failed |
| `DEVICE_OFFLINE` | Device is offline |
| `DEVICE_UNAVAILABLE` | Device unavailable |
| `AUTOMATION_FAILED` | Automation execution failed |
| `PROTOCOL_ERROR` | Protocol communication error |

---

## Best Practices

1. **Authentication**: Always include the JWT token in the `Authorization` header
2. **Error Handling**: Check response status and handle errors appropriately
3. **Rate Limiting**: Respect rate limits and implement backoff strategies
4. **WebSockets**: Use WebSocket for real-time updates instead of polling
5. **Validation**: Validate input on client-side before sending to API
6. **Pagination**: Use pagination for large datasets
7. **Caching**: Cache responses when appropriate
8. **HTTPS**: Always use HTTPS in production

---

## SDK Examples

### JavaScript/TypeScript
```javascript
const API_BASE = 'http://localhost:3000/api';

class SmartHomeAPI {
  constructor(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getDevices() {
    return this.request('/devices');
  }

  async controlDevice(deviceId, command, value) {
    return this.request(`/devices/${deviceId}/control`, {
      method: 'POST',
      body: JSON.stringify({ command, value }),
    });
  }
}

// Usage
const api = new SmartHomeAPI('your-jwt-token');
const devices = await api.getDevices();
```

### Python
```python
import requests

class SmartHomeAPI:
    def __init__(self, token, base_url='http://localhost:3000/api'):
        self.token = token
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def get_devices(self):
        response = requests.get(
            f'{self.base_url}/devices',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def control_device(self, device_id, command, value):
        response = requests.post(
            f'{self.base_url}/devices/{device_id}/control',
            headers=self.headers,
            json={'command': command, 'value': value}
        )
        response.raise_for_status()
        return response.json()

# Usage
api = SmartHomeAPI('your-jwt-token')
devices = api.get_devices()
```

---

## Support

For issues, questions, or feature requests:
- **GitHub**: [Issues](https://github.com/yourusername/SmartHomeHUB2025/issues)
- **Documentation**: `/docs` folder
- **Email**: support@smarthomehub.example.com
