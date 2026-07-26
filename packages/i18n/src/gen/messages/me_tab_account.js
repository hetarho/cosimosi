/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_AccountInputs */

const en_me_tab_account = /** @type {(inputs: Me_Tab_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Account`)
};

const ko_me_tab_account = /** @type {(inputs: Me_Tab_AccountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정`)
};

/**
* | output |
* | --- |
* | "Account" |
*
* @param {Me_Tab_AccountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_account = /** @type {((inputs?: Me_Tab_AccountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_AccountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_account(inputs)
	return ko_me_tab_account(inputs)
});