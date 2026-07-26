/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_ProfileInputs */

const en_me_tab_profile = /** @type {(inputs: Me_Tab_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Profile`)
};

const ko_me_tab_profile = /** @type {(inputs: Me_Tab_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프로필`)
};

/**
* | output |
* | --- |
* | "Profile" |
*
* @param {Me_Tab_ProfileInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_profile = /** @type {((inputs?: Me_Tab_ProfileInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_ProfileInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_profile(inputs)
	return ko_me_tab_profile(inputs)
});