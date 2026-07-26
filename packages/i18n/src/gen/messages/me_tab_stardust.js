/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_StardustInputs */

const en_me_tab_stardust = /** @type {(inputs: Me_Tab_StardustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust`)
};

const ko_me_tab_stardust = /** @type {(inputs: Me_Tab_StardustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루`)
};

/**
* | output |
* | --- |
* | "Stardust" |
*
* @param {Me_Tab_StardustInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_stardust = /** @type {((inputs?: Me_Tab_StardustInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_StardustInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_stardust(inputs)
	return ko_me_tab_stardust(inputs)
});