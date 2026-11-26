import { useCallback, useEffect, useState } from 'react'
import {
  Package,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { GearIssueTab } from './gearIssue/GearIssueTab'
import { SafetyOpsTab } from './safetyOps/SafetyOpsTab'
import {
  type ActiveTabKey,
  type CategoryKey,
  type ItemEntry,
  type NoticeState,
  type PendingTxConfirm,
  type PhotoModalState,
  type StockCell,
  type SubGroupKey,
  type TxRecord,
  type TxTypeKey,
  UUID_REGEX,
  getKstDateString,
} from './types/gearInventory'

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabKey>('GEAR_ISSUE')
  const [items, setItems] = useState<ItemEntry[]>([])
  const [txs, setTxs] = useState<TxRecord[]>([])
  const [dbConnected, setDbConnected] = useState<boolean>(false)
  const [loadingDb, setLoadingDb] = useState<boolean>(false)

  // 선택 품목 및 사이즈 상태 (재고표 셀 클릭 / 지급·입고 폼 동기화)
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')

  // 공통 팝업 및 삭제 동기화 상태
  const [photoModal, setPhotoModal] = useState<PhotoModalState | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<ItemEntry | null>(null)
  const [deleteTxTarget, setDeleteTxTarget] = useState<TxRecord | null>(null)
  const [pendingTxConfirm, setPendingTxConfirm] = useState<PendingTxConfirm | null>(null)
  const [txResetSignal, setTxResetSignal] = useState<number>(0)
  const [deletedItemIdSignal, setDeletedItemIdSignal] = useState<string | null>(null)
  const [deletedTxIdSignal, setDeletedTxIdSignal] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)

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
    setTxResetSignal((n) => n + 1)
    setNotice({
      ok: true,
      msg: `[${pType === 'ISSUE' ? '지급' : '입고'} 완료] ${cleanName} (${cleanNo}) — ${targetItem.itemName} (${targetCell.sizeLabel}) ${pQty}${targetItem.unit}${dbSynced ? ' (DB 반영됨)' : ' (화면 상태 반영)'}`,
    })
  }

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
    setDeletedItemIdSignal(item.id)

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
    setDeletedTxIdSignal(tx.id)
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
                  {activeTab === 'GEAR_ISSUE'
                    ? '작업복 · 안전화 지급관리'
                    : '안전관리'}
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
            {/* 헤더 메뉴 전환 박스 */}
            <div
              role="tablist"
              aria-label="주요 메뉴 전환"
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'GEAR_ISSUE'}
                onClick={() => {
                  if (activeTab === 'GEAR_ISSUE') return
                  setActiveTab('GEAR_ISSUE')
                  setNotice({
                    ok: true,
                    msg: '작업복·안전화 지급관리 화면으로 전환되었습니다.',
                  })
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'GEAR_ISSUE'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                작업복·안전화 지급관리
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'SAFETY_OPS'}
                onClick={() => {
                  if (activeTab === 'SAFETY_OPS') return
                  setActiveTab('SAFETY_OPS')
                  setNotice({
                    ok: true,
                    msg: '안전관리 화면으로 전환되었습니다.',
                  })
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'SAFETY_OPS'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                안전관리
              </button>
            </div>

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

        {activeTab === 'GEAR_ISSUE' ? (
          <GearIssueTab
            items={items}
            setItems={setItems}
            txs={txs}
            dbConnected={dbConnected}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
            onNotice={setNotice}
            onOpenPhotoModal={setPhotoModal}
            onRequestDeleteItem={setDeleteItemTarget}
            onRequestDeleteTx={setDeleteTxTarget}
            onRequestConfirmTx={setPendingTxConfirm}
            txResetSignal={txResetSignal}
            deletedItemIdSignal={deletedItemIdSignal}
            deletedTxIdSignal={deletedTxIdSignal}
          />
        ) : (
          <SafetyOpsTab />
        )}
      </main>
    </div>
  )
}
export default App