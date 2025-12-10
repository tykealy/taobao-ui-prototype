export interface CartItem {
  id: string; // lineItemId
  itemId: string;
  skuId: string;
  quantity: number;
  // Additional fields for UI display (mocked since we don't have a real DB of items)
  title?: string;
  price?: number;
  pic_url?: string;
  sku_info?: string;
}

export interface Cart {
  items: CartItem[];
  totalQuantity: number;
}

// In-memory store: customerNumber -> CartItem[]
const cartStore: Record<string, CartItem[]> = {};
let nextLineItemId = 1;

function generateLineItemId(): string {
  return (nextLineItemId++).toString();
}

export const taobaoCartController = {
  async getCart(customerNumber: string): Promise<Cart> {
    const items = cartStore[customerNumber] || [];
    return {
      items,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  },

  async addToCart(
    customerNumber: string,
    data: { itemId: string; skuId: string; quantity: number }
  ): Promise<Cart> {
    if (!cartStore[customerNumber]) {
      cartStore[customerNumber] = [];
    }
    const cart = cartStore[customerNumber];

    // Check if item already exists
    const existingItem = cart.find(
      (item) => item.itemId === data.itemId && item.skuId === data.skuId
    );

    if (existingItem) {
      existingItem.quantity += data.quantity;
    } else {
      // Mock data that would normally come from DB/Product Service
      cart.push({
        id: generateLineItemId(),
        itemId: data.itemId,
        skuId: data.skuId,
        quantity: data.quantity,
        title: `Product ${data.itemId}`, // Placeholder
        price: 99.99, // Placeholder
        pic_url: "", // Placeholder
        sku_info: `SKU ${data.skuId}`, // Placeholder
      });
    }

    return this.getCart(customerNumber);
  },

  async updateLineItemQuantity(
    customerNumber: string,
    lineItemId: string,
    quantity: number
  ): Promise<Cart> {
    const cart = cartStore[customerNumber] || [];
    const item = cart.find((i) => i.id === lineItemId);

    if (!item) {
      throw new Error("Item not found in cart");
    }

    item.quantity = quantity;
    return this.getCart(customerNumber);
  },

  async incrementLineItemQuantity(
    customerNumber: string,
    lineItemId: string,
    delta: number
  ): Promise<Cart> {
    const cart = cartStore[customerNumber] || [];
    const item = cart.find((i) => i.id === lineItemId);

    if (!item) {
      throw new Error("Item not found in cart");
    }

    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      // Remove item if quantity becomes <= 0 (optional logic, usually handled by explicit remove)
      // For now, let's just keep it at 1 or remove it? The user code checks quantity > 0 for updates.
      // But increment could be negative. Let's enforce min 1.
      item.quantity = Math.max(1, newQuantity);
    } else {
      item.quantity = newQuantity;
    }

    return this.getCart(customerNumber);
  },

  async removeLineItem(
    customerNumber: string,
    lineItemId: string
  ): Promise<void> {
    if (!cartStore[customerNumber]) return;
    cartStore[customerNumber] = cartStore[customerNumber].filter(
      (item) => item.id !== lineItemId
    );
  },
};
