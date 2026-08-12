/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ mood: NonNullable<unknown> }} Palette_Risk_SimilarInputs */

const en_palette_risk_similar = /** @type {(inputs: Palette_Risk_SimilarInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`It's so close to the color you gave ${i?.mood} that the two feelings may be hard to tell apart.`)
};

const ko_palette_risk_similar = /** @type {(inputs: Palette_Risk_SimilarInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood}에 준 색과 너무 비슷해서 우주에서 두 감정이 헷갈릴 수 있어요.`)
};

/**
* | output |
* | --- |
* | "It's so close to the color you gave {mood} that the two feelings may be hard to tell apart." |
*
* @param {Palette_Risk_SimilarInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_risk_similar = /** @type {((inputs: Palette_Risk_SimilarInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Risk_SimilarInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_risk_similar(inputs)
	return ko_palette_risk_similar(inputs)
});