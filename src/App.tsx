import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Package,
  SlidersHorizontal,
  ArrowLeftRight,
  Users,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  Pencil,
  Trash2,
  Plus,
  Search,
  Settings2,
  Image as ImageIcon,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type CategoryKey = 'WORKWEAR' | 'SAFETY_SHOE'
type SubGroupKey = 'BASIC' | 'EXTRA' | 'MODEL'
type TxTypeKey = 'ISSUE' | 'INBOUND'

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
  imageUrl?: string | null
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

interface PendingTxConfirm {
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

interface PhotoModalState {
  title: string
  subtitle?: string
  imageUrl: string
}

const getKstDateString = (input?: string | Date): string => {
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

const buildEmptySizeQtyMap = (category: CategoryKey): Record<string, number> => {
  const list = category === 'WORKWEAR' ? WORKWEAR_SIZES : SHOE_SIZES
  return Object.fromEntries(list.map((s) => [s.label, 0]))
}

const TX_REASONS: Record<TxTypeKey, string[]> = {
  ISSUE: ['신규입사', '정기지급', '추가요청'],
  INBOUND: ['정기 구매입고', '재고 실사조정'],
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function App() {
  const [items, setItems] = useState<ItemEntry[]>([])
  const [txs, setTxs] = useState<TxRecord[]>([])
  const [dbConnected, setDbConnected] = useState<boolean>(false)
  const [loadingDb, setLoadingDb] = useState<boolean>(false)

  // 현황표 필터: 작업복 / 안전화 분리 (기본값 'WORKWEAR'), 0 재고 숨기기 기본 활성
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('WORKWEAR')
  const [itemFilterId, setItemFilterId] = useState<string>('ALL')
  const [itemSearch, setItemSearch] = useState<string>('')
  const [hideZeroStock, setHideZeroStock] = useState<boolean>(true)

  // 품목 등록 · 수정 · 삭제 관리 상태
  const [showItemManager, setShowItemManager] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [formCategory, setFormCategory] = useState<CategoryKey>('WORKWEAR')
  const [formSubGroup, setFormSubGroup] = useState<SubGroupKey>('EXTRA')
  const [formItemCode, setFormItemCode] = useState('')
  const [formItemName, setFormItemName] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [sizeQtyMap, setSizeQtyMap] = useState<Record<string, number>>(() =>
    buildEmptySizeQtyMap('WORKWEAR')
  )

  // 사진 팝업 상태
  const [photoModal, setPhotoModal] = useState<PhotoModalState | null>(null)

  // 삭제 확인 모달 상태 (품목 / 처리이력)
  const [deleteItemTarget, setDeleteItemTarget] = useState<ItemEntry | null>(null)
  const [deleteTxTarget, setDeleteTxTarget] = useState<TxRecord | null>(null)
  const [txManageMode, setTxManageMode] = useState(false)

  // 지급 · 입고 폼 상태 (한국 시간 기준 오늘 날짜)
  const [txType, setTxType] = useState<TxTypeKey>('ISSUE')
  const [txDate, setTxDate] = useState<string>(() => getKstDateString())
  const [reason, setReason] = useState(TX_REASONS.ISSUE[0])
  const [empNo, setEmpNo] = useState('')
  const [empName, setEmpName] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [qty, setQty] = useState<number>(1)
  const [statusNote, setStatusNote] = useState('지급완료')
  const [memo, setMemo] = useState('')
  const [pendingTxConfirm, setPendingTxConfirm] = useState<PendingTxConfirm | null>(null)

  const [empSearch, setEmpSearch] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null)

  const resetItemForm = useCallback((cat: CategoryKey = 'WORKWEAR') => {
    setEditingItemId(null)
    setFormCategory(cat)
    setFormSubGroup(cat === 'SAFETY_SHOE' ? 'MODEL' : 'EXTRA')
    setFormItemCode('')
    setFormItemName('')
    setFormImageUrl('')
    setSizeQtyMap(buildEmptySizeQtyMap(cat))
  }, [])

  const resetTxInputsAfterSave = useCallback(() => {
    setTxDate(getKstDateString())
    setEmpNo('')
    setEmpName('')
    setQty(1)
    setMemo('')
  }, [])

  const startEditItem = (item: ItemEntry) => {
    setEditingItemId(item.id)
    setFormCategory(item.category)
    setFormSubGroup(item.category === 'SAFETY_SHOE' ? 'MODEL' : item.subGroup)
    setFormItemCode(item.itemCode)
    setFormItemName(item.itemName)
    setFormImageUrl(item.imageUrl ?? '')
    setShowItemManager(true)
    setNotice({
      ok: true,
      msg: `'${item.itemName}' 수정 모드로 전환되었습니다. 상단 강조 박스에서 수정 후 [수정 저장]을 눌러주세요.`,
    })
  }

  const handleCategoryFormChange = (nextCat: CategoryKey) => {
    setFormCategory(nextCat)
    if (nextCat === 'SAFETY_SHOE') {
      setFormSubGroup('MODEL')
    } else if (formSubGroup === 'MODEL') {
      setFormSubGroup('EXTRA')
    }
    if (!editingItemId) {
      setSizeQtyMap(buildEmptySizeQtyMap(nextCat))
    }
  }

  const handleSizeQtyChange = (sizeLabel: string, rawVal: string) => {
    const parsed = Math.max(0, Math.floor(Number(rawVal) || 0))
    setSizeQtyMap((prev) => ({ ...prev, [sizeLabel]: parsed }))
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ ok: false, msg: '이미지 파일만 선택해 주세요.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImageUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const openItemPhotoPopup = (item: ItemEntry) => {
    if (!item.imageUrl) {
      setNotice({
        ok: false,
        msg: `'${item.itemName}' 품목에는 등록된 제품 사진(image_url)이 없습니다. 품목 관리에서 추가해 주세요.`,
      })
      return
    }
    setPhotoModal({
      title: `[${item.category === 'WORKWEAR' ? '작업복' : '안전화'}] ${item.itemName}`,
      subtitle: `품번/코드: ${item.itemCode} · 단위: ${item.unit}`,
      imageUrl: item.imageUrl,
    })
  }

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
          image_url,
          sort_order,
          item_stocks (
            id,
            size_label,
            size_order,
            available_qty,
            repair_qty,
            disposed_qty,
            min_qty
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
        .in('tx_type', ['ISSUE', 'INBOUND'])
        .order('tx_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (txErr) throw txErr

      const stockMetaById = new Map<
        string,
        { itemId: string; itemName: string; sizeLabel: string }
      >()

      const mappedItems: ItemEntry[] = Array.isArray(itemRows)
        ? itemRows.map((row: any, idx: number) => {
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
              imageUrl: row.image_url ? String(row.image_url) : null,
              sortOrder: Number(row.sort_order ?? idx),
              stocks,
            }
          })
        : []

      setItems(mappedItems)

      if (mappedItems.length > 0) {
        const nextItem = mappedItems.find((m) => m.id === selectedItemId) ?? mappedItems[0]
        setSelectedItemId(nextItem.id)
        setSelectedSize((prev) =>
          nextItem.stocks.some((s) => s.sizeLabel === prev)
            ? prev
            : nextItem.stocks[0]?.sizeLabel ?? ''
        )
      } else {
        setSelectedItemId('')
        setSelectedSize('')
      }

      if (Array.isArray(txRows)) {
        const mappedTxs: TxRecord[] = txRows.map((t: any) => {
          const meta = stockMetaById.get(String(t.stock_id))
          const rawMemo = typeof t.memo === 'string' ? t.memo.trim() : ''
          return {
            id: String(t.id),
            txDate: t.tx_date ? getKstDateString(String(t.tx_date)) : getKstDateString(),
            txType: (t.tx_type === 'INBOUND' ? 'INBOUND' : 'ISSUE') as TxTypeKey,
            reason: String(t.reason ?? ''),
            empNo: String(t.emp_no ?? ''),
            empName: String(t.emp_name ?? ''),
            itemId: meta?.itemId ?? '',
            itemName: meta?.itemName ?? '품목',
            sizeLabel: meta?.sizeLabel ?? '-',
            stockId: t.stock_id ? String(t.stock_id) : undefined,
            qty: Number(t.qty ?? 1),
            statusNote: String(t.status_note ?? '처리완료'),
            memo: rawMemo || undefined,
          }
        })
        setTxs(mappedTxs)
      } else {
        setTxs([])
      }

      setDbConnected(true)
      if (showToast) {
        setNotice({
          ok: true,
          msg:
            mappedItems.length === 0
              ? 'Supabase 테이블이 비어 있어 0건 상태로 불러왔습니다.'
              : 'Supabase 테이블 기준으로 최신 데이터를 불러왔습니다.',
        })
      }
    } catch (err: any) {
      setDbConnected(false)
      if (showToast) {
        setNotice({
          ok: false,
          msg: `Supabase 조회 안내: ${err?.message ?? '연결 확인 필요'}`,
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

  // 작업복 / 안전화 분류 필터 적용
  const categoryFilteredItems = useMemo(
    () => items.filter((item) => item.category === categoryFilter),
    [items, categoryFilter]
  )

  // 품목 선택 + 검색어 필터 적용
  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    return categoryFilteredItems.filter((item) => {
      if (itemFilterId !== 'ALL' && item.id !== itemFilterId) return false
      if (!q) return true
      return (
        item.itemName.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q)
      )
    })
  }, [categoryFilteredItems, itemFilterId, itemSearch])

  // 전체 사이즈 행 목록
  const allMatrixRows = useMemo(() => {
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

  // hideZeroStock이 true일 때는 표시 품목 기준 가용재고 합계가 0인 사이즈 행 숨김
  const matrixRows = useMemo(() => {
    if (!hideZeroStock) return allMatrixRows
    return allMatrixRows.filter((row) =>
      visibleItems.some((item) => {
        const cell = item.stocks.find((s) => s.sizeLabel === row.sizeLabel)
        return (cell?.availableQty ?? 0) > 0
      })
    )
  }, [allMatrixRows, hideZeroStock, visibleItems])

  const hiddenZeroRowCount = Math.max(0, allMatrixRows.length - matrixRows.length)

  // 사원별 지급 빈도 집계는 현재 활성 처리 이력(txs) 기준으로 계산 (이력 0건 시 0건)
  const employeeStats = useMemo<EmployeeStatRow[]>(() => {
    const computedMap = new Map<string, EmployeeStatRow>()

    for (const t of txs) {
      if (t.txType !== 'ISSUE') continue
      const cleanNo = t.empNo.trim()
      const cleanName = t.empName.trim()
      if (!cleanNo && !cleanName) continue
      const key = cleanNo || cleanName
      const kstTxDate = getKstDateString(t.txDate)

      const existing = computedMap.get(key) ?? {
        key,
        empNo: cleanNo || '-',
        empName: cleanName || '(미입력)',
        issueCount: 0,
        exchangeCount: 0,
        totalFreq: 0,
        totalQty: 0,
        lastDate: kstTxDate,
      }

      if (cleanNo && existing.empNo === '-') existing.empNo = cleanNo
      if (cleanName && existing.empName === '(미입력)') existing.empName = cleanName

      existing.issueCount += 1
      existing.totalFreq += 1
      existing.totalQty += t.qty

      if (kstTxDate >= existing.lastDate) existing.lastDate = kstTxDate
      computedMap.set(key, existing)
    }

    const q = empSearch.trim().toLowerCase()
    return Array.from(computedMap.values())
      .filter((row) =>
        !q
          ? true
          : row.empNo.toLowerCase().includes(q) || row.empName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalFreq - a.totalFreq || b.issueCount - a.issueCount)
  }, [txs, empSearch])

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
    setStatusNote(nextType === 'ISSUE' ? '지급완료' : '입고완료')
  }

  const computeNextStockQty = (cell: StockCell, targetQty: number, targetType: TxTypeKey) => {
    const nextAvail =
      targetType === 'ISSUE'
        ? Math.max(0, cell.availableQty - targetQty)
        : cell.availableQty + targetQty
    return {
      availableQty: nextAvail,
      repairQty: cell.repairQty,
      disposedQty: cell.disposedQty,
    }
  }

  const handleTxFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    const trimmedEmpNo = empNo.trim()
    const trimmedEmpName = empName.trim()

    if (!trimmedEmpNo || !trimmedEmpName) {
      setNotice({
        ok: false,
        msg: '지급 · 입고 등록 시 사원번호와 사원명을 모두 입력해 주세요. (등록 잠금)',
      })
      return
    }

    if (!selectedItem || !currentStockCell) {
      setNotice({
        ok: false,
        msg: '등록된 품목 또는 사이즈 재고가 없습니다. 먼저 품목을 등록해 주세요.',
      })
      return
    }
    if (qty < 1) {
      setNotice({ ok: false, msg: '수량은 1 이상이어야 합니다.' })
      return
    }

    if (txType === 'ISSUE' && currentStockCell.availableQty < qty) {
      setNotice({
        ok: false,
        msg: `가용 재고가 부족합니다. (${selectedItem.itemName} ${selectedSize} 현재 ${currentStockCell.availableQty}${selectedItem.unit})`,
      })
      return
    }

    const normalizedDate = getKstDateString(txDate)
    const nextQuantities = computeNextStockQty(currentStockCell, qty, txType)
    setPendingTxConfirm({
      txType,
      txDate: normalizedDate,
      empNo: trimmedEmpNo,
      empName: trimmedEmpName,
      item: selectedItem,
      stockCell: currentStockCell,
      qty,
      reason,
      statusNote: statusNote.trim() || '처리완료',
      memo: memo.trim(),
      nextQuantities,
    })
  }

  const executeConfirmedTx = async () => {
    if (!pendingTxConfirm) return
    const {
      txType: pType,
      txDate: pDate,
      empNo: cleanNo,
      empName: cleanName,
      item: targetItem,
      stockCell: targetCell,
      qty: pQty,
      reason: pReason,
      statusNote: pStatus,
      memo: pMemo,
      nextQuantities,
    } = pendingTxConfirm

    let savedTxId = `tx-${Date.now()}`
    let dbSynced = false

    if (dbConnected && targetCell.id && UUID_REGEX.test(targetCell.id)) {
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
          .eq('id', targetCell.id)

        if (stockErr) throw stockErr

        const { data: txInserted, error: txErr } = await supabase
          .from('stock_transactions')
          .insert({
            tx_date: pDate,
            tx_type: pType,
            reason: pReason,
            employee_id: employeeId,
            emp_no: cleanNo || null,
            emp_name: cleanName || null,
            stock_id: targetCell.id,
            qty: pQty,
            return_condition: null,
            status_note: pStatus,
            memo: pMemo || null,
          })
          .select('id')
          .single()

        if (txErr) throw txErr
        if (txInserted?.id) savedTxId = String(txInserted.id)
        dbSynced = true
      } catch (err: any) {
        setPendingTxConfirm(null)
        setNotice({
          ok: false,
          msg: `Supabase 저장 중 오류: ${err?.message ?? '권한 또는 스키마 확인 필요'}`,
        })
        return
      }
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== targetItem.id) return item
        return {
          ...item,
          stocks: item.stocks.map((s) =>
            s.sizeLabel === targetCell.sizeLabel ? { ...s, ...nextQuantities } : s
          ),
        }
      })
    )

    const newRecord: TxRecord = {
      id: savedTxId,
      txDate: pDate,
      txType: pType,
      reason: pReason,
      empNo: cleanNo,
      empName: cleanName,
      itemId: targetItem.id,
      itemName: targetItem.itemName,
      sizeLabel: targetCell.sizeLabel,
      stockId: targetCell.id,
      qty: pQty,
      statusNote: pStatus,
      memo: pMemo || undefined,
    }

    setTxs((prev) => [newRecord, ...prev])
    setPendingTxConfirm(null)
    resetTxInputsAfterSave()
    setNotice({
      ok: true,
      msg: `[${pType === 'ISSUE' ? '지급' : '입고'} 완료] ${cleanName || cleanNo || '재고'} — ${targetItem.itemName} (${targetCell.sizeLabel}) ${pQty}${targetItem.unit}${dbSynced ? ' (DB 반영됨)' : ' (화면 상태 반영)'}`,
    })
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = formItemName.trim()
    if (!trimmedName) {
      setNotice({ ok: false, msg: '품목명 또는 모델명을 입력해 주세요.' })
      return
    }

    const resolvedGroup: SubGroupKey = formCategory === 'SAFETY_SHOE' ? 'MODEL' : formSubGroup
    const resolvedCode = formItemCode.trim() || trimmedName.toUpperCase()
    const resolvedUnit = formCategory === 'WORKWEAR' ? '벌' : '켤레'
    const resolvedImageUrl = formImageUrl.trim() || null

    if (editingItemId) {
      const target = items.find((i) => i.id === editingItemId)
      if (!target) return

      if (dbConnected && UUID_REGEX.test(target.id)) {
        try {
          const { error: updErr } = await supabase
            .from('items')
            .update({
              category: formCategory,
              sub_group: resolvedGroup,
              item_code: resolvedCode,
              item_name: trimmedName,
              unit: resolvedUnit,
              image_url: resolvedImageUrl,
            })
            .eq('id', target.id)

          if (updErr) throw updErr
        } catch (err: any) {
          setNotice({
            ok: false,
            msg: `품목 수정 DB 오류: ${err?.message ?? '확인 필요'}`,
          })
          return
        }
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? {
                ...item,
                category: formCategory,
                subGroup: resolvedGroup,
                itemCode: resolvedCode,
                itemName: trimmedName,
                unit: resolvedUnit,
                imageUrl: resolvedImageUrl,
              }
            : item
        )
      )
      setCategoryFilter(formCategory)
      setItemFilterId('ALL')
      resetItemForm(formCategory)
      setNotice({
        ok: true,
        msg: `수정 완료: '${trimmedName}' (${resolvedCode}) 품목 정보가 저장되었습니다.`,
      })
      return
    }

    // 신규 등록 (사이즈별 초기재고 개별 적용)
    const baseSizes = formCategory === 'WORKWEAR' ? WORKWEAR_SIZES : SHOE_SIZES
    const totalInitQty = baseSizes.reduce(
      (sum, s) => sum + Math.max(0, Number(sizeQtyMap[s.label] ?? 0)),
      0
    )

    let createdId = `custom-${Date.now()}`
    let stocksWithIds: StockCell[] = baseSizes.map((s) => ({
      sizeLabel: s.label,
      sizeOrder: s.order,
      availableQty: Math.max(0, Number(sizeQtyMap[s.label] ?? 0)),
      repairQty: 0,
      disposedQty: 0,
      minQty: 3,
    }))

    if (dbConnected) {
      try {
        const { data: insertedItem, error: itemErr } = await supabase
          .from('items')
          .insert({
            category: formCategory,
            sub_group: resolvedGroup,
            item_code: resolvedCode,
            item_name: trimmedName,
            unit: resolvedUnit,
            image_url: resolvedImageUrl,
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
            available_qty: Math.max(0, Number(sizeQtyMap[s.label] ?? 0)),
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
      category: formCategory,
      subGroup: resolvedGroup,
      itemCode: resolvedCode,
      itemName: trimmedName,
      unit: resolvedUnit,
      imageUrl: resolvedImageUrl,
      sortOrder: items.length + 1,
      stocks: stocksWithIds,
    }

    setItems((prev) => [...prev, created])
    setCategoryFilter(created.category)
    setItemFilterId('ALL')
    setSelectedItemId(created.id)
    setSelectedSize(created.stocks[0]?.sizeLabel ?? '')
    resetItemForm(formCategory)
    setNotice({
      ok: true,
      msg: `등록 완료: '${created.itemName}' (초기 총 ${totalInitQty}${created.unit})이(가) 추가되었습니다.`,
    })
  }

  // 품목 삭제 시 DB 테이블(item_stocks, items)에서 실제 삭제
  const executeDeleteItem = async (item: ItemEntry) => {
    let dbDeleted = false
    if (dbConnected && UUID_REGEX.test(item.id)) {
      try {
        const { error: stockDelErr } = await supabase
          .from('item_stocks')
          .delete()
          .eq('item_id', item.id)

        if (stockDelErr) throw stockDelErr

        const { error: itemDelErr } = await supabase.from('items').delete().eq('id', item.id)

        if (itemDelErr) throw itemDelErr
        dbDeleted = true
      } catch (err: any) {
        setDeleteItemTarget(null)
        setNotice({
          ok: false,
          msg: `품목 DB 삭제 오류: ${err?.message ?? '확인 필요'}`,
        })
        return
      }
    }

    const remaining = items.filter((i) => i.id !== item.id)
    setItems(remaining)

    if (editingItemId === item.id) {
      resetItemForm(formCategory)
    }

    if (itemFilterId === item.id) {
      setItemFilterId('ALL')
    }

    if (selectedItemId === item.id) {
      if (remaining[0]) {
        setSelectedItemId(remaining[0].id)
        setSelectedSize(remaining[0].stocks[0]?.sizeLabel ?? '')
      } else {
        setSelectedItemId('')
        setSelectedSize('')
      }
    }

    setDeleteItemTarget(null)
    setNotice({
      ok: true,
      msg: `삭제 완료: '${item.itemName}' (${item.itemCode}) 품목이 삭제되었습니다.${dbDeleted ? ' (DB 테이블 삭제 완료)' : ''}`,
    })
  }

  // 처리 이력 삭제 시 DB 테이블(stock_transactions)에서 실제 삭제
  const executeDeleteTx = async (tx: TxRecord) => {
    let dbDeleted = false
    if (dbConnected && UUID_REGEX.test(tx.id)) {
      try {
        const { error: txDelErr } = await supabase
          .from('stock_transactions')
          .delete()
          .eq('id', tx.id)

        if (txDelErr) throw txDelErr
        dbDeleted = true
      } catch (err: any) {
        setDeleteTxTarget(null)
        setNotice({
          ok: false,
          msg: `처리 이력 DB 삭제 오류: ${err?.message ?? '확인 필요'}`,
        })
        return
      }
    }

    setTxs((prev) => prev.filter((row) => row.id !== tx.id))
    setDeleteTxTarget(null)
    setNotice({
      ok: true,
      msg: `이력 삭제 완료: ${getKstDateString(tx.txDate)} · ${tx.itemName} (${tx.sizeLabel}) ${tx.qty}개 이력이 삭제되었습니다.${dbDeleted ? ' (DB 테이블 삭제 완료)' : ''}`,
    })
  }

  const handleExportCsv = () => {
    const kstToday = getKstDateString()
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
    a.download = `작업복_안전화_재고현황_${kstToday}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeSizeList = formCategory === 'WORKWEAR' ? WORKWEAR_SIZES : SHOE_SIZES

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* 0. 제품 사진 확대 팝업 모달 */}
      {photoModal && (
        <div
          onClick={() => setPhotoModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{photoModal.title}</h3>
                {photoModal.subtitle && (
                  <p className="mt-0.5 text-xs text-slate-500">{photoModal.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPhotoModal(null)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex max-h-[65vh] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img
                src={photoModal.imageUrl}
                alt={photoModal.title}
                className="max-h-[58vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 1. 품목 삭제 확인 모달 */}
      {deleteItemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">품목 삭제 확인</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  <span className="font-bold text-slate-900">
                    [{deleteItemTarget.category === 'WORKWEAR' ? '작업복' : '안전화'}]{' '}
                    {deleteItemTarget.itemName} ({deleteItemTarget.itemCode})
                  </span>
                  을(를) 정말 삭제하시겠습니까? 관련 재고 및 품목 DB 데이터도 함께 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItemTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => executeDeleteItem(deleteItemTarget)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                확인 후 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 처리 이력 삭제 확인 모달 */}
      {deleteTxTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">처리 이력 삭제 확인</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  <span className="font-bold text-slate-900">
                    {getKstDateString(deleteTxTarget.txDate)} ·{' '}
                    {deleteTxTarget.txType === 'ISSUE' ? '지급' : '입고'} · {deleteTxTarget.itemName}{' '}
                    ({deleteTxTarget.sizeLabel}) {deleteTxTarget.qty}개
                  </span>
                  이력을 삭제하시겠습니까? DB 거래 이력 테이블에서도 함께 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTxTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => executeDeleteTx(deleteTxTarget)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                확인 후 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 지급 · 입고 등록 확인 팝업 */}
      {pendingTxConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">
              {pendingTxConfirm.txType === 'ISSUE' ? '지급 등록 확인' : '입고 등록 확인'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              입력 내용을 확인해 주세요. 저장 후 입력 칸은 자동으로 초기화됩니다.
            </p>

            <div className="mt-3.5 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">구분 / 일자(KST)</span>
                <span className="font-semibold text-slate-900">
                  {pendingTxConfirm.txType === 'ISSUE' ? '지급' : '입고'} · {pendingTxConfirm.txDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">사원</span>
                <span className="font-semibold text-slate-900">
                  {pendingTxConfirm.empName} ({pendingTxConfirm.empNo})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">품목 / 사이즈</span>
                <span className="font-semibold text-slate-900">
                  {pendingTxConfirm.item.itemName} · {pendingTxConfirm.stockCell.sizeLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">처리 수량</span>
                <span className="font-bold text-blue-700">
                  {pendingTxConfirm.txType === 'ISSUE' ? '-' : '+'}
                  {pendingTxConfirm.qty}
                  {pendingTxConfirm.item.unit}
                </span>
              </div>
              {pendingTxConfirm.memo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">메모</span>
                  <span className="font-semibold text-slate-900">{pendingTxConfirm.memo}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500">반영 후 재고</span>
                <span className="font-bold text-slate-900">
                  {pendingTxConfirm.stockCell.availableQty} →{' '}
                  {pendingTxConfirm.nextQuantities.availableQty}
                  {pendingTxConfirm.item.unit}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTxConfirm(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={executeConfirmedTx}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                확인 및 반영
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {dbConnected ? 'Supabase 연결됨' : '로컬 연결 대기'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                한국 시간(KST) 기준 · DB 테이블 기준 조회 · 썸네일 클릭 시 사진 팝업
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowItemManager((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              품목 관리
            </button>
            <button
              type="button"
              onClick={() => loadFromSupabase(true)}
              disabled={loadingDb}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
              DB 불러오기
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              엑셀(CSV)
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

        {/* 품목 등록 · 수정 · 삭제 관리 패널 */}
        {showItemManager && (
          <div className="space-y-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">품목 관리 (등록 · 수정 · 삭제)</h2>
                {editingItemId && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">
                    수정 모드 활성화됨
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetItemForm(formCategory)
                  setShowItemManager(false)
                }}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                닫기
              </button>
            </div>

            <form
              onSubmit={handleSaveItem}
              className={`space-y-3.5 rounded-xl p-4 transition ${
                editingItemId
                  ? 'border-2 border-amber-400 bg-amber-50/80 shadow-xs ring-4 ring-amber-100'
                  : 'border border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900">
                  {editingItemId ? (
                    <span className="text-amber-900">
                      ✎ 등록 품목 수정 — 선택한 품목의 정보와 제품 사진을 수정합니다.
                    </span>
                  ) : (
                    <span>+ 신규 품목 등록 — 사이즈별 초기재고와 제품 사진을 입력합니다.</span>
                  )}
                </div>
                {editingItemId && (
                  <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                    대상 품목: {formItemName || '선택 품목'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">분류</label>
                  <select
                    value={formCategory}
                    onChange={(e) => handleCategoryFormChange(e.target.value as CategoryKey)}
                    className={inputClass}
                  >
                    <option value="WORKWEAR">작업복</option>
                    <option value="SAFETY_SHOE">안전화</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">구분</label>
                  <select
                    value={formCategory === 'SAFETY_SHOE' ? 'MODEL' : formSubGroup}
                    disabled={formCategory === 'SAFETY_SHOE'}
                    onChange={(e) => setFormSubGroup(e.target.value as SubGroupKey)}
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
                    value={formItemCode}
                    onChange={(e) => setFormItemCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    품목명 / 모델명 *
                  </label>
                  <input
                    type="text"
                    placeholder="예: 자켓, 동잠바, 조끼"
                    value={formItemName}
                    onChange={(e) => setFormItemName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <button
                    type="submit"
                    className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white shadow-xs ${
                      editingItemId
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingItemId ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        수정 저장
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        품목 등록
                      </>
                    )}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => resetItemForm(formCategory)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>

              {/* 제품 사진(image_url) 입력 / 파일 선택 및 썸네일 미리보기 */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    제품 사진 (image_url 또는 사진 파일 선택)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://... 또는 파일 선택"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      className={`${inputClass} flex-1`}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                      사진 선택
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                    {formImageUrl && (
                      <button
                        type="button"
                        onClick={() => setFormImageUrl('')}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      >
                        사진 지우기
                      </button>
                    )}
                  </div>
                </div>

                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoModal({
                        title: formItemName.trim() || '제품 사진 미리보기',
                        subtitle: formItemCode.trim() || undefined,
                        imageUrl: formImageUrl,
                      })
                    }
                    title="클릭하여 크게 보기"
                    className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-50 shadow-2xs"
                  >
                    <img
                      src={formImageUrl}
                      alt={formItemName || '제품 썸네일'}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                )}
              </div>

              {/* 신규 등록 시 사이즈별 초기재고 개별 입력 그리드 */}
              {!editingItemId && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2.5">
                    <span className="text-xs font-semibold text-slate-800">
                      사이즈별 초기재고 ({formCategory === 'WORKWEAR' ? '작업복 · 벌' : '안전화 · 켤레'})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-8">
                    {activeSizeList.map((sz) => (
                      <div
                        key={sz.label}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-2"
                      >
                        <label className="mb-1 block truncate text-[11px] font-semibold text-slate-700">
                          {sz.label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={sizeQtyMap[sz.label] ?? 0}
                          onChange={(e) => handleSizeQtyChange(sz.label, e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* 등록된 품목 목록 (썸네일 클릭 팝업 / 수정 / 삭제) */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">사진</th>
                    <th className="px-3 py-2">분류</th>
                    <th className="px-3 py-2">구분</th>
                    <th className="px-3 py-2">코드</th>
                    <th className="px-3 py-2">품목명</th>
                    <th className="px-3 py-2 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                        등록된 품목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isBeingEdited = editingItemId === item.id
                      return (
                        <tr
                          key={item.id}
                          className={isBeingEdited ? 'bg-amber-50/70' : 'hover:bg-slate-50'}
                        >
                          <td className="px-3 py-2">
                            {item.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => openItemPhotoPopup(item)}
                                title="사진 확대 보기"
                                className="h-9 w-9 overflow-hidden rounded-md border border-slate-300 bg-slate-50 hover:ring-2 hover:ring-blue-400"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.itemName}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-300">
                                <ImageIcon className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {item.category === 'WORKWEAR' ? '작업복' : '안전화'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.subGroup === 'BASIC'
                              ? '기본지급'
                              : item.subGroup === 'EXTRA'
                                ? '기타품목'
                                : '모델별'}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600">{item.itemCode}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {item.itemName}
                            {isBeingEdited && (
                              <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                수정 중
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditItem(item)}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                <Pencil className="h-3 w-3" />
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteItemTarget(item)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                              >
                                <Trash2 className="h-3 w-3" />
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 품목 · 사이즈별 재고 현황표 (작업복 / 안전화 분리) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">품목 · 사이즈별 재고 현황표</h2>
            <span className="text-xs text-slate-500">
              표시 품목 {visibleItems.length}종 ·{' '}
              {hideZeroStock
                ? `0 재고 ${hiddenZeroRowCount}행 숨김 중`
                : '0 재고 포함 전체 표시 중'}
            </span>
          </div>

          {/* 작업복 / 안전화 필터 + 품목 선택 + 검색어 + 0 재고 보기/숨기기 토글 */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['WORKWEAR', '작업복'],
                  ['SAFETY_SHOE', '안전화'],
                ] as const
              ).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(catKey)
                    setItemFilterId('ALL')
                  }}
                  className={`rounded-lg border px-3 py-1 font-semibold transition ${
                    categoryFilter === catKey
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {catLabel}
                </button>
              ))}

              <select
                value={itemFilterId}
                onChange={(e) => setItemFilterId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">
                  {categoryFilter === 'WORKWEAR' ? '작업복' : '안전화'} 전체 (
                  {categoryFilteredItems.length}종)
                </option>
                {categoryFilteredItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.itemName} ({it.itemCode})
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="품목명·코드 검색"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white py-1 pr-2.5 pl-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {(itemFilterId !== 'ALL' || itemSearch.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setItemFilterId('ALL')
                    setItemSearch('')
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                >
                  필터 초기화
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHideZeroStock((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                hideZeroStock
                  ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              {hideZeroStock ? (
                <>
                  <Eye className="h-3.5 w-3.5 text-blue-600" />0 재고 보기
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-amber-700" />0 재고 숨기기
                </>
              )}
            </button>
          </div>

          {/* 가로 스크롤 + 왼쪽 사이즈 열 고정 */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="sticky left-0 z-10 min-w-[118px] border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]">
                    사이즈 \ 품목
                  </th>
                  {visibleItems.map((item) => (
                    <th key={item.id} className="min-w-[104px] px-2.5 py-2.5 font-semibold">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.imageUrl && (
                          <button
                            type="button"
                            onClick={() => openItemPhotoPopup(item)}
                            title={`${item.itemName} 사진 보기`}
                            className="h-6 w-6 shrink-0 overflow-hidden rounded border border-slate-300 bg-white hover:ring-2 hover:ring-blue-400"
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.itemName}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        )}
                        <span className="text-slate-900">{item.itemName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                        {item.itemCode} · {item.unit}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + visibleItems.length}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      표시할 품목이 없습니다. (0건)
                    </td>
                  </tr>
                ) : matrixRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + visibleItems.length}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      재고가 0보다 큰 사이즈가 없습니다. [0 재고 보기]를 누르면 0 재고 행을 볼 수
                      있습니다.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map((row) => (
                    <tr key={row.sizeLabel} className="group hover:bg-slate-50/80">
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2.5 text-left font-medium text-slate-800 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] group-hover:bg-slate-50">
                        {row.sizeLabel}
                      </td>
                      {visibleItems.map((item) => {
                        const cell = item.stocks.find((s) => s.sizeLabel === row.sizeLabel)
                        const val = cell?.availableQty ?? 0
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
                              className={`w-full min-w-[64px] rounded-lg px-2 py-1.5 font-semibold transition ${badgeClass} ${
                                isSelected ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                              {val}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {visibleItems.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-300 bg-slate-100 font-bold text-slate-900">
                    <td className="sticky left-0 z-10 border-r border-slate-300 bg-slate-100 px-3 py-2.5 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]">
                      품목 합계
                    </td>
                    {visibleItems.map((item) => {
                      const colSum = item.stocks.reduce((acc, s) => acc + s.availableQty, 0)
                      return (
                        <td key={item.id} className="px-3 py-2.5">
                          {colSum}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* 하단: 지급/입고 등록(파스텔 톤 구분) + 사원별 지급 빈도 집계 및 처리 이력 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleTxFormSubmit}
            className={`space-y-3.5 rounded-2xl border p-4 shadow-xs transition lg:col-span-6 ${
              txType === 'ISSUE'
                ? 'border-sky-200 bg-sky-50/75'
                : 'border-teal-200 bg-teal-50/75'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b pb-3 ${
                txType === 'ISSUE' ? 'border-sky-200/80' : 'border-teal-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight
                  className={`h-4 w-4 ${txType === 'ISSUE' ? 'text-sky-700' : 'text-teal-700'}`}
                />
                <h2 className="text-sm font-bold text-slate-900">
                  지급 · 입고 등록 ({txType === 'ISSUE' ? '지급 모드' : '입고 모드'})
                </h2>
              </div>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${
                  txType === 'ISSUE'
                    ? 'bg-sky-100/90 text-sky-800 ring-sky-300'
                    : 'bg-teal-100/90 text-teal-800 ring-teal-300'
                }`}
              >
                현재고: {currentStockCell?.availableQty ?? 0}
                {selectedItem?.unit ?? ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => handleTxTypeChange('ISSUE')}
                className={`rounded-lg py-2 font-semibold transition ${
                  txType === 'ISSUE'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-sky-50 hover:text-slate-900'
                }`}
              >
                지급
              </button>
              <button
                type="button"
                onClick={() => handleTxTypeChange('INBOUND')}
                className={`rounded-lg py-2 font-semibold transition ${
                  txType === 'INBOUND'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-teal-50 hover:text-slate-900'
                }`}
              >
                입고
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  처리 일자 (KST)
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사원번호 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: EMP-105"
                  value={empNo}
                  onChange={(e) => setEmpNo(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사원명 *</label>
                <input
                  type="text"
                  required
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
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedItem?.id ?? ''}
                    onChange={(e) => {
                      const nextItem = items.find((i) => i.id === e.target.value)
                      if (nextItem) {
                        setSelectedItemId(nextItem.id)
                        setSelectedSize(nextItem.stocks[0]?.sizeLabel ?? '')
                      }
                    }}
                    className={`${inputClass} flex-1`}
                  >
                    {items.length === 0 ? (
                      <option value="">등록된 품목 없음</option>
                    ) : (
                      items.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.category === 'WORKWEAR' ? '작업복' : '안전화'}] {item.itemName}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedItem?.imageUrl && (
                    <button
                      type="button"
                      onClick={() => openItemPhotoPopup(selectedItem)}
                      title="선택 품목 사진 보기"
                      className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white hover:ring-2 hover:ring-blue-400"
                    >
                      <img
                        src={selectedItem.imageUrl}
                        alt={selectedItem.itemName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">사이즈</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className={inputClass}
                >
                  {!selectedItem || selectedItem.stocks.length === 0 ? (
                    <option value="">사이즈 없음</option>
                  ) : (
                    selectedItem.stocks.map((s) => (
                      <option key={s.sizeLabel} value={s.sizeLabel}>
                        {s.sizeLabel} (재고 {s.availableQty})
                      </option>
                    ))
                  )}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  placeholder="메모 입력"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-xs transition ${
                txType === 'ISSUE'
                  ? 'bg-sky-600 hover:bg-sky-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              ✓ 등록 및 재고 반영
            </button>
          </form>

          {/* 사원별 지급 빈도 집계 및 최근 처리 이력 */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">사원별 지급 빈도 집계</h2>
              </div>
              <input
                type="text"
                placeholder="사원명 또는 사원번호 검색"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">사원번호</th>
                    <th className="px-3 py-2">사원명</th>
                    <th className="px-3 py-2 text-right">지급 횟수</th>
                    <th className="px-3 py-2 text-right">총 수량</th>
                    <th className="px-3 py-2 text-right">최근일(KST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {employeeStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        집계된 사원 이력이 없습니다. (0건)
                      </td>
                    </tr>
                  ) : (
                    employeeStats.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-700">{row.empNo}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{row.empName}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-600">
                          {row.issueCount}회
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">
                          {row.totalQty}개
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {row.lastDate ? getKstDateString(row.lastDate) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">
                  최근 처리 이력 ({txs.length}건)
                </h3>
                <button
                  type="button"
                  onClick={() => setTxManageMode((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                    txManageMode
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Settings2 className="h-3 w-3" />
                  (관리)
                </button>
              </div>

              <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
                {txs.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-slate-400">
                    등록된 처리 이력이 없습니다. (0건)
                  </li>
                ) : (
                  txs.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="space-y-0.5 text-slate-800">
                        <div>
                          <span className="mr-2 font-mono text-[11px] text-slate-500">
                            {getKstDateString(t.txDate)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {t.empName || '-'} {t.empNo ? `(${t.empNo})` : ''}
                          </span>
                          <span className="mx-1.5 text-slate-400">/</span>
                          <span>
                            {t.itemName} · {t.sizeLabel} · {t.qty}개
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">[{t.reason}]</span>
                        </div>
                        {t.memo && (
                          <div className="text-[11px] font-medium text-amber-800">
                            메모: {t.memo}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            t.txType === 'ISSUE'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {t.txType === 'ISSUE' ? '지급' : '입고'}
                        </span>
                        {txManageMode && (
                          <button
                            type="button"
                            onClick={() => setDeleteTxTarget(t)}
                            className="inline-flex items-center gap-0.5 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            삭제
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App