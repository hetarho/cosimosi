/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ mood: NonNullable<unknown> }} Palette_Near_DuplicateInputs */

const en_palette_near_duplicate = /** @type {(inputs: Palette_Near_DuplicateInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`This is very close to the color already given to ${i?.mood}. You can still keep it.`)
};

const ko_palette_near_duplicate = /** @type {(inputs: Palette_Near_DuplicateInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood}에 준 색과 아주 가까워요. 그래도 이 색을 간직할 수 있어요.`)
};

/**
* | output |
* | --- |
* | "This is very close to the color already given to {mood}. You can still keep it." |
*
* @param {Palette_Near_DuplicateInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_near_duplicate = /** @type {((inputs: Palette_Near_DuplicateInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Near_DuplicateInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_near_duplicate(inputs)
	return ko_palette_near_duplicate(inputs)
});