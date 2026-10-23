export type Role = 'user' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  category: string
}

export type ProductInput = Omit<Product, 'id'>

export const CATEGORIES = ['家電', '書籍', '食品', '雑貨'] as const

export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '受付済み',
  shipped: '発送済み',
  delivered: '配達完了',
  cancelled: 'キャンセル',
}

export interface OrderItem {
  productId: number
  name: string
  price: number
  quantity: number
}

export interface Order {
  id: number
  userId: number
  userName: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  createdAt: string
}
