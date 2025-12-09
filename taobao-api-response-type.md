# Product API Response Reference for Frontend

This guide explains the response structures for three key product APIs to help you build your frontend application.

---

## 1. Product Search (`queryAllProduct`)

**API**: Query product details by item ID  
**Type**: `QueryAllProductResponse`  
**Location**: `src/types/product-sourcing/query-all-product.ts`

### Response Structure

```typescript
{
  type: string;
  code: string;
  message: string;
  body: {
    data: ProductData;
    success: boolean;
    code: string;
    request_id: string;
  };
}
```

### ProductData Fields

#### Core Identity
- `mp_id` (string) - Marketplace product ID (primary identifier)
- `item_id` (number) - Internal item ID
- `shop_id` (number) - Shop identifier
- `shop_name` (string) - Shop display name

#### Product Information
- `title` (string) - Product title/name
- `description` (string) - Product description
- `status` (string) - Product status (e.g., "active")
- `item_type` (string) - Item type (e.g., "HAVE_MATERIAL")

#### Category
- `category_id` (string) - Category identifier
- `category_name` (string) - Category display name
- `category_path` (string) - Full category path

#### Pricing
- `price` (number) - Base price
- `promotion_price` (number) - Promotional price
- `coupon_price` (number) - Coupon discounted price
- `begin_amount` (number) - Minimum order amount

#### Inventory
- `quantity` (number) - Total available quantity

#### Media
- `pic_urls` (string[]) - Array of product image URLs

#### Promotions
```typescript
promotion_displays: Array<{
  type_name: string;
  promotion_info_list: Array<{
    promotion_name: string;
    activity_code: string;
  }>;
}>
```

#### SKU List
```typescript
sku_list: Array<{
  mp_skuId: number;        // Marketplace SKU ID (use this)
  sku_id: number;          // Internal SKU ID
  quantity: number;        // SKU-specific inventory
  price: number;           // SKU base price
  promotion_price: number; // SKU promotion price
  coupon_price: number;    // SKU coupon price
  postFee: number;         // Shipping fee for this SKU
  pic_url: string;         // SKU-specific image
  status: string;          // SKU status
  properties: Array<{
    prop_name: string;     // Property name (e.g., "Color")
    prop_id: number;       // Property ID
    value_id: number;      // Value ID
    value_name: string;    // Value name (e.g., "Red")
  }>;
}>
```

### Frontend Usage Tips

**Display Price**:
```typescript
const displayPrice = product.promotion_price || product.price;
const hasCoupon = product.coupon_price > 0;
```

**Product Card**:
```typescript
{
  id: data.mp_id,
  title: data.title,
  image: data.pic_urls[0],
  price: data.promotion_price || data.price,
  originalPrice: data.promotion_price ? data.price : undefined,
  shopName: data.shop_name,
  inStock: data.quantity > 0
}
```

**Promotion Badges**:
```typescript
const badges = data.promotion_displays.flatMap(
  display => display.promotion_info_list.map(
    promo => promo.promotion_name
  )
);
```

---

## 2. Get Product Detail with MP IDs (`getProductWithMpIds`)

**API**: Get enhanced product details with multi-language support  
**Type**: `GetProductWithMpIdsResponse`  
**Location**: `src/types/product-sourcing/get-product-with-mp-ids.ts`

### Response Structure

```typescript
{
  success: boolean;
  data: EnhancedProductData | null;
  source: "full" | "query-all-only";
  error?: string;
  warning?: string;
}
```

### EnhancedProductData (extends ProductData)

Includes all fields from `ProductData` above, plus:

#### Property Images
```typescript
property_image_list?: Array<{
  image_url: string;   // Image URL for this property combination
  properties: string;  // Property combination string
}>
```

#### Product Properties
```typescript
properties?: Array<{
  prop_name: string;   // Property name (e.g., "Material")
  prop_id: number;     // Property ID
  value_id: number;    // Value ID
  value_name: string;  // Value display name
  value_desc?: string; // Optional value description
}>
```

#### Multi-Language Information
```typescript
multi_language_info?: {
  language: string;           // Language code (e.g., "en")
  title: string;              // Translated title
  main_image_url: string;     // Localized main image
  properties: Array<{         // Translated properties
    prop_name: string;
    prop_id: number;
    value_id: number;
    value_name: string;
    value_desc?: string;
  }>;
  sku_properties: Array<{     // Translated SKU properties
    sku_id: number;
    properties: Array<{
      prop_name: string;
      prop_id: number;
      value_id: number;
      value_name: string;
      value_desc: string;
    }>;
  }>;
}
```

#### Additional Fields
- `tags?: unknown[]` - Product tags
- `item_resource?: string` - Item resource identifier

### Frontend Usage Tips

**Detailed Product Page**:
```typescript
const product = response.data;
if (!product) return null;

// Use translated content if available
const displayTitle = product.multi_language_info?.title || product.title;
const displayProperties = product.multi_language_info?.properties || product.properties;

// Build variant selector
const variants = product.sku_list.map(sku => {
  const mlProps = product.multi_language_info?.sku_properties
    .find(sp => sp.sku_id === sku.sku_id)?.properties;
  
  return {
    id: sku.mp_skuId,
    properties: mlProps || sku.properties,
    price: sku.promotion_price || sku.price,
    image: sku.pic_url,
    inStock: sku.quantity > 0
  };
});
```

**Property Images Gallery**:
```typescript
const propertyImages = product.property_image_list?.map(item => ({
  url: item.image_url,
  variant: item.properties
})) || [];
```

**Data Source Check**:
```typescript
if (response.source === "query-all-only") {
  // Fallback data - some enhanced fields may be missing
  console.warn(response.warning);
}
```

---

## 3. Recommend Similar Product (`recommendSimilarProduct`)

**API**: Get similar product recommendations  
**Type**: `RecommendSimilarProductResponse`  
**Location**: `src/types/product-sourcing/recommend-similar-product.ts`

### Response Structure

```typescript
{
  body: {
    data: {
      // Product fields
    };
    success: boolean;
    error_code: string;
    error_msg: string;
  };
}
```

### Product Fields

#### Core Identity
- `mp_id` (string) - Marketplace product ID
- `item_id` (string) - Item ID
- `shop_id` (number) - Shop ID
- `shop_name` (string) - Shop name

#### Product Information
- `title` (string) - Product title
- `description` (string) - Product description
- `status` (string) - Product status
- `item_type` (string) - Item type

#### Category
- `category_id` (string) - Category ID
- `category_name` (string) - Category name
- `category_path` (string) - Category path

#### Pricing
- `price` (number) - Base price
- `promotion_price` (number) - Promotional price

#### Inventory
- `quantity` (number) - Total quantity

#### Media
- `pic_urls` (string[]) - Product image URLs
- `video_url` (string) - Product video URL (if available)

#### SKU List
```typescript
sku_list: Array<{
  mp_sku_id: string;       // Marketplace SKU ID (note: string type)
  sku_id: number;          // Internal SKU ID
  quantity: number;        // SKU inventory
  price: number;           // SKU price
  promotion_price: number; // SKU promotion price
  post_fee: number;        // Shipping fee (note: snake_case)
  pic_url: string;         // SKU image
  status: string;          // SKU status
  properties: Array<{
    prop_name: string;
    prop_id: number;
    value_id: number;
    value_name: string;
  }>;
}>
```

### Frontend Usage Tips

**Recommendation Card**:
```typescript
const recommendation = response.body.data;

{
  id: recommendation.mp_id,
  title: recommendation.title,
  image: recommendation.pic_urls[0],
  video: recommendation.video_url,
  price: recommendation.promotion_price || recommendation.price,
  shopName: recommendation.shop_name,
  inStock: recommendation.quantity > 0
}
```

**Video Support**:
```typescript
const hasVideo = recommendation.video_url && recommendation.video_url !== '';
```

---

## Common Patterns Across All APIs

### Price Display Logic
```typescript
function formatPrice(item: { price: number; promotion_price?: number }) {
  const hasPromotion = item.promotion_price && item.promotion_price < item.price;
  
  return {
    current: hasPromotion ? item.promotion_price : item.price,
    original: hasPromotion ? item.price : undefined,
    discount: hasPromotion 
      ? Math.round((1 - item.promotion_price / item.price) * 100) 
      : 0
  };
}
```

### Stock Status
```typescript
function getStockStatus(quantity: number) {
  if (quantity === 0) return 'out-of-stock';
  if (quantity < 10) return 'low-stock';
  return 'in-stock';
}
```

### Variant Builder
```typescript
function buildVariants(sku_list: ProductSkuItem[]) {
  // Group by property type
  const propertyGroups = new Map<string, Set<string>>();
  
  sku_list.forEach(sku => {
    sku.properties.forEach(prop => {
      if (!propertyGroups.has(prop.prop_name)) {
        propertyGroups.set(prop.prop_name, new Set());
      }
      propertyGroups.get(prop.prop_name)!.add(prop.value_name);
    });
  });
  
  return Array.from(propertyGroups.entries()).map(([name, values]) => ({
    name,
    options: Array.from(values)
  }));
}
```

### Image Handling
```typescript
function getProductImages(product: ProductData) {
  const mainImages = product.pic_urls || [];
  const skuImages = product.sku_list
    ?.map(sku => sku.pic_url)
    .filter(Boolean) || [];
  
  return [...new Set([...mainImages, ...skuImages])];
}
```

---

## Type Differences to Note

| Field | queryAllProduct | getProductWithMpIds | recommendSimilar |
|-------|----------------|---------------------|------------------|
| `mp_id` type | string | string | string |
| `item_id` type | number | number | string |
| `mp_skuId` type | number | number | string |
| Shipping fee | `postFee` | `postFee` | `post_fee` |
| Coupon price | ✅ Yes | ✅ Yes | ❌ No |
| Video URL | ❌ No | ❌ No | ✅ Yes |
| Multi-language | ❌ No | ✅ Yes | ❌ No |
| Property images | ❌ No | ✅ Yes | ❌ No |
| Promotion displays | ✅ Yes | ✅ Yes | ❌ No |

---

## Error Handling

### Check Success
```typescript
// queryAllProduct & getProductWithMpIds
if (!response.body.success) {
  console.error('API Error:', response.body.code);
  return;
}

// recommendSimilarProduct
if (!response.body.success) {
  console.error('API Error:', response.body.error_code, response.body.error_msg);
  return;
}
```

### Null Data Handling
```typescript
// getProductWithMpIds can return null data
const product = response.data;
if (!product) {
  console.error('No product data:', response.error);
  return;
}
```

---

## Complete Frontend Model Example

```typescript
// Unified product model for your frontend
interface FrontendProduct {
  id: string;
  title: string;
  description: string;
  images: string[];
  video?: string;
  
  price: {
    current: number;
    original?: number;
    coupon?: number;
  };
  
  shop: {
    id: number;
    name: string;
  };
  
  category: {
    id: string;
    name: string;
    path: string;
  };
  
  inventory: {
    total: number;
    status: 'in-stock' | 'low-stock' | 'out-of-stock';
  };
  
  variants: Array<{
    id: string;
    properties: Record<string, string>;
    price: number;
    image?: string;
    stock: number;
    shippingFee: number;
  }>;
  
  promotions?: string[];
  tags?: unknown[];
}

// Mapper from API responses
function mapToFrontendProduct(
  apiData: ProductData | EnhancedProductData,
  source: 'search' | 'detail' | 'recommendation'
): FrontendProduct {
  return {
    id: apiData.mp_id,
    title: apiData.title,
    description: apiData.description,
    images: apiData.pic_urls,
    video: 'video_url' in apiData ? apiData.video_url : undefined,
    
    price: {
      current: apiData.promotion_price || apiData.price,
      original: apiData.promotion_price ? apiData.price : undefined,
      coupon: 'coupon_price' in apiData ? apiData.coupon_price : undefined,
    },
    
    shop: {
      id: apiData.shop_id,
      name: apiData.shop_name,
    },
    
    category: {
      id: apiData.category_id,
      name: apiData.category_name,
      path: apiData.category_path,
    },
    
    inventory: {
      total: apiData.quantity,
      status: getStockStatus(apiData.quantity),
    },
    
    variants: apiData.sku_list.map(sku => ({
      id: String(sku.mp_skuId || sku.mp_sku_id),
      properties: Object.fromEntries(
        sku.properties.map(p => [p.prop_name, p.value_name])
      ),
      price: sku.promotion_price || sku.price,
      image: sku.pic_url,
      stock: sku.quantity,
      shippingFee: sku.postFee || sku.post_fee || 0,
    })),
    
    promotions: 'promotion_displays' in apiData 
      ? apiData.promotion_displays?.flatMap(d => 
          d.promotion_info_list.map(p => p.promotion_name)
        )
      : undefined,
    
    tags: 'tags' in apiData ? apiData.tags : undefined,
  };
}
```

---

## Quick Reference Card

### Which API to Use?

- **Search/Browse** → `queryAllProduct` - Basic product data with promotions
- **Product Detail Page** → `getProductWithMpIds` - Enhanced data with translations
- **Related Products** → `recommendSimilarProduct` - Similar items with video support

### Must-Have Frontend Fields
- `mp_id` - Always use this as primary product identifier
- `mp_skuId` / `mp_sku_id` - Use for SKU identification
- `promotion_price || price` - For accurate pricing display
- `quantity` - For stock status
- `sku_list[].properties` - For variant selectors

---

This document covers all response structures you'll need for building a complete e-commerce frontend with product search, detail pages, and recommendations.

