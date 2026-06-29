/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Query_EntriesInputs */

const en_mobile_diagnostics_query_entries = /** @type {(inputs: Mobile_Diagnostics_Query_EntriesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Query cache entries`)
};

const ko_mobile_diagnostics_query_entries = /** @type {(inputs: Mobile_Diagnostics_Query_EntriesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쿼리 캐시 항목`)
};

/**
* | output |
* | --- |
* | "Query cache entries" |
*
* @param {Mobile_Diagnostics_Query_EntriesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_query_entries = /** @type {((inputs?: Mobile_Diagnostics_Query_EntriesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Query_EntriesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_query_entries(inputs)
	return ko_mobile_diagnostics_query_entries(inputs)
});