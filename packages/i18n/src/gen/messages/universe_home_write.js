/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Home_WriteInputs */

const en_universe_home_write = /** @type {(inputs: Universe_Home_WriteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a diary`)
};

const ko_universe_home_write = /** @type {(inputs: Universe_Home_WriteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 쓰기`)
};

/**
* | output |
* | --- |
* | "Write a diary" |
*
* @param {Universe_Home_WriteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_home_write = /** @type {((inputs?: Universe_Home_WriteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Home_WriteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_home_write(inputs)
	return ko_universe_home_write(inputs)
});