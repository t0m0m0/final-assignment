import type { Order, OrderStatus, Product, ProductInput, User } from '../types'
import { request } from './client'

export { ApiError, setAuthToken } from './client'

export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/login', { method: 'POST', body: { email, password } }),
  me: (signal?: AbortSignal) => request<User>('/me', { signal }),
}

export const productApi = {
  list: (params: { q?: string; category?: string } = {}, signal?: AbortSignal) =>
    request<Product[]>('/products', { query: params, signal }),
  get: (id: number, signal?: AbortSignal) => request<Product>(`/products/${id}`, { signal }),
  create: (input: ProductInput) => request<Product>('/products', { method: 'POST', body: input }),
  update: (id: number, input: ProductInput) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),
}

export const orderApi = {
  // 一般ユーザーの場合、サーバー側で自分の注文のみに絞り込まれる
  list: (params: { status?: OrderStatus } = {}, signal?: AbortSignal) =>
    request<Order[]>('/orders', {
      query: { ...params, _sort: 'createdAt', _order: 'desc' },
      signal,
    }),
  create: (items: { productId: number; quantity: number }[]) =>
    request<Order>('/orders', { method: 'POST', body: { items } }),
  updateStatus: (id: number, status: OrderStatus) =>
    request<Order>(`/orders/${id}`, { method: 'PATCH', body: { status } }),
}
