// The one place a background type maps to its node-builder. Each type is statically paired
// with the props its builder accepts (discriminated union), so a skin can't request nebula
// with gradient props. Adding a type = its module + one case here — no layer/host/seam change.
import { nebulaBackgroundNode, type NebulaProps } from './nebula.ts'
import { gradientBackgroundNode, type GradientProps } from './gradient.ts'
import { skyBackgroundNode, type SkyProps } from './sky.ts'

export type BackgroundType = 'nebula' | 'gradient' | 'sky'

export type BackgroundSpec =
  | { readonly type: 'nebula'; readonly props: NebulaProps }
  | { readonly type: 'gradient'; readonly props: GradientProps }
  | { readonly type: 'sky'; readonly props: SkyProps }

export function resolveBackgroundNode(spec: BackgroundSpec) {
  switch (spec.type) {
    case 'nebula':
      return nebulaBackgroundNode(spec.props)
    case 'gradient':
      return gradientBackgroundNode(spec.props)
    case 'sky':
      return skyBackgroundNode(spec.props)
  }
}
