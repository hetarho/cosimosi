/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_LabelInputs */

const en_palette_risk_label = /** @type {(inputs: Palette_Risk_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What this color risks`)
};

const ko_palette_risk_label = /** @type {(inputs: Palette_Risk_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 색이 감수하는 것`)
};

/**
* | output |
* | --- |
* | "What this color risks" |
*
* @param {Palette_Risk_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_risk_label = /** @type {((inputs?: Palette_Risk_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Risk_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_risk_label(inputs)
	return ko_palette_risk_label(inputs)
});