/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Hint_BrightnessInputs */

const en_star_meta_hint_brightness = /** @type {(inputs: Star_Meta_Hint_BrightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How vivid the memory still is. It falls a little at a time as universe days pass since the last recall, and a recall brings it back. However long it is left, it never reaches zero.`)
};

const ko_star_meta_hint_brightness = /** @type {(inputs: Star_Meta_Hint_BrightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 얼마나 또렷한지예요. 마지막으로 떠올린 뒤로 시간이 지나면 조금씩 낮아지고, 회고하면 다시 올라와요. 오래 두어도 0이 되지는 않아요.`)
};

/**
* | output |
* | --- |
* | "How vivid the memory still is. It falls a little at a time as universe days pass since the last recall, and a recall brings it back. However long it is left,..." |
*
* @param {Star_Meta_Hint_BrightnessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_hint_brightness = /** @type {((inputs?: Star_Meta_Hint_BrightnessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Hint_BrightnessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_hint_brightness(inputs)
	return ko_star_meta_hint_brightness(inputs)
});