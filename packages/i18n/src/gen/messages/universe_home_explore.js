/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Home_ExploreInputs */

const en_universe_home_explore = /** @type {(inputs: Universe_Home_ExploreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Explore`)
};

const ko_universe_home_explore = /** @type {(inputs: Universe_Home_ExploreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`둘러보기`)
};

/**
* | output |
* | --- |
* | "Explore" |
*
* @param {Universe_Home_ExploreInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_home_explore = /** @type {((inputs?: Universe_Home_ExploreInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Home_ExploreInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_home_explore(inputs)
	return ko_universe_home_explore(inputs)
});