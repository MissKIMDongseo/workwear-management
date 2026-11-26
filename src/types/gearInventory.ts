export type ActiveTabKey = 'GEAR_ISSUE' | 'SAFETY_OPS'
export type CategoryKey = 'WORKWEAR' | 'SAFETY_SHOE'
export type SubGroupKey = 'BASIC' | 'EXTRA' | 'MODEL'
export type TxTypeKey = 'ISSUE' | 'INBOUND'

export interface StockCell {
  id?: string
  sizeLabel: string
  sizeOrder: number
  availableQty: number
  repairQty: number
  disposedQty: number
  minQty: number
  note?: string
}

export interface ItemEntry {
  id: string
  category: CategoryKey
  subGroup: SubGroupKey
  itemCode: string
  itemName: string
  unit: string
  imageUrl?: string | null
  sortOrder?: number
  stocks: StockCell[]
}

export interface TxRecord {
  id: string
  txDate: string
  txType: TxTypeKey
  reason: string
  empNo: string
  empName: string
  itemId: string
  itemName: string
  sizeLabel: string
  stockId?: string
  qty: number
  statusNote: string
  memo?: string
}

export interface EmployeeStatRow {
  key: string
  empNo: string
  empName: string
  issueCount: number
  exchangeCount: number
  totalFreq: number
  totalQty: number
  lastDate: string
  details: TxRecord[]
}

export interface PendingTxConfirm {
  txType: TxTypeKey
  txDate: string
  empNo: string
  empName: string
  item: ItemEntry
  stockCell: StockCell
  qty: number
  reason: string
  statusNote: string
  memo: string
  nextQuantities: {
    availableQty: number
    repairQty: number
    disposedQty: number
  }
}

export interface PhotoModalState {
  title: string
  subtitle?: string
  imageUrl: string
}

export interface NoticeState {
  ok: boolean
  msg: string
}

export const getKstDateString = (input?: string | Date): string => {
  const date =
    input instanceof Date
      ? input
      : typeof input === 'string' && input.trim() !== ''
        ? /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
          ? new Date(`${input.trim()}T00:00:00+09:00`)
          : new Date(input.trim())
        : new Date()

  if (Number.isNaN(date.getTime())) {
    return getKstDateString(new Date())
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export const WORKWEAR_SIZES = [
  { label: 'M(90)/28', order: 1 },
  { label: 'L(95)/30', order: 2 },
  { label: 'XL(100)/32', order: 3 },
  { label: '2XL(105)/34', order: 4 },
  { label: '3XL(110)/36', order: 5 },
  { label: '4XL(115)/38', order: 6 },
  { label: '5XL(120)/40', order: 7 },
  { label: '6XL(125)/42', order: 8 },
]

export const SHOE_SIZES = [
  { label: '230', order: 1 },
  { label: '235', order: 2 },
  { label: '240', order: 3 },
  { label: '245', order: 4 },
  { label: '250', order: 5 },
  { label: '255', order: 6 },
  { label: '260', order: 7 },
  { label: '265', order: 8 },
  { label: '270', order: 9 },
  { label: '275', order: 10 },
  { label: '280', order: 11 },
  { label: '285', order: 12 },
  { label: '290', order: 13 },
  { label: '300', order: 14 },
]

export const buildEmptySizeQtyMap = (category: CategoryKey): Record<string, number> => {
  const list = category === 'WORKWEAR' ? WORKWEAR_SIZES : SHOE_SIZES
  return Object.fromEntries(list.map((s) => [s.label, 0]))
}

export const TX_REASONS: Record<TxTypeKey, string[]> = {
  ISSUE: ['신규입사', '정기지급', '추가요청'],
  INBOUND: ['정기 구매입고', '재고 실사조정'],
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i