/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_BackInputs */

const en_admin_back = /** @type {(inputs: Admin_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to universe`)
};

const ko_admin_back = /** @type {(inputs: Admin_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to universe" |
*
* @param {Admin_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_back = /** @type {((inputs?: Admin_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_back(inputs)
	return ko_admin_back(inputs)
});