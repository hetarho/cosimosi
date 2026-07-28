/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Save_FailedInputs */

const en_palette_save_failed = /** @type {(inputs: Palette_Save_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That color could not be kept. The previous sky remains.`)
};

const ko_palette_save_failed = /** @type {(inputs: Palette_Save_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 색을 담지 못했어요. 이전 하늘빛으로 돌아갔어요.`)
};

/**
* | output |
* | --- |
* | "That color could not be kept. The previous sky remains." |
*
* @param {Palette_Save_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_save_failed = /** @type {((inputs?: Palette_Save_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Save_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_save_failed(inputs)
	return ko_palette_save_failed(inputs)
});