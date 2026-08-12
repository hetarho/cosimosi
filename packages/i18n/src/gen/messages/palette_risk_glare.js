/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_GlareInputs */

const en_palette_risk_glare = /** @type {(inputs: Palette_Risk_GlareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It's so bright that it may wash out the starlight beside it.`)
};

const ko_palette_risk_glare = /** @type {(inputs: Palette_Risk_GlareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`너무 밝아서 우주에서 옆에 있는 별빛까지 묻힐 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It's so bright that it may wash out the starlight beside it." |
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