import { m } from '@cosimosi/i18n'

// One name per published ornament id, written out rather than assembled from the id at runtime: a
// constructed message key is invisible to the i18n tooling, and a missing name would then be a blank
// row nobody notices. Written out, the pair is checkable — and it is checked, against the same
// id fixture the Go catalog and the renderer registries read.
export type OrnamentID = keyof typeof ORNAMENT_NAMES

export const ORNAMENT_NAMES = {
  'background.grainient': m.store_ornament_background_grainient,
  'background.grainstorm': m.store_ornament_background_grainstorm,
  'background.iridescence': m.store_ornament_background_iridescence,
  'background.soft-aurora': m.store_ornament_background_soft_aurora,
  'background.liquid-ether': m.store_ornament_background_liquid_ether,
  'background.prismatic-burst': m.store_ornament_background_prismatic_burst,
  'background.plasma-wave': m.store_ornament_background_plasma_wave,
  'background.ferrofluid': m.store_ornament_background_ferrofluid,
  'background.floating-lines': m.store_ornament_background_floating_lines,
  'background.evil-eye': m.store_ornament_background_evil_eye,
  'background.lightfall': m.store_ornament_background_lightfall,
  'background.pixel-blast': m.store_ornament_background_pixel_blast,
  'star_shader.orb': m.store_ornament_star_shader_orb,
  'star_shader.facet': m.store_ornament_star_shader_facet,
  'star_shader.prism': m.store_ornament_star_shader_prism,
  'star_shader.geode': m.store_ornament_star_shader_geode,
  'star_shader.bubble': m.store_ornament_star_shader_bubble,
  'star_shader.spire': m.store_ornament_star_shader_spire,
  'star_shader.urchin': m.store_ornament_star_shader_urchin,
  'star_shader.plasma': m.store_ornament_star_shader_plasma,
  'star_shader.contour': m.store_ornament_star_shader_contour,
  'star_shader.haze': m.store_ornament_star_shader_haze,
} as const satisfies Record<string, () => string>
