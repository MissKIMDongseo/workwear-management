import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Package,
  Plus,
  ArrowLeftRight,
  Users,
  Download,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type CategoryKey = 'WORKWEAR' | 'SAFETY_SHOE'
type SubGroupKey = 'BASIC' | 'EXTRA' | 'MODEL'
type TxTypeKey = 'ISSUE' | 'EXCHANGE' | 'RETURN' | 'INBOUND'
type ReturnCondKey = 'REUSABLE' | 'REPAIR' | 'DISPOSED'

interface StockCell {
  id?: string
  sizeLabel: string
  sizeOrder: number
  availableQty: number
  repairQty: number
  disposedQty: number
  minQty: number
  note?: string
}

interface ItemEntry {
  id: string
  category: CategoryKey
  subGroup: SubGroupKey
  itemCode: string
  itemName: string
  unit: string
  specNote?: string
  sortOrder?: number
  stocks: StockCell[]
}

interface TxRecord {
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
  returnCondition?: ReturnCondKey
  statusNote: string
  memo?: string
}

interface EmployeeStatRow {
  key: string
  empNo: string
  empName: string
  issueCount: number
  exchangeCount: number
  totalFreq: number
  totalQty: number
  lastDate: string
}

const WORKWEAR_SIZES = [
  { label: 'M(90)/28', order: 1 },
  { label: 'L(95)/30', order: 2 },
  { label: 'XL(100)/32', order: 3 },
  { label: '2XL(105)/34', order: 4 },
  { label: '3XL(110)/36', order: 5 },
  { label: '4XL(115)/38', order: 6 },
  { label: '5XL(120)/40', order: 7 },
  { label: '6XL(125)/42', order: 8 },
]

const SHOE_SIZES = [
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

const buildStocks = (
  sizes: { label: string; order: number }[],
  qtyMap: Record<string, number>,
  noteMap?: Record<string, string>
): StockCell[] =>
  sizes.map((s) => ({
    sizeLabel: s.label,
    sizeOrder: s.order,
    availableQty: qtyMap[s.label] ?? 0,
    repairQty: 0,
    disposedQty: 0,
    minQty: 3,
    note: noteMap?.[s.label],
  }))

const INITIAL_ITEMS: ItemEntry[] = [
  {
    id: 'w-jacket',
    category: 'WORKWEAR',
    subGroup: 'BASIC',
    itemCode: 'TB-104',
    itemName: '자켓',
    unit: '벌',
    sortOrder: 1,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 11,
      'L(95)/30': 9,
      'XL(100)/32': 0,
      '2XL(105)/34': 2,
      '3XL(110)/36': 10,
      '4XL(115)/38': 21,
      '5XL(120)/40': 3,
      '6XL(125)/42': 0,
    }),
  },
  {
    id: 'w-winter-jacket',
    category: 'WORKWEAR',
    subGroup: 'BASIC',
    itemCode: 'TB-573',
    itemName: '동잠바',
    unit: '벌',
    sortOrder: 2,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 5,
      'L(95)/30': 6,
      'XL(100)/32': 0,
      '2XL(105)/34': 0,
      '3XL(110)/36': 9,
      '4XL(115)/38': 5,
      '5XL(120)/40': 3,
      '6XL(125)/42': 2,
    }),
  },
  {
    id: 'w-vest',
    category: 'WORKWEAR',
    subGroup: 'BASIC',
    itemCode: 'MK-124',
    itemName: '조끼',
    unit: '벌',
    sortOrder: 3,
    specNote:
      '조끼 상세 메모: L(95) [열전사5 / 일반32], XL(100) [열전사5 / 일반1], 3XL(110) [열전사5 / 일반12], 4XL(115) [열전사10]',
    stocks: buildStocks(
      WORKWEAR_SIZES,
      {
        'M(90)/28': 63,
        'L(95)/30': 37,
        'XL(100)/32': 6,
        '2XL(105)/34': 1,
        '3XL(110)/36': 17,
        '4XL(115)/38': 10,
        '5XL(120)/40': 0,
        '6XL(125)/42': 0,
      },
      {
        'L(95)/30': '열전사5 / 일반32',
        'XL(100)/32': '열전사5 / 일반1',
        '3XL(110)/36': '열전사5 / 일반12',
        '4XL(115)/38': '열전사10',
      }
    ),
  },
  {
    id: 'w-tshirt',
    category: 'WORKWEAR',
    subGroup: 'BASIC',
    itemCode: 'TBT-249',
    itemName: '반팔티',
    unit: '벌',
    sortOrder: 4,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 6,
      'L(95)/30': 8,
      'XL(100)/32': 6,
      '2XL(105)/34': 13,
      '3XL(110)/36': 11,
      '4XL(115)/38': 5,
      '5XL(120)/40': 0,
      '6XL(125)/42': 0,
    }),
  },
  {
    id: 'w-pants',
    category: 'WORKWEAR',
    subGroup: 'BASIC',
    itemCode: 'P-ALL',
    itemName: '사계절바지',
    unit: '벌',
    sortOrder: 5,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 41,
      'L(95)/30': 54,
      'XL(100)/32': 55,
      '2XL(105)/34': 109,
      '3XL(110)/36': 74,
      '4XL(115)/38': 74,
      '5XL(120)/40': 35,
      '6XL(125)/42': 20,
    }),
  },
  {
    id: 'w-extra-cargo',
    category: 'WORKWEAR',
    subGroup: 'EXTRA',
    itemCode: 'EX-CARGO',
    itemName: '건빵바지',
    unit: '벌',
    sortOrder: 6,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 8,
      'L(95)/30': 33,
      'XL(100)/32': 55,
      '2XL(105)/34': 14,
      '3XL(110)/36': 22,
      '4XL(115)/38': 67,
      '5XL(120)/40': 48,
      '6XL(125)/42': 40,
    }),
  },
  {
    id: 'w-extra-spandex',
    category: 'WORKWEAR',
    subGroup: 'EXTRA',
    itemCode: 'EX-SPAN',
    itemName: '여름스판',
    unit: '벌',
    sortOrder: 7,
    stocks: buildStocks(WORKWEAR_SIZES, {
      'M(90)/28': 1,
      'L(95)/30': 3,
      'XL(100)/32': 7,
      '2XL(105)/34': 0,
      '3XL(110)/36': 19,
      '4XL(115)/38': 22,
      '5XL(120)/40': 16,
      '6XL(125)/42': 13,
    }),
  },
  {
    id: 's-ls421',
    category: 'SAFETY_SHOE',
    subGroup: 'MODEL',
    itemCode: 'LS-421',
    itemName: 'LS-421',
    unit: '켤레',
    sortOrder: 8,
    stocks: buildStocks(SHOE_SIZES, {
      '230': 4,
      '235': 5,
      '240': 6,
      '245': 10,
      '250': 14,
      '255': 10,
      '260': 3,
      '265': 3,
      '270': 0,
      '275': 6,
      '280': 9,
      '285': 1,
      '290': 2,
      '300': 0,
    }),
  },
  {
    id: 's-ls621',
    category: 'SAFETY_SHOE',
    subGroup: 'MODEL',
    itemCode: 'LS-621',
    itemName: 'LS-621',
    unit: '켤레',
    sortOrder: 9,
    stocks: buildStocks(SHOE_SIZES, {
      '245': 10,
      '250': 12,
      '255': 16,
      '260': 7,
      '265': 4,
      '270': 7,
      '275': 15,
      '280': 22,
      '285': 3,
      '290': 4,
      '300': 3,
    }),
  },
  {
    id: 's-vc63',
    category: 'SAFETY_SHOE',
    subGroup: 'MODEL',
    itemCode: 'VC-63',
    itemName: 'VC-63',
    unit: '켤레',
    sortOrder: 10,
    stocks: buildStocks(SHOE_SIZES, {
      '245': 5,
      '250': 3,
      '255': 4,
      '260': 5,
      '265': 5,
      '270': 2,
      '275': 3,
      '280': 2,
      '285': 7,
      '290': 5,
    }),
  },
]

const INITIAL_TXS: TxRecord[] = [
  {
    id: 'tx-1',
    txDate: '2026-11-20',
    txType: 'ISSUE',
    reason: '신규입사',
    empNo: 'EMP-104',
    empName: '금가을',
    itemId: 's-ls421',
    itemName: 'LS-421',
    sizeLabel: '260',
    qty: 1,
    statusNote: '지급완료',
  },
  {
    id: 'tx-2',
    txDate: '2026-11-21',
    txType: 'ISSUE',
    reason: '신규입사',
    empNo: 'EMP-108',
    empName: '오형석',
    itemId: 'w-jacket',
    itemName: '자켓',
    sizeLabel: '3XL(110)/36',
    qty: 1,
    statusNote: '지급완료',
  },
  {
    id: 'tx-3',
    txDate: '2026-11-22',
    txType: 'EXCHANGE',
    reason: '사이즈 불일치',
    empNo: 'EMP-104',
    empName: '금가을',
    itemId: 'w-jacket',
    itemName: '자켓',
    sizeLabel: 'L(95)/30',
    qty: 1,
    returnCondition: 'REUSABLE',
    statusNote: '교환완료',
    memo: 'M -> L 사이즈 교환',
  },
]

const TX_REASONS: Record<TxTypeKey, string[]> = {
  ISSUE: ['신규입사', '정기지급', '추가요청'],
  EXCHANGE: ['사이즈 불일치', '마모 및 파손', '오염', '제품 불량', '분실'],
  RETURN: ['퇴사/부서이동 반납', '수리/검수 회수'],
  INBOUND: ['정기 구매입고', '반납 재입고', '재고 실사조정'],
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function App() {
  const [items, setItems] = useState<ItemEntry[]>(INITIAL_ITEMS)
  const [txs, setTxs] = useState<TxRecord[]>(INITIAL_TXS)
  const [dbStats, setDbStats] = useState<EmployeeStatRow[] | null>(null)
  const [dbConnected, setDbConnected] = useState<boolean>(false)
  const [loadingDb, setLoadingDb] = useState<boolean>(false)

  const [matrixTab, setMatrixTab] = useState<SubGroupKey>('BASIC')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ZERO' | 'LOW' | 'OK'>('ALL')

  const [showAddItem, setShowAddItem] = useState(false)
  const [newCategory, setNewCategory] = useState<CategoryKey>('WORKWEAR')
  const [newSubGroup, setNewSubGroup] = useState<SubGroupKey>('EXTRA')
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newSpecNote, setNewSpecNote] = useState('')
  const [newDefaultQty, setNewDefaultQty] = useState(0)

  const [txType, setTxType] = useState<TxTypeKey>('ISSUE')
  const [txDate, setTxDate] = useState('2026-11-23')
  const [reason, setReason] = useState(TX_REASONS.ISSUE[0])
  const [empNo, setEmpNo] = useState('')
  const [empName, setEmpName] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(INITIAL_ITEMS[0].id)
  const [selectedSize, setSelectedSize] = useState(INITIAL_ITEMS[0].stocks[1].sizeLabel)
  const [qty, setQty] = useState(1)
  const [returnCond, setReturnCond] = useState<ReturnCondKey>('REUSABLE')
  const [statusNote, setStatusNote] = useState('지급완료')
  const [memo, setMemo] = useState('')

  const [empSearch, setEmpSearch] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null)

  const loadFromSupabase = useCallback(async (showToast = false) => {
    setLoadingDb(true)
    try {
      const { data: itemRows, error: itemErr } = await supabase
        .from('items')
        .select(
          `
          id,
          category,
          sub_group,
          item_code,
          item_name,
          unit,
          spec_note,
          sort_order,
          item_stocks (
            id,
            size_label,
            size_order,
            available_qty,
            repair_qty,
            disposed_qty,
            min_qty,
            stock_note
          )
        `
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (itemErr) throw itemErr

      const { data: txRows, error: txErr } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('is_cancelled', false)
        .order('tx_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (txErr) throw txErr

      const { data: viewRows, error: viewErr } = await supabase
        .from('v_employee_tx_stats')
        .select('*')

      if (!viewErr && Array.isArray(viewRows)) {
        const mappedStats: EmployeeStatRow[] = viewRows.map((r: any) => ({
          key: String(r.emp_key ?? r.emp_no ?? r.emp_name),
          empNo: r.emp_no || '-',
          empName: r.emp_name || '(미입력)',
          issueCount: Number(r.issue_count ?? 0),
          exchangeCount: Number(r.exchange_count ?? 0),
          totalFreq: Number(r.issue_and_exchange_count ?? r.total_tx_count ?? 0),
          totalQty: Number(r.total_issued_qty ?? 0),
          lastDate: String(r.last_tx_date ?? ''),
        }))
        setDbStats(mappedStats)
      }

      if (Array.isArray(itemRows) && itemRows.length > 0) {
        const stockMetaById = new Map<
          string,
          { itemId: string; itemName: string; sizeLabel: string }
        >()

        const mappedItems: ItemEntry[] = itemRows.map((row: any, idx: number) => {
          const stocks: StockCell[] = (Array.isArray(row.item_stocks) ? row.item_stocks : [])
            .map((s: any) => {
              stockMetaById.set(String(s.id), {
                itemId: String(row.id),
                itemName: String(row.item_name),
                sizeLabel: String(s.size_label),
              })
              return {
                id: String(s.id),
                sizeLabel: String(s.size_label),
                sizeOrder: Number(s.size_order ?? 0),
                availableQty: Number(s.available_qty ?? 0),
                repairQty: Number(s.repair_qty ?? 0),
                disposedQty: Number(s.disposed_qty ?? 0),
                minQty: Number(s.min_qty ?? 3),
                note: s.stock_note || undefined,
              }
            })
            .sort((a: StockCell, b: StockCell) => a.sizeOrder - b.sizeOrder)

          return {
            id: String(row.id),
            category: row.category as CategoryKey,
            subGroup: row.sub_group as SubGroupKey,
            itemCode: String(row.item_code ?? ''),
            itemName: String(row.item_name ?? ''),
            unit: String(row.unit ?? (row.category === 'SAFETY_SHOE' ? '켤레' : '벌')),
            specNote: row.spec_note || undefined,
            sortOrder: Number(row.sort_order ?? idx),
            stocks,
          }
        })

        setItems(mappedItems)
        setSelectedItemId((prev) =>
          mappedItems.some((m) => m.id === prev) ? prev : mappedItems[0].id
        )
        setSelectedSize((prev) => {
          const target = mappedItems.find((m) => m.id === selectedItemId) ?? mappedItems[0]
          return target.stocks.some((s) => s.sizeLabel === prev)
            ? prev
            : target.stocks[0]?.sizeLabel ?? ''
        })

        if (Array.isArray(txRows)) {
          const mappedTxs: TxRecord[] = txRows.map((t: any) => {
            const meta = stockMetaById.get(String(t.stock_id))
            return {
              id: String(t.id),
              txDate: String(t.tx_date ?? ''),
              txType: t.tx_type as TxTypeKey,
              reason: String(t.reason ?? ''),
              empNo: String(t.emp_no ?? ''),
              empName: String(t.emp_name ?? ''),
              itemId: meta?.itemId ?? '',
              itemName: meta?.itemName ?? '품목',
              sizeLabel: meta?.sizeLabel ?? '-',
              stockId: t.stock_id ? String(t.stock_id) : undefined,
              qty: Number(t.qty ?? 1),
              returnCondition: (t.return_condition as ReturnCondKey | null) ?? undefined,
              statusNote: String(t.status_note ?? '처리완료'),
              memo: t.memo || undefined,
            }
          })
          setTxs(mappedTxs)
        }

        setDbConnected(true)
        if (showToast) {
          setNotice({ ok: true, msg: 'Supabase에서 최신 재고·이력 데이터를 불러왔습니다.' })
        }
      } else {
        setDbConnected(true)
        if (showToast) {
          setNotice({
            ok: true,
            msg: 'Supabase 연결 성공 (items 테이블에 아직 데이터가 없어 기본 화면 데이터를 표시 중입니다.)',
          })
        }
      }
    } catch (err: any) {
      setDbConnected(false)
      if (showToast) {
        setNotice({
          ok: false,
          msg: `Supabase 조회 안내: ${err?.message ?? '연결 확인 필요'} (로컬 화면 상태로 동작 중)`,
        })
      }
    } finally {
      setLoadingDb(false)
    }
  }, [selectedItemId])

  useEffect(() => {
    loadFromSupabase(false)
  }, [loadFromSupabase])

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? items[0],
    [items, selectedItemId]
  )

  const currentStockCell = useMemo(
    () =>
      selectedItem?.stocks.find((s) => s.sizeLabel === selectedSize) ?? selectedItem?.stocks[0],
    [selectedItem, selectedSize]
  )

  const summary = useMemo(() => {
    let workwearQty = 0
    let shoeQty = 0
    let lowCells = 0

    for (const item of items) {
      for (const s of item.stocks) {
        if (item.category === 'WORKWEAR') workwearQty += s.availableQty
        else shoeQty += s.availableQty

        if (s.availableQty <= s.minQty) lowCells += 1
      }
    }

    const issueAndExchangeCount = txs.filter(
      (t) => t.txType === 'ISSUE' || t.txType === 'EXCHANGE'
    ).length

    return { workwearQty, shoeQty, lowCells, issueAndExchangeCount }
  }, [items, txs])

  const visibleItems = useMemo(
    () => items.filter((i) => i.subGroup === matrixTab),
    [items, matrixTab]
  )

  const matrixRows = useMemo(() => {
    const map = new Map<string, { sizeLabel: string; sizeOrder: number }>()
    for (const item of visibleItems) {
      for (const s of item.stocks) {
        if (!map.has(s.sizeLabel)) {
          map.set(s.sizeLabel, { sizeLabel: s.sizeLabel, sizeOrder: s.sizeOrder })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sizeOrder - b.sizeOrder)
  }, [visibleItems])

  const employeeStats = useMemo<EmployeeStatRow[]>(() => {
    const computedMap = new Map<string, EmployeeStatRow>()

    for (const t of txs) {
      const cleanNo = t.empNo.trim()
      const cleanName = t.empName.trim()
      if (!cleanNo && !cleanName) continue
      const key = cleanNo || cleanName

      const existing = computedMap.get(key) ?? {
        key,
        empNo: cleanNo || '-',
        empName: cleanName || '(미입력)',
        issueCount: 0,
        exchangeCount: 0,
        totalFreq: 0,
        totalQty: 0,
        lastDate: t.txDate,
      }

      if (cleanNo && existing.empNo === '-') existing.empNo = cleanNo
      if (cleanName && existing.empName === '(미입력)') existing.empName = cleanName

      if (t.txType === 'ISSUE') {
        existing.issueCount += 1
        existing.totalFreq += 1
        existing.totalQty += t.qty
      } else if (t.txType === 'EXCHANGE') {
        existing.exchangeCount += 1
        existing.totalFreq += 1
        existing.totalQty += t.qty
      }

      if (t.txDate >= existing.lastDate) existing.lastDate = t.txDate
      computedMap.set(key, existing)
    }

    const baseRows =
      dbStats && dbStats.length > 0 && txs.length === 0
        ? dbStats
        : Array.from(computedMap.values())

    const q = empSearch.trim().toLowerCase()
    return baseRows
      .filter((row) =>
        !q
          ? true
          : row.empNo.toLowerCase().includes(q) || row.empName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalFreq - a.totalFreq || b.issueCount - a.issueCount)
  }, [txs, dbStats, empSearch])

  const handleCellClick = (item: ItemEntry, sizeLabel: string) => {
    setSelectedItemId(item.id)
    setSelectedSize(sizeLabel)
    setNotice({
      ok: true,
      msg: `선택됨: [${item.category === 'WORKWEAR' ? '작업복' : '안전화'}] ${item.itemName} (${sizeLabel})`,
    })
  }

  const handleTxTypeChange = (nextType: TxTypeKey) => {
    setTxType(nextType)
    setReason(TX_REASONS[nextType][0])
    if (nextType === 'ISSUE') setStatusNote('지급완료')
    else if (nextType === 'EXCHANGE') setStatusNote('교환완료')
    else if (nextType === 'RETURN') setStatusNote('회수완료')
    else setStatusNote('입고완료')
  }

  const computeNextStockQty = (cell: StockCell) => {
    let nextAvail = cell.availableQty
    let nextRepair = cell.repairQty
    let nextDisposed = cell.disposedQty

    if (txType === 'ISSUE') {
      nextAvail -= qty
    } else if (txType === 'INBOUND') {
      nextAvail += qty
    } else if (txType === 'EXCHANGE') {
      nextAvail -= qty
      if (returnCond === 'REUSABLE') nextAvail += qty
      else if (returnCond === 'REPAIR') nextRepair += qty
      else if (returnCond === 'DISPOSED') nextDisposed += qty
    } else if (txType === 'RETURN') {
      if (returnCond === 'REUSABLE') nextAvail += qty
      else if (returnCond === 'REPAIR') nextRepair += qty
      else if (returnCond === 'DISPOSED') nextDisposed += qty
    }

    return {
      availableQty: Math.max(0, nextAvail),
      repairQty: nextRepair,
      disposedQty: nextDisposed,
    }
  }

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!selectedItem || !currentStockCell) return
    if (qty < 1) {
      setNotice({ ok: false, msg: '수량은 1 이상이어야 합니다.' })
      return
    }

    const needsEmp = txType === 'ISSUE' || txType === 'EXCHANGE' || txType === 'RETURN'
    if (needsEmp && !empName.trim() && !empNo.trim()) {
      setNotice({ ok: false, msg: '지급/교환/회수 시 사원명 또는 사원번호를 입력해 주세요.' })
      return
    }

    const needsDecrease = txType === 'ISSUE' || txType === 'EXCHANGE'
    if (needsDecrease && currentStockCell.availableQty < qty) {
      setNotice({
        ok: false,
        msg: `가용 재고가 부족합니다. (${selectedItem.itemName} ${selectedSize} 현재 ${currentStockCell.availableQty}${selectedItem.unit})`,
      })
      return
    }

    const nextQuantities = computeNextStockQty(currentStockCell)
    const cleanNo = empNo.trim()
    const cleanName = empName.trim()

    let savedTxId = `tx-${Date.now()}`
    let dbSynced = false

    if (dbConnected && currentStockCell.id && UUID_REGEX.test(currentStockCell.id)) {
      try {
        let employeeId: string | null = null
        if (cleanNo || cleanName) {
          const { data: empRow } = await supabase
            .from('employees')
            .upsert(
              {
                emp_no: cleanNo || null,
                emp_name: cleanName || cleanNo,
                is_active: true,
              },
              { onConflict: 'emp_no' }
            )
            .select('id')
            .maybeSingle()

          if (empRow?.id) employeeId = String(empRow.id)
        }

        const { error: stockErr } = await supabase
          .from('item_stocks')
          .update({
            available_qty: nextQuantities.availableQty,
            repair_qty: nextQuantities.repairQty,
            disposed_qty: nextQuantities.disposedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentStockCell.id)

        if (stockErr) throw stockErr

        const { data: txInserted, error: txErr } = await supabase
          .from('stock_transactions')
          .insert({
            tx_date: txDate,
            tx_type: txType,
            reason,
            employee_id: employeeId,
            emp_no: cleanNo || null,
            emp_name: cleanName || null,
            stock_id: currentStockCell.id,
            qty,
            return_condition: txType === 'EXCHANGE' || txType === 'RETURN' ? returnCond : null,
            status_note: statusNote.trim() || '처리완료',
            memo: memo.trim() || null,
          })
          .select('id')
          .single()

        if (txErr) throw txErr
        if (txInserted?.id) savedTxId = String(txInserted.id)
        dbSynced = true
      } catch (err: any) {
        setNotice({
          ok: false,
          msg: `Supabase 저장 중 오류: ${err?.message ?? '권한 또는 스키마 확인 필요'}`,
        })
        return
      }
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedItem.id) return item
        return {
          ...item,
          stocks: item.stocks.map((s) =>
            s.sizeLabel === selectedSize ? { ...s, ...nextQuantities } : s
          ),
        }
      })
    )

    const newRecord: TxRecord = {
      id: savedTxId,
      txDate,
      txType,
      reason,
      empNo: cleanNo,
      empName: cleanName,
      itemId: selectedItem.id,
      itemName: selectedItem.itemName,
      sizeLabel: selectedSize,
      stockId: currentStockCell.id,
      qty,
      returnCondition: txType === 'EXCHANGE' || txType === 'RETURN' ? returnCond : undefined,
      statusNote: statusNote.trim() || '처리완료',
      memo: memo.trim() || undefined,
    }

    setTxs((prev) => [newRecord, ...prev])
    setNotice({
      ok: true,
      msg: `${cleanName || cleanNo || '재고'} — ${selectedItem.itemName} (${selectedSize}) ${qty}${selectedItem.unit} 처리 완료${dbSynced ? ' (Supabase 반영됨)' : ' (화면 상태 반영)'}`,
    })
  }

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newItemName.trim()
    if (!trimmedName) {
      setNotice({ ok: false, msg: '추가할 품목명 또는 모델명을 입력해 주세요.' })
      return
    }

    const baseSizes = newCategory === 'WORKWEAR' ? WORKWEAR_SIZES : SHOE_SIZES
    const resolvedGroup: SubGroupKey = newCategory === 'SAFETY_SHOE' ? 'MODEL' : newSubGroup
    const resolvedCode = newItemCode.trim() || trimmedName.toUpperCase()
    const resolvedUnit = newCategory === 'WORKWEAR' ? '벌' : '켤레'
    const safeQty = Math.max(0, newDefaultQty)

    let createdId = `custom-${Date.now()}`
    let stocksWithIds: StockCell[] = baseSizes.map((s) => ({
      sizeLabel: s.label,
      sizeOrder: s.order,
      availableQty: safeQty,
      repairQty: 0,
      disposedQty: 0,
      minQty: 3,
    }))

    if (dbConnected) {
      try {
        const { data: insertedItem, error: itemErr } = await supabase
          .from('items')
          .insert({
            category: newCategory,
            sub_group: resolvedGroup,
            item_code: resolvedCode,
            item_name: trimmedName,
            unit: resolvedUnit,
            spec_note: newSpecNote.trim() || null,
            is_active: true,
            sort_order: items.length + 1,
          })
          .select('id')
          .single()

        if (itemErr) throw itemErr

        if (insertedItem?.id) {
          createdId = String(insertedItem.id)
          const stockPayload = baseSizes.map((s) => ({
            item_id: createdId,
            size_label: s.label,
            size_order: s.order,
            available_qty: safeQty,
            repair_qty: 0,
            disposed_qty: 0,
            min_qty: 3,
          }))

          const { data: insertedStocks, error: stockErr } = await supabase
            .from('item_stocks')
            .insert(stockPayload)
            .select(
              'id, size_label, size_order, available_qty, repair_qty, disposed_qty, min_qty'
            )

          if (stockErr) throw stockErr

          if (Array.isArray(insertedStocks) && insertedStocks.length > 0) {
            stocksWithIds = insertedStocks
              .map((s: any) => ({
                id: String(s.id),
                sizeLabel: String(s.size_label),
                sizeOrder: Number(s.size_order ?? 0),
                availableQty: Number(s.available_qty ?? 0),
                repairQty: Number(s.repair_qty ?? 0),
                disposedQty: Number(s.disposed_qty ?? 0),
                minQty: Number(s.min_qty ?? 3),
              }))
              .sort((a, b) => a.sizeOrder - b.sizeOrder)
          }
        }
      } catch (err: any) {
        setNotice({
          ok: false,
          msg: `신규 품목 DB 저장 오류: ${err?.message ?? '확인 필요'}`,
        })
        return
      }
    }

    const created: ItemEntry = {
      id: createdId,
      category: newCategory,
      subGroup: resolvedGroup,
      itemCode: resolvedCode,
      itemName: trimmedName,
      unit: resolvedUnit,
      specNote: newSpecNote.trim() || undefined,
      sortOrder: items.length + 1,
      stocks: stocksWithIds,
    }

    setItems((prev) => [...prev, created])
    setMatrixTab(created.subGroup)
    setSelectedItemId(created.id)
    setSelectedSize(created.stocks[0]?.sizeLabel ?? '')
    setNewItemCode('')
    setNewItemName('')
    setNewSpecNote('')
    setNewDefaultQty(0)
    setShowAddItem(false)
    setNotice({ ok: true, msg: `신규 품목 '${created.itemName}'이(가) 추가되었습니다.` })
  }

  const handleExportCsv = () => {
    const lines = ['분류,구분,품번/코드,품목명,사이즈,가용재고,단위']
    for (const item of items) {
      for (const s of item.stocks) {
        lines.push(
          [
            item.category === 'WORKWEAR' ? '작업복' : '안전화',
            item.subGroup,
            `"${item.itemCode}"`,
            `"${item.itemName}"`,
            `"${s.sizeLabel}"`,
            s.availableQty,
            item.unit,
          ].join(',')
        )
      }
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `작업복_안전화_재고현황_${txDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleResetDemo = () => {
    setItems(INITIAL_ITEMS)
    setTxs(INITIAL_TXS)
    setNotice({ ok: true, msg: '초기 화면 데이터로 되돌렸습니다.' })
  }

  const isCellVisible = (qtyVal: number) => {
    if (statusFilter === 'ZERO') return qtyVal === 0
    if (statusFilter === 'LOW') return qtyVal > 0 && qtyVal <= 3
    if (statusFilter === 'OK') return qtyVal >= 4
    return true
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* 상단 헤더 */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-200">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  작업복 · 안전화 재고 및 지급 관리
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    dbConnected
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  <Database className="h-3 w-3" />
                  {dbConnected ? 'Supabase 연결됨' : '로컬 테스트 모드'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                기준 데이터: 작업복 재고현황(26.11) · 셀 클릭 시 입력 폼 자동 연동
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddItem((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              신규 품목 추가
            </button>
            <button
              type="button"
              onClick={() => loadFromSupabase(true)}
              disabled={loadingDb}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
              DB 새로고침
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              엑셀(CSV)
            </button>
            <button
              type="button"
              onClick={handleResetDemo}
              title="초기화"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div
              id="header-auth-slot"
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
            >
              로그인 슬롯
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {notice && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
              notice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {notice.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{notice.msg}</span>
          </div>
        )}

        {/* 신규 품목 추가 패널 */}
        {showAddItem && (
          <form
            onSubmit={handleAddNewItem}
            className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">신규 품목 / 안전화 모델 추가</h2>
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                닫기
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">분류</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as CategoryKey)}
                  className={inputClass}
                >
                  <option value="WORKWEAR">작업복</option>
                  <option value="SAFETY_SHOE">안전화</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">구분</label>
                <select
                  value={newCategory === 'SAFETY_SHOE' ? 'MODEL' : newSubGroup}
                  disabled={newCategory === 'SAFETY_SHOE'}
                  onChange={(e) => setNewSubGroup(e.target.value as SubGroupKey)}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="BASIC">작업복 (기본지급)</option>
                  <option value="EXTRA">작업복 (기타품목)</option>
                  <option value="MODEL">안전화 (모델별)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  품번 / 모델코드
                </label>
                <input
                  type="text"
                  placeholder="예: TB-200, LS-800"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  품목명 / 모델명 *
                </label>
                <input
                  type="text"
                  placeholder="예: 동조끼, K2-10"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  사이즈별 초기재고
                </label>
                <input
                  type="number"
                  min={0}
                  value={newDefaultQty}
                  onChange={(e) => setNewDefaultQty(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  품목 등록
                </button>
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">사양 메모 (선택)</label>
              <input
                type="text"
                placeholder="예: 열전사 / 일반 구분, 방문자용 등"
                value={newSpecNote}
                onChange={(e) => setNewSpecNote(e.target.value)}
                className={inputClass}
              />
            </div>
          </form>
        )}

        {/* 상단 4개 요약 카드 */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">작업복 총 재고</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {summary.workwearQty.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">벌</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">안전화 총 재고</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {summary.shoeQty.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">켤레</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">재고 부족 칸 (≤3개)</div>
            <div className="mt-1.5 text-2xl font-bold text-amber-600">
              {summary.lowCells}{' '}
              <span className="text-sm font-normal text-slate-500">칸</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">지급·교환 처리 건수</div>
            <div className="mt-1.5 text-2xl font-bold text-emerald-600">
              {summary.issueAndExchangeCount}{' '}
              <span className="text-sm font-normal text-slate-500">건</span>
            </div>
          </div>
        </section>

        {/* 품목 · 사이즈별 재고 현황표 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">품목 · 사이즈별 재고 현황표</h2>

            <div className="flex flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs">
              {(
                [
                  ['BASIC', '작업복 (기본지급)'],
                  ['EXTRA', '작업복 (기타품목)'],
                  ['MODEL', '안전화 (모델별)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMatrixTab(key)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    matrixTab === key
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['ALL', '전체'],
                  ['ZERO', '재고없음 (0)'],
                  ['LOW', '부족주의 (1~3)'],
                  ['OK', '정상 (4+)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-md border px-2.5 py-1 font-medium ${
                    statusFilter === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-slate-500">수량 셀 클릭 시 하단 폼 자동 선택</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-3 py-2.5 text-left font-semibold">사이즈 \ 품목</th>
                  {visibleItems.map((item) => (
                    <th key={item.id} className="px-3 py-2.5 font-semibold">
                      <div className="text-slate-900">{item.itemName}</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        {item.itemCode} · {item.unit}
                      </div>
                    </th>
                  ))}
                  <th className="bg-slate-100 px-3 py-2.5 font-semibold text-slate-900">
                    사이즈계
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {matrixRows.map((row) => {
                  let rowSum = 0
                  return (
                    <tr key={row.sizeLabel} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 text-left font-medium text-slate-800">
                        {row.sizeLabel}
                      </td>
                      {visibleItems.map((item) => {
                        const cell = item.stocks.find((s) => s.sizeLabel === row.sizeLabel)
                        const val = cell?.availableQty ?? 0
                        rowSum += val

                        const dimmed = !isCellVisible(val)
                        const isSelected =
                          selectedItem?.id === item.id && selectedSize === row.sizeLabel

                        let badgeClass =
                          'text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100'
                        if (val === 0) {
                          badgeClass =
                            'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100'
                        } else if (val <= 3) {
                          badgeClass =
                            'text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                        }

                        return (
                          <td key={`${item.id}-${row.sizeLabel}`} className="p-1.5">
                            <button
                              type="button"
                              onClick={() => handleCellClick(item, row.sizeLabel)}
                              title={cell?.note ? `${item.itemName}: ${cell.note}` : undefined}
                              className={`relative w-full min-w-[64px] rounded-lg px-2 py-1.5 font-semibold transition ${badgeClass} ${
                                dimmed ? 'opacity-25' : ''
                              } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                            >
                              {val}
                              {cell?.note && (
                                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td className="bg-slate-50 px-3 py-2.5 font-bold text-slate-900">
                        {rowSum}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 bg-slate-100 font-bold text-slate-900">
                  <td className="px-3 py-2.5 text-left">품목 합계</td>
                  {visibleItems.map((item) => {
                    const colSum = item.stocks.reduce((acc, s) => acc + s.availableQty, 0)
                    return (
                      <td key={item.id} className="px-3 py-2.5">
                        {colSum}
                      </td>
                    )
                  })}
                  <td className="bg-blue-50 px-3 py-2.5 text-blue-700">
                    {visibleItems.reduce(
                      (sum, item) => sum + item.stocks.reduce((a, b) => a + b.availableQty, 0),
                      0
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {visibleItems.some((i) => i.specNote) && (
            <div className="mt-2.5 space-y-1 text-[11px] text-blue-700">
              {visibleItems
                .filter((i) => i.specNote)
                .map((i) => (
                  <div key={i.id}>• {i.specNote}</div>
                ))}
            </div>
          )}
        </section>

        {/* 하단: 지급/교환/회수/입고 등록 + 사원별 지급/교환 빈도 집계 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleTxSubmit}
            className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">지급 · 교환 · 회수 · 입고 등록</h2>
              </div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                현재고: {currentStockCell?.availableQty ?? 0}
                {selectedItem?.unit}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1 text-xs">
              {(
                [
                  ['ISSUE', '지급'],
                  ['EXCHANGE', '교환'],
                  ['RETURN', '회수'],
                  ['INBOUND', '입고'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTxTypeChange(key)}
                  className={`rounded-lg py-2 font-semibold transition ${
                    txType === key
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">처리 일자</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사원번호</label>
                <input
                  type="text"
                  placeholder="예: EMP-105"
                  value={empNo}
                  onChange={(e) => setEmpNo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사원명</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  품목 / 모델명
                </label>
                <select
                  value={selectedItem?.id ?? ''}
                  onChange={(e) => {
                    const nextItem = items.find((i) => i.id === e.target.value)
                    if (nextItem) {
                      setSelectedItemId(nextItem.id)
                      setSelectedSize(nextItem.stocks[0]?.sizeLabel ?? '')
                    }
                  }}
                  className={inputClass}
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category === 'WORKWEAR' ? '작업복' : '안전화'}] {item.itemName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사이즈</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className={inputClass}
                >
                  {selectedItem?.stocks.map((s) => (
                    <option key={s.sizeLabel} value={s.sizeLabel}>
                      {s.sizeLabel} (재고 {s.availableQty})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">수량</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사유</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputClass}
                >
                  {TX_REASONS[txType].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {(txType === 'EXCHANGE' || txType === 'RETURN') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    회수품 상태
                  </label>
                  <select
                    value={returnCond}
                    onChange={(e) => setReturnCond(e.target.value as ReturnCondKey)}
                    className={inputClass}
                  >
                    <option value="REUSABLE">정상 재사용 (가용재고 +)</option>
                    <option value="REPAIR">수리/검수 대기</option>
                    <option value="DISPOSED">폐기 처리</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">비고 / 상태</label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">메모 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 열전사 마킹 포함"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              ✓ 등록 및 재고 반영
            </button>
          </form>

          {/* 사원별 지급·교환 횟수(빈도) 및 최근 이력 */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">사원별 지급 · 교환 빈도 집계</h2>
              </div>
              <input
                type="text"
                placeholder="사원명 또는 사원번호 검색"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">사원번호</th>
                    <th className="px-3 py-2">사원명</th>
                    <th className="px-3 py-2 text-right">지급</th>
                    <th className="px-3 py-2 text-right">교환</th>
                    <th className="px-3 py-2 text-right">빈도(합계)</th>
                    <th className="px-3 py-2 text-right">최근일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {employeeStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                        집계된 사원 이력이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    employeeStats.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-700">{row.empNo}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{row.empName}</td>
                        <td className="px-3 py-2 text-right font-medium text-blue-600">
                          {row.issueCount}회
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-amber-600">
                          {row.exchangeCount}회
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">
                          {row.totalFreq}회
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">{row.lastDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700">
                최근 처리 이력 ({txs.length}건)
              </h3>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                {txs.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-slate-800">
                      <span className="mr-2 font-mono text-[11px] text-slate-500">{t.txDate}</span>
                      <span className="font-semibold text-slate-900">
                        {t.empName || '-'} {t.empNo ? `(${t.empNo})` : ''}
                      </span>
                      <span className="mx-1.5 text-slate-400">/</span>
                      <span>
                        {t.itemName} · {t.sizeLabel} · {t.qty}개
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500">[{t.reason}]</span>
                    </div>
                    <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {t.txType}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App