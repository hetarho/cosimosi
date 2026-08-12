/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_View_FreeInputs */

const en_universe_view_free = /** @type {(inputs: Universe_View_FreeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Free view`)
};

const ko_universe_view_free = /** @type {(inputs: Universe_View_FreeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`자유 모드`)
};

/**
* | output |
* | --- |
* | "Free view" |
*
* @param {Universe_View_FreeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_view_free = /** @type {((inputs?: Universe_View_FreeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_View_FreeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_view_free(inputs)
	return ko_universe_view_free(inputs)
});