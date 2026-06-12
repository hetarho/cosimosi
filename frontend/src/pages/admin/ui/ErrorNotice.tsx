// 쿼리 실패 안내 + 재시도 행 — AdminPage(설정)와 OverviewSection(대시보드)이 공유.
import { errorMessage } from '@/shared/lib'

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-red-500/10 px-3 py-2">
      <p className="text-sm text-red-300">⚠ {errorMessage(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-md bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20"
      >
        다시 시도
      </button>
    </div>
  )
}
