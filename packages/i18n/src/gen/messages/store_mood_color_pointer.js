/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Mood_Color_PointerInputs */

const en_store_mood_color_pointer = /** @type {(inputs: Store_Mood_Color_PointerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your colours for each feeling live on your page.`)
};

const ko_store_mood_color_pointer = /** @type {(inputs: Store_Mood_Color_PointerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 색은 나 페이지에서 고를 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Your colours for each feeling live on your page." |
*
* @param {Store_Mood_Color_PointerInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_mood_color_pointer = /** @type {((inputs?: Store_Mood_Color_PointerInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Mood_Color_PointerInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_mood_color_pointer(inputs)
	return ko_store_mood_color_pointer(inputs)
});