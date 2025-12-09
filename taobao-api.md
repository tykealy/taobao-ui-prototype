WE're planning to buid an api that support the following features:

- [ x ] Item search
- [ x ] Item detail
- [ x ] Recommend product
- [ ] Create purchase order
- [ ] REceive payment
- [ ] Load Orders for users

Curent we have completely implemented the following features functionality:

- [ x ] Item search : /api/v1/taobao/item-search, /controllers/v1/(taobao)/item-search-controller.ts
- [ x ] Item detail : /api/v1/taobao/item-detail, /controllers/v1/(taobao)/item-detail-controller.ts
- [ x ] Recommend product : /api/v1/taobao/recommend-product, /controllers/v1/(taobao)/recommend-product-controller.ts

## Authentication

All Taobao API endpoints require API key authentication. The API key must be included in the request headers.

### Client Request Format

Include the API key in the `X-API-Key` header:

```
GET /api/v1/item-search?keyword=macbook
Headers:
  X-API-Key: your-api-key-here
```

### Server Configuration

The API key is configured via the `TAOBAO_API_KEY` environment variable. This should be set to a secure random string (minimum 32 characters recommended).

**Important**: Never commit the API key to version control. Store it securely in your environment configuration.

### Implementation

The API key authentication is handled by `handleApiKeyRoute` in `/src/lib/handle-api-route.ts`. This handler:

- Extracts the API key from the `X-API-Key` header
- Validates it against the `TAOBAO_API_KEY` environment variable
- Returns `401 Unauthorized` if the key is missing or invalid
- Proceeds with the request if the key is valid

All three implemented endpoints use this authentication method:

- `/api/v1/taobao/item-search` - Requires API key
- `/api/v1/taobao/item-detail` - Requires API key
- `/api/v1/taobao/recommend-product` - Requires API key

## API Endpoints

### 1. Item Search

Search for items on Taobao by keyword.

**Endpoint**: `GET /api/v1/taobao/item-search`

**Description**: Searches for products on Taobao using a keyword query. Returns paginated results with product information.

**Authentication**: Required (API key in `X-API-Key` header)

#### Request Parameters

| Parameter   | Type   | Required | Default | Description                                               |
| ----------- | ------ | -------- | ------- | --------------------------------------------------------- |
| `keyword`   | string | Yes      | -       | Search keyword for products                               |
| `language`  | string | No       | `"en"`  | Response language (e.g., "en", "zh", "km")                |
| `page_no`   | string | No       | `"1"`   | Page number for pagination (will be converted to integer) |
| `page_size` | string | No       | `"20"`  | Number of items per page (will be converted to integer)   |

#### Example Request

**cURL**:

```bash
curl -X GET "https://your-domain.com/api/v1/taobao/item-search?keyword=macbook&language=en&page_no=1&page_size=20" \
  -H "X-API-Key: your-api-key-here"
```

**JavaScript (fetch)**:

```javascript
const response = await fetch(
  "https://your-domain.com/api/v1/taobao/item-search?keyword=macbook&language=en&page_no=1&page_size=20",
  {
    method: "GET",
    headers: {
      "X-API-Key": "your-api-key-here",
    },
  }
);

const data = await response.json();
```

#### Example Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    // Taobao SDK response data structure
  }
}
```

#### Error Responses

**400 Bad Request** - Missing required parameter:

```json
{
  "success": false,
  "message": "Keyword is required",
  "data": null
}
```

**401 Unauthorized** - Invalid or missing API key:

```json
{
  "success": false,
  "message": "Unauthorized - Invalid API key",
  "data": null
}
```

---

### 2. Item Detail

Get detailed information about a specific Taobao item.

**Endpoint**: `GET /api/v1/taobao/item-detail`

**Description**: Retrieves detailed product information including description, images, pricing, and specifications for a specific item ID.

**Authentication**: Required (API key in `X-API-Key` header)

#### Request Parameters

| Parameter       | Type   | Required | Default    | Description                                  |
| --------------- | ------ | -------- | ---------- | -------------------------------------------- |
| `id`            | string | Yes      | -          | Taobao item ID                               |
| `item_resource` | string | No       | `"taobao"` | Item resource type (e.g., "taobao", "tmall") |
| `language`      | string | No       | `"en"`     | Response language (e.g., "en", "zh", "km")   |

#### Example Request

**cURL**:

```bash
curl -X GET "https://your-domain.com/api/v1/taobao/item-detail?id=123456789&item_resource=taobao&language=en" \
  -H "X-API-Key: your-api-key-here"
```

**JavaScript (fetch)**:

```javascript
const response = await fetch(
  "https://your-domain.com/api/v1/taobao/item-detail?id=123456789&item_resource=taobao&language=en",
  {
    method: "GET",
    headers: {
      "X-API-Key": "your-api-key-here",
    },
  }
);

const data = await response.json();
```

#### Example Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    // Taobao SDK response data structure with item details
  }
}
```

#### Error Responses

**400 Bad Request** - Missing required parameter:

```json
{
  "success": false,
  "message": "Item ID is required",
  "data": null
}
```

**401 Unauthorized** - Invalid or missing API key:

```json
{
  "success": false,
  "message": "Unauthorized - Invalid API key",
  "data": null
}
```

---

### 3. Recommend Similar Product

Get product recommendations based on an image URL, item ID, or image ID.

**Endpoint**: `GET /api/v1/taobao/recommend-product`

**Description**: Returns similar or recommended products based on visual similarity. Requires at least one of: image URL, item ID, or image ID.

**Authentication**: Required (API key in `X-API-Key` header)

#### Request Parameters

| Parameter | Type   | Required | Default | Description                                      |
| --------- | ------ | -------- | ------- | ------------------------------------------------ |
| `img_url` | string | No\*     | -       | URL of the product image to search similar items |
| `itemId`  | string | No\*     | -       | Taobao item ID to find similar products          |
| `imageId` | string | No\*     | -       | Image ID to search similar products              |

\* At least one of `img_url`, `itemId`, or `imageId` must be provided.

#### Example Request

**cURL** - Using image URL:

```bash
curl -X GET "https://your-domain.com/api/v1/taobao/recommend-product?img_url=https://example.com/product.jpg" \
  -H "X-API-Key: your-api-key-here"
```

**cURL** - Using item ID:

```bash
curl -X GET "https://your-domain.com/api/v1/taobao/recommend-product?itemId=123456789" \
  -H "X-API-Key: your-api-key-here"
```

**JavaScript (fetch)** - Using image URL:

```javascript
const response = await fetch(
  "https://your-domain.com/api/v1/taobao/recommend-product?img_url=https://example.com/product.jpg",
  {
    method: "GET",
    headers: {
      "X-API-Key": "your-api-key-here",
    },
  }
);

const data = await response.json();
```

**JavaScript (fetch)** - Using item ID:

```javascript
const response = await fetch(
  "https://your-domain.com/api/v1/taobao/recommend-product?itemId=123456789",
  {
    method: "GET",
    headers: {
      "X-API-Key": "your-api-key-here",
    },
  }
);

const data = await response.json();
```

#### Example Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    // Taobao SDK response data structure with recommended products
  }
}
```

#### Error Responses

**400 Bad Request** - Missing all required parameters:

```json
{
  "success": false,
  "message": "At least one of imgUrl, itemId, or imageId is required",
  "data": null
}
```

**401 Unauthorized** - Invalid or missing API key:

```json
{
  "success": false,
  "message": "Unauthorized - Invalid API key",
  "data": null
}
```

**500 Internal Server Error** - Service error:

```json
{
  "success": false,
  "message": "Failed to recommend similar product",
  "data": null
}
```

---

## Response Format

All endpoints follow a consistent response format:

### Success Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    /* endpoint-specific data */
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "data": null
}
```

## HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid request parameters or missing required fields
- `401 Unauthorized` - Missing or invalid API key
- `500 Internal Server Error` - Server error or third-party API failure
