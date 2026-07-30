/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_TitleInputs */

const en_landing_theory_title = /** @type {(inputs: Landing_Theory_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Where the idea comes from`)
};

const ko_landing_theory_title = /** @type {(inputs: Landing_Theory_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 생각은 어디에서 왔나`)
};

/**
* | output |
* | --- |
* | "Where the idea comes from" |
*
* @param {Landing_Theory_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_title = /** @type {((inputs?: Landing_Theory_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_title(inputs)
	return ko_landing_theory_title(inputs)
});