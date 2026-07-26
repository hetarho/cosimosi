/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_TitleInputs */

const en_me_title = /** @type {(inputs: Me_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You`)
};

const ko_me_title = /** @type {(inputs: Me_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`나`)
};

/**
* | output |
* | --- |
* | "You" |
*
* @param {Me_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_title = /** @type {((inputs?: Me_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_title(inputs)
	return ko_me_title(inputs)
});