// The one place a background type maps to its node-builder. Each type is statically paired
// with the props its builder accepts (discriminated union), so a skin can't request nebula
// with gradient props. Adding a type = its module + one case here — no layer/host/seam change.
import { nebulaBackgroundNode, type NebulaProps } from './nebula.ts'
import { gradientBackgroundNode, type GradientProps } from './gradient.ts'

export type BackgroundType = 'nebula' | 'gradient'

export type BackgroundSpec =
  | { readonly type: 'nebula'; readonly props: NebulaProps }
  | { readonly type: 'gradient'; readonly props: GradientProps }

export function resolveBackgroundNode(spec: BackgroundSpec) {
  switch (spec.type) {
    case 'nebula':
      return nebulaBackgroundNode(spec.props)
    case 'gradient':
      return gradientBackgroundNode(spec.props)
  }
}
