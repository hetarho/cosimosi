/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_DimInputs */

const en_palette_risk_dim = /** @type {(inputs: Palette_Risk_DimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It's so dark that it may sink into the night sky.`)
};

const ko_palette_risk_dim = /** @type {(inputs: Palette_Risk_DimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`너무 어두워서 우주에서 밤하늘에 묻혀 보일 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It's so dark that it may sink into the night sky." |
*
* @param {Palette_Risk_DimInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_risk_dim = /** @type {((inputs?: Palette_Risk_DimInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Risk_DimInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_risk_dim(inputs)
	return ko_palette_risk_dim(inputs)
});