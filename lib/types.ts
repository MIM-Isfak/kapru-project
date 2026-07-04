export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  rating: number;
  category: string;
  inStock: boolean;
  description: string;
  originalPrice?: number;
  url?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  stage?: 'discovery' | 'checkout';
  products?: Product[];
}
