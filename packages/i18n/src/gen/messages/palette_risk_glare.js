/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_GlareInputs */

const en_palette_risk_glare = /** @type {(inputs: Palette_Risk_GlareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It burns brighter than the sky around it, and can wash out the stars beside it.`)
};

const ko_palette_risk_glare = /** @type {(inputs: Palette_Risk_GlareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주에서 너무 밝게 타올라요. 곁에 있는 별빛을 씻어 낼 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It burns brighter than the sky around it, and can wash out the stars beside it." |
*
* @param {Palette_Risk_GlareInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_risk_glare = /** @type {((inputs?: Palette_Risk_GlareInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Risk_GlareInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_risk_glare(inputs)
	return ko_palette_risk_glare(inputs)
});