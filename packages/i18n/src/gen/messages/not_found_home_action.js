/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Not_Found_Home_ActionInputs */

const en_not_found_home_action = /** @type {(inputs: Not_Found_Home_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to your universe`)
};

const ko_not_found_home_action = /** @type {(inputs: Not_Found_Home_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to your universe" |
*
* @param {Not_Found_Home_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const not_found_home_action = /** @type {((inputs?: Not_Found_Home_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Not_Found_Home_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_not_found_home_action(inputs)
	return ko_not_found_home_action(inputs)
});