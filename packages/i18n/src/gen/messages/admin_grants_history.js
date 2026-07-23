/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Grants_HistoryInputs */

const en_admin_grants_history = /** @type {(inputs: Admin_Grants_HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grant history`)
};

const ko_admin_grants_history = /** @type {(inputs: Admin_Grants_HistoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`증정 내역`)
};

/**
* | output |
* | --- |
* | "Grant history" |
*
* @param {Admin_Grants_HistoryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_grants_history = /** @type {((inputs?: Admin_Grants_HistoryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Grants_HistoryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_grants_history(inputs)
	return ko_admin_grants_history(inputs)
});