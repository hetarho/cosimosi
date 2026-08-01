/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Color_ActionInputs */

const en_landing_walk_color_action = /** @type {(inputs: Landing_Walk_Color_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a few more days`)
};

const ko_landing_walk_color_action = /** @type {(inputs: Landing_Walk_Color_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`며칠 더 써 보기`)
};

/**
* | output |
* | --- |
* | "Write a few more days" |
*
* @param {Landing_Walk_Color_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_color_action = /** @type {((inputs?: Landing_Walk_Color_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Color_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_color_action(inputs)
	return ko_landing_walk_color_action(inputs)
});