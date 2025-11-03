# Data Router

A JSON-configured database query router with automatic API generation for PostgreSQL.

> In layman's terms, you can create API endpoints for exposing data from a Postgres DB.

## Why?

I used this to create internal endpoints that would expose data from a DB through APIs, mostly for debugging & analytics purposes.

> [!WARNING]  
> **Lot of the code was written by AI (Claude)**, this was an experiment and I didn't want to spend hours writing this.
>
> If you're wondering this works; yes, it works fine.

Over to you Claude.

---

## Features

- 🚀 **Zero-code API generation** from JSON configuration
- 🔒 **API key authentication** support
- 📄 **Built-in pagination** with configurable limits
- 🔄 **Response transformation** (camelCase/snake_case)
- 🧠 **In-memory caching** with configurable TTL
- 🛡️ **SQL injection protection** with parameterized queries
- 🌐 **CORS support** with configurable origins
- ⚡ **High performance** with Bun runtime
- 🔍 **Query validation** to prevent unsafe operations
- 📊 **Read-only operations** for data safety

## Quick Start

### Installation

```bash
git clone https://github.com/arjunkomath/data-router.git
cd data-router
bun install
```

### Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Set your environment variables:
```bash
DATABASE_URL=postgres://username:password@localhost:5432/database
PORT=3000
API_KEY=your-secret-api-key
```

3. Configure your routes in `config/routes.json` (see example below)

### Running

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun start

# Build for production
bun run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `PORT` | ❌ | Server port (default: 3000) |
| `API_KEY` | ❌ | API key for authenticated routes (comma-separated for multiple keys) |

### Route Configuration

Create a `config/routes.json` file to define your API endpoints:

```json
{
  "routes": [
    {
      "path": "/users",
      "method": "GET",
      "query": "SELECT id, name, email FROM users WHERE active = true",
      "description": "Get all active users",
      "cache": {
        "type": "memory",
        "ttl": 60
      },
      "pagination": {
        "enabled": true,
        "defaultLimit": 20,
        "maxLimit": 100
      },
      "response": {
        "transform": "camelCase",
        "exclude": ["password"]
      }
    },
    {
      "path": "/users/:id",
      "method": "GET",
      "query": "SELECT * FROM users WHERE id = $1",
      "params": ["id"],
      "description": "Get user by ID",
      "auth": {
        "required": true,
        "type": "apikey",
        "header": "x-api-key"
      }
    }
  ],
  "global": {
    "cors": {
      "origins": ["http://localhost:3000"],
      "credentials": true
    }
  }
}
```

## Route Configuration Options

### Basic Route Properties

- `path`: API endpoint path (supports `:param` placeholders)
- `method`: HTTP method (currently supports `GET` only)
- `query`: SQL query to execute (SELECT statements only)
- `params`: Array of parameter names for path placeholders
- `description`: Optional description for documentation

### Authentication

```json
{
  "auth": {
    "required": true,
    "type": "apikey",
    "header": "x-api-key"
  }
}
```

- `required`: Whether authentication is required
- `type`: Authentication type (`apikey` only)
- `header`: Header name for the API key (default: `x-api-key`)

### Pagination

```json
{
  "pagination": {
    "enabled": true,
    "defaultLimit": 20,
    "maxLimit": 100,
    "type": "offset"
  }
}
```

- `enabled`: Enable pagination for this route
- `defaultLimit`: Default number of items per page
- `maxLimit`: Maximum allowed items per page
- `type`: Pagination type (`offset` only)

Query parameters:
- `?page=1` - Page number (starts from 1)
- `?limit=20` - Items per page

### Response Transformation

```json
{
  "response": {
    "transform": "camelCase",
    "exclude": ["password", "internal_id"],
    "include": ["id", "name", "email"],
    "wrapper": {
      "data": "results",
      "meta": "metadata",
      "success": "ok"
    }
  }
}
```

- `transform`: Transform field names (`camelCase`, `snake_case`, or `none`)
- `exclude`: Fields to remove from response
- `include`: Only include these fields (mutually exclusive with `exclude`)
- `wrapper`: Wrap response in custom object structure

### Caching

```json
{
  "cache": {
    "type": "memory",
    "ttl": 60
  }
}
```

- `type`: Cache backend (`memory` currently supported)
- `ttl`: Time-to-live in seconds

### Global Configuration

```json
{
  "global": {
    "cors": {
      "origins": ["http://localhost:3000", "*"],
      "credentials": true,
      "methods": ["GET", "OPTIONS"]
    },
    "errorHandler": {
      "includeStack": false,
      "includeQuery": true
    }
  }
}
```

## API Response Format

### Standard Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "2023-12-01T10:00:00.000Z",
    "rowCount": 5,
    "query": "Get all users"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "2023-12-01T10:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Route not found",
    "code": "ROUTE_NOT_FOUND"
  },
  "meta": {
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

## Security

### SQL Injection Prevention

- Only `SELECT` and `WITH` statements are allowed
- All queries use parameterized statements
- Dangerous keywords are blocked (`DROP`, `CREATE`, `INSERT`, etc.)

### Authentication

- API key authentication via headers
- Support for multiple API keys (comma-separated in env)
- Per-route authentication configuration

## Examples

### Basic User Listing

```bash
curl http://localhost:3000/users
```

### Paginated Results

```bash
curl "http://localhost:3000/users?page=2&limit=10"
```

### Authenticated Request

```bash
curl -H "x-api-key: your-secret-key" http://localhost:3000/admin/users
```

### Path Parameters

```bash
curl http://localhost:3000/users/123
```

## Health Check

The server includes a built-in health check endpoint that doesn't require configuration:

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

**Response (Healthy)**:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "database": {
    "connected": true
  },
  "uptime": 42.5
}
```

**Response (Unhealthy)**:
```json
{
  "status": "unhealthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "database": {
    "connected": false
  },
  "uptime": 42.5
}
```

- **HTTP 200**: Service is healthy and database is connected
- **HTTP 503**: Service is unhealthy (database connection failed)
- **No authentication required**
- **CORS enabled**
- **Always available** (bypasses route configuration)

## Development

### Project Structure

```
db-router/
├── src/
│   ├── api/           # Request handlers and middleware
│   ├── config/        # Configuration parser and validator
│   ├── database/      # Database connection and query execution
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── index.ts       # Main server entry point
├── config/
│   └── routes.json    # Route configuration
└── README.md
```

### Type Safety

The entire codebase is written in TypeScript with strict type checking enabled. Configuration is validated using Zod schemas.

### Error Handling

- Comprehensive error handling at all levels
- Structured error responses
- Optional stack trace inclusion for debugging

## Roadmap

- [ ] Query result caching with Redis
- [ ] Rate limiting
- [ ] Auto-generated OpenAPI documentation
