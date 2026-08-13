/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Hint_Forgetting_StateInputs */

const en_star_meta_hint_forgetting_state = /** @type {(inputs: Star_Meta_Hint_Forgetting_StateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How far this memory’s text has blurred. It starts vivid, loses words one at a time, and reads whole again after a recall.`)
};

const ko_star_meta_hint_forgetting_state = /** @type {(inputs: Star_Meta_Hint_Forgetting_StateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 이 기억의 글이 얼마나 흐려졌는지예요. 또렷함에서 시작해 단어가 하나씩 사라지고, 회고하면 다시 또렷해져요.`)
};

/**
* | output |
* | --- |
* | "How far this memory’s text has blurred. It starts vivid, loses words one at a time, and reads whole again after a recall." |
*
* @param {Star_Meta_Hint_Forgetting_StateInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_hint_forgetting_state = /** @type {((inputs?: Star_Meta_Hint_Forgetting_StateInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Hint_Forgetting_StateInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_hint_forgetting_state(inputs)
	return ko_star_meta_hint_forgetting_state(inputs)
});