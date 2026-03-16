# HTTP Service Usage Guide

## Overview

The HTTP service provides a centralized way to make API calls with automatic bearer token management.

## Configuration

Set your API base URL and logging in `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_API_LOG_REQUESTS=true
```

### Environment Variables

- `VITE_API_BASE_URL`: Your backend API base URL (default: `http://localhost:3001/api`)
- `VITE_API_LOG_REQUESTS`: Set to `true` to enable console logging of all API requests and responses (default: `false`)

### API Request Logging

When `VITE_API_LOG_REQUESTS=true`, the service will log:
- **Request URL**: Full endpoint URL
- **Request Body**: JSON payload (formatted)
- **Request Headers**: Headers (Authorization token is masked as `Bearer ***`)
- **Response Status**: HTTP status code and text
- **Response Data**: Response body (formatted JSON)

Example console output:
```
🔵 API Request: POST http://localhost:3001/api/auth/login
  📤 Request URL: http://localhost:3001/api/auth/login
  📦 Request Body: {
    "identifier": "admin@hope.com",
    "password": "password123"
  }
  📋 Request Headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ***"
  }

🟢 API Response: POST http://localhost:3001/api/auth/login
  ✅ Status: 200 OK
  📥 Response Data: {
    "accessToken": "eyJhbGc...",
    "user": { ... }
  }
```

## Basic Usage

### Import the service

```typescript
import httpService from "@/services/httpService";
// or
import { httpService } from "@/services/httpService";
```

### GET Request

```typescript
try {
  const response = await httpService.get("/users");
  console.log(response.data); // Response data
} catch (error) {
  console.error(error.message); // Error message
}
```

### POST Request

```typescript
try {
  const response = await httpService.post("/users", {
    name: "John Doe",
    email: "john@example.com",
  });
  console.log(response.data);
} catch (error) {
  console.error(error.message);
}
```

### PUT Request

```typescript
try {
  const response = await httpService.put("/users/123", {
    name: "Jane Doe",
  });
  console.log(response.data);
} catch (error) {
  console.error(error.message);
}
```

### DELETE Request

```typescript
try {
  const response = await httpService.delete("/users/123");
  console.log(response.data);
} catch (error) {
  console.error(error.message);
}
```

### With Query Parameters

```typescript
const response = await httpService.get("/users", {
  params: {
    page: 1,
    limit: 10,
    search: "john",
  },
});
```

### With Custom Headers

```typescript
const response = await httpService.get("/users", {
  headers: {
    "X-Custom-Header": "value",
  },
});
```

### File Upload

```typescript
// Single file
const file = document.querySelector('input[type="file"]').files[0];
const response = await httpService.uploadFile("/upload", file);

// Multiple files with FormData
const formData = new FormData();
formData.append("file1", file1);
formData.append("file2", file2);
const response = await httpService.uploadFile("/upload", formData);
```

### Request Without Authentication

```typescript
const response = await httpService.requestWithoutAuth(
  "POST",
  "/public-endpoint",
  { data: "value" }
);
```

## Using Predefined API Endpoints

```typescript
import { authApi, userApi } from "@/services/api";

// Login
const loginResponse = await authApi.login({
  emailOrPhone: "user@example.com",
  password: "password123",
});

// Get current user
const user = await authApi.getCurrentUser();

// Update profile
await userApi.updateProfile("user-id", {
  name: "New Name",
});
```

## Error Handling

The service automatically handles:
- 401 Unauthorized: Clears auth data and redirects to login
- 403 Forbidden: Clears auth data and redirects to login
- Other errors: Throws error with message and status

```typescript
try {
  const response = await httpService.get("/protected-endpoint");
} catch (error) {
  if (error.status === 404) {
    console.log("Not found");
  } else if (error.status === 500) {
    console.log("Server error");
  } else {
    console.log(error.message);
  }
}
```

## Response Structure

```typescript
interface ApiResponse<T> {
  data: T;           // Response data
  status: number;    // HTTP status code
  statusText: string; // HTTP status text
  headers: Headers;   // Response headers
}
```

## Abort Controller (Request Cancellation)

```typescript
const controller = new AbortController();

// Make request
const promise = httpService.get("/users", {
  signal: controller.signal,
});

// Cancel request
controller.abort();
```
