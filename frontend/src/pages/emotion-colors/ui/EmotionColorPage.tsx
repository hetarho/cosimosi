// 감정색 설정/편집 페이지(spec 45) — `/emotion-colors`. 13개 mood 색을 추천값으로 시작해 한 번에
// 저장하는 필수 설정이자, 이후 재방문해 수정하는 편집 페이지다. change 09: 편집 본체는 재사용
// EmotionColorEditor로 추출돼 우주 셸 꾸미기 표면의 `감정 색` 섹션과 공유된다. 이 페이지는 헤더 +
// 저장 성공 후 redirect(없으면 `/`)만 담당한다. 저장 규칙(full-set)·로딩/오류는 editor가 가진다.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { EmotionColorEditor } from '@/features/pick-emotion-colors'

export function EmotionColorPage() {
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/emotion-colors' })

  return (
    <div className="min-h-dvh w-full bg-[#05060f] text-white/90">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-8">
        <header className="mb-6">
          <h1 className="text-xl font-light tracking-[0.08em] text-white/90">감정의 색을 정해요</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/45">
            기억의 별은 그 순간의 감정으로 빛나요. 13가지 감정마다 색을 골라 두면, 그 색으로 우주가 그려져요.
          </p>
        </header>

        <EmotionColorEditor
          onSaved={() => void navigate({ to: redirect ?? '/' })}
          saveLabel="저장하고 우주로"
        />
      </div>
    </div>
  )
}
