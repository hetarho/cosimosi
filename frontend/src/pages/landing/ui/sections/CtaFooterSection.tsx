import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { Sparkles, ArrowRight, Mail, Rocket } from 'lucide-react'
import { GlassCard, Section } from '@/shared/ui'
import { MOOD } from '@/shared/config'
import { enterDemoMode } from '@/shared/demo'

// 대기자 등록 폼 스키마 (zod v4)
const schema = z.object({
  email: z.email('올바른 이메일을 입력해주세요'),
})
type Values = z.infer<typeof schema>

export function CtaFooterSection() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)

  // 체험("demo") 모드 진입: 로그인/DB 없이 더미 우주로 바로 들어간다. 플래그를 먼저
  // 켜고 /universe로 이동하면 세션 게이트가 통과시키고 API들이 더미데이터를 돌려준다.
  const tryDemo = () => {
    enterDemoMode()
    void navigate({ to: '/universe' })
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  // mock: 실제 백엔드 전송 없음. 폼 값은 사용하지 않고 제출을 시뮬레이션해 감사 상태로 전환한다.
  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    toast.success('잘 받았어요. 공개되면 가장 먼저 알려드릴게요.')
    setSubmitted(true)
  }

  return (
    <Section id="cta" className="flex flex-col items-center gap-12 text-center">
      <div className="flex flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-widest text-mood-amber/90">
          <Sparkles size={14} aria-hidden />
          곧 공개
        </span>
        <h2 className="font-display text-4xl leading-tight text-white/90 sm:text-5xl">
          당신의 기억으로
          <br />
          우주 하나를 띄워볼까요?
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
          오늘 쓴 한 편이 별이 되고, 떠올릴 때마다 다시 빛나요. 잊어도 사라지지 않는 엔그램 우주를,
          가장 먼저 만나봐요.
        </p>

        {/* 가입 없이 바로 둘러보기 — 더미 우주를 띄워 별 추가·회상·잠든 별까지 체험한다. */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            type="button"
            onClick={tryDemo}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-mood-teal/40 bg-mood-teal/15 px-6 py-3 text-sm font-medium text-mood-teal transition hover:bg-mood-teal/25 sm:text-base"
          >
            <Rocket size={18} aria-hidden />
            가입 없이 들어가 보기
            <ArrowRight size={16} aria-hidden />
          </motion.button>
          <span className="text-xs text-white/40">로그인 없이 둘러볼 수 있어요. 새로고침하면 처음으로 돌아가요.</span>
        </div>
      </div>

      <GlassCard className="w-full max-w-md p-6 sm:p-8">
        {submitted ? (
          <motion.div
            className="flex flex-col items-center gap-3 py-2"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${MOOD.teal}22`, color: MOOD.teal }}
            >
              <Sparkles size={22} aria-hidden />
            </span>
            <p className="font-display text-lg text-white/90">메일을 받아 두었어요</p>
            <p className="text-sm leading-relaxed text-white/60">
              공개되면 가장 먼저 알려드릴게요. 기다려주셔서 고마워요.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <label htmlFor="cta-email" className="text-left text-xs uppercase tracking-widest text-mood-violet/80">
              공개 소식 받기
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                />
                <input
                  id="cta-email"
                  type="email"
                  placeholder="you@cosimosi.space"
                  autoComplete="email"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  className="w-full rounded-2xl border border-white/10 bg-space-800/60 py-3 pl-9 pr-3 text-sm text-white/90 outline-none transition placeholder:text-white/30 focus:border-mood-violet/60"
                  {...register('email')}
                />
              </div>
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mood-violet px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isSubmitting ? '보내는 중' : '받기'}
                <ArrowRight size={16} aria-hidden />
              </motion.button>
            </div>
            {errors.email && (
              <p className="text-left text-xs leading-relaxed text-mood-coral">{errors.email.message}</p>
            )}
            <p className="text-left text-xs leading-relaxed text-white/40">
              지금은 데모라 실제로 보내지는 않아요. 적어주신 메일은 저장하지 않아요.
            </p>
          </form>
        )}
      </GlassCard>

      <Footer />
    </Section>
  )
}

/** 랜딩 하단 푸터 (cta 섹션 내부 로컬 컴포넌트). */
function Footer() {
  return (
    <footer className="flex w-full flex-col items-center gap-3 border-t border-white/10 pt-10 text-center">
      <span className="font-display text-lg tracking-wide text-white/90">cosimosi</span>
      <p className="max-w-sm text-sm leading-relaxed text-white/60">
        우리 뇌는 하나의 작은 우주. 당신의 기억은 별이 되고, 그 사이는 빛의 선으로 이어져요.
      </p>
      <p className="text-xs leading-relaxed text-white/40">© 2026 cosimosi. All rights reserved.</p>
    </footer>
  )
}
