import { ShieldCheck, ClipboardCheck, AlertTriangle, BookOpen } from 'lucide-react'

export function SafetyOpsTab() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">안전관리</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                작업복·안전화 지급관리와 분리된 안전관리 전용 공간입니다. 필요한 항목부터 단계적으로
                구축할 수 있습니다.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            준비 중
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
              현장 안전점검
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              일상·정기 안전점검 체크리스트와 개선 조치 내역을 관리할 영역입니다.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              위험요인 · 아차사고
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              현장 위험요인 발굴 및 아차사고 기록과 조치 상태를 추적할 영역입니다.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              안전교육 · 보호구 현황
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              안전교육 이수 기록 및 보호구 착용/점검 기준을 정리할 영역입니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}