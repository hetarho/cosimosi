/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Risk_DimInputs */

const en_palette_risk_dim = /** @type {(inputs: Palette_Risk_DimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It nearly sinks into the night sky; the star may be hard to find.`)
};

const ko_palette_risk_dim = /** @type {(inputs: Palette_Risk_DimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밤하늘에 거의 잠기는 색이에요. 별이 잘 보이지 않을 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It nearly sinks into the night sky; the star may be hard to find." |
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