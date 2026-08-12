/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_FaintInputs */

const en_palette_risk_faint = /** @type {(inputs: Palette_Risk_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It is too washed out to read as a hue, and may not stand apart from other feelings.`)
};

const ko_palette_risk_faint = /** @type {(inputs: Palette_Risk_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`색이라기엔 너무 흐려요. 다른 감정과 구분되지 않을 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It is too washed out to read as a hue, and may not stand apart from other feelings." |
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