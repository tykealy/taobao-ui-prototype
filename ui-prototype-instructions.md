# Taobao API UI Prototype - Instructions for AI Agent

## Objective

Build a simple, functional UI prototype to demonstrate and test the Taobao API endpoints. The UI should be clean, intuitive, and allow users to easily interact with all available API endpoints.

## Technology Stack

- **HTML** for structure
- **Vanilla CSS** for styling (modern, clean design)
- **JavaScript** for API interactions
- **No external frameworks required** (keep it simple)

## Design Requirements

### Visual Design
- Modern, clean interface with a professional look
- Use a card-based layout for different API endpoints
- Include proper spacing, padding, and visual hierarchy
- Responsive design (works on desktop and mobile)
- Color scheme: Use a modern palette (e.g., blues and whites for a clean tech look)
- Include loading states and error messages

### User Experience
- Clear labels for all input fields
- Helpful placeholder text
- Visual feedback for API calls (loading spinners)
- Display results in a readable format (formatted JSON or cards)
- Error messages should be user-friendly and visible

## API Endpoints to Implement

Based on `taobao-api.md`, implement UI for these three endpoints:

### 1. Item Search
- **Endpoint**: `GET /api/v1/taobao/item-search`
- **Required Input**: 
  - Keyword (text input)
- **Optional Inputs**:
  - Language (dropdown: en, zh, km)
  - Page Number (number input, default: 1)
  - Page Size (number input, default: 20)

### 2. Item Detail
- **Endpoint**: `GET /api/v1/taobao/item-detail`
- **Required Input**:
  - Item ID (text input)
- **Optional Inputs**:
  - Item Resource (dropdown: taobao, tmall)
  - Language (dropdown: en, zh, km)

### 3. Recommend Similar Product
- **Endpoint**: `GET /api/v1/taobao/recommend-product`
- **Required Input** (at least one):
  - Image URL (text input)
  - Item ID (text input)
  - Image ID (text input)

## Implementation Structure

### File Organization
```
/
├── index.html          # Main HTML file
├── style.css           # Styling
└── script.js           # JavaScript for API calls
```

### HTML Structure
Create a single-page application with:
1. **Header Section**
   - Title: "Taobao API Prototype"
   - Subtitle explaining the purpose
   - API Key input field (to be stored and used for all requests)

2. **API Endpoint Sections** (3 separate cards/sections)
   - Section 1: Item Search
   - Section 2: Item Detail
   - Section 3: Recommend Similar Product

3. **Results Section**
   - Display area for API responses
   - Toggle between formatted JSON and raw JSON views

### CSS Styling Guidelines
- Use CSS Grid or Flexbox for layout
- Card-based design with subtle shadows
- Input fields with clear labels above them
- Buttons with hover states
- Loading spinner/indicator
- Success (green) and error (red) message styling
- Responsive breakpoints for mobile devices

### JavaScript Functionality

#### API Configuration
```javascript
// Store API key
let apiKey = '';

// Base URL (use relative path for local testing)
const BASE_URL = '/api/v1/taobao';
```

#### Core Functions to Implement
1. **Authentication Handler**
   - Store API key from input
   - Include API key in all requests via `X-API-Key` header

2. **API Call Function**
   - Generic fetch function that handles:
     - Headers (including X-API-Key)
     - Query parameters
     - Error handling
     - Loading states

3. **Item Search Handler**
   - Collect form inputs
   - Build query parameters
   - Make API call
   - Display results

4. **Item Detail Handler**
   - Collect form inputs
   - Build query parameters
   - Make API call
   - Display results

5. **Recommend Product Handler**
   - Collect form inputs
   - Validate at least one parameter is provided
   - Build query parameters
   - Make API call
   - Display results

#### Error Handling
- Display clear error messages for:
  - Missing API key
  - Missing required fields
  - 400 Bad Request
  - 401 Unauthorized
  - 500 Internal Server Error
  - Network errors

#### Response Display
- Show loading indicator while fetching
- Display success responses in formatted JSON
- Highlight error responses in red
- Add a "Copy to Clipboard" button for responses

## Example Code Snippets

### Fetch Function Template
```javascript
async function callTaobaoAPI(endpoint, params) {
  if (!apiKey) {
    displayError('Please enter an API key first');
    return;
  }

  showLoading();
  
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      displaySuccess(data);
    } else {
      displayError(data.message);
    }
  } catch (error) {
    displayError(`Network error: ${error.message}`);
  } finally {
    hideLoading();
  }
}
```

## Features to Include

### Must-Have Features
- [ ] API Key input and storage
- [ ] Three separate sections for each endpoint
- [ ] Form inputs for all parameters
- [ ] Submit buttons for each endpoint
- [ ] Loading indicators
- [ ] Response display area
- [ ] Error message display
- [ ] Basic validation (required fields)

### Nice-to-Have Features
- [ ] Copy response to clipboard
- [ ] Toggle between formatted and raw JSON
- [ ] Clear results button
- [ ] Request history (last 5 requests)
- [ ] Dark mode toggle
- [ ] Save API key to localStorage
- [ ] Collapsible endpoint sections

## Testing Instructions

After building the UI, test the following scenarios:

1. **Without API Key**
   - Try to make a request without entering API key
   - Should show error message

2. **Item Search**
   - Search for "macbook" with default settings
   - Search with different languages
   - Search with different page sizes

3. **Item Detail**
   - Get details for a valid item ID
   - Try with invalid item ID (should show error)

4. **Recommend Product**
   - Test with image URL
   - Test with item ID
   - Test without any parameters (should show validation error)

5. **Error Handling**
   - Test with wrong API key (should show 401 error)
   - Test with missing required fields (should show validation error)

## Development Notes

- Use `http://localhost:3000` as the base URL when running locally
- The API is already running on `npm run dev` (as shown in metadata)
- All endpoints require authentication via `X-API-Key` header
- All responses follow the same format: `{ success, message, data }`
- Keep the UI simple and focused on functionality over aesthetics

## Deliverables

1. **index.html** - Complete HTML structure
2. **style.css** - All styling rules
3. **script.js** - All JavaScript functionality

The final UI should be a working prototype that demonstrates all three API endpoints and makes it easy to test the Taobao API functionality.
