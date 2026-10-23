const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
const dateTime = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })

export const formatPrice = (value: number) => yen.format(value)

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
