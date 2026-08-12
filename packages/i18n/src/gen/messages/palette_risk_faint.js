/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_FaintInputs */

const en_palette_risk_faint = /** @type {(inputs: Palette_Risk_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Its chroma is so low that it may not stand apart from the other feelings.`)
};

const ko_palette_risk_faint = /** @type {(inputs: Palette_Risk_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`채도가 너무 낮아서 우주에서 다른 감정과 구분이 안 될 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Its chroma is so low that it may not stand apart from the other feelings." |
*
* @param {Palette_Risk_FaintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_risk_faint = /** @type {((inputs?: Palette_Risk_FaintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Risk_FaintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_risk_faint(inputs)
	return ko_palette_risk_faint(inputs)
});