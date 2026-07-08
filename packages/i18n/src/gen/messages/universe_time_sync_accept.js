/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Sync_AcceptInputs */

const en_universe_time_sync_accept = /** @type {(inputs: Universe_Time_Sync_AcceptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Yes`)
};

const ko_universe_time_sync_accept = /** @type {(inputs: Universe_Time_Sync_AcceptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`예`)
};

/**
* | output |
* | --- |
* | "Yes" |
*
* @param {Universe_Time_Sync_AcceptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_sync_accept = /** @type {((inputs?: Universe_Time_Sync_AcceptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Sync_AcceptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_sync_accept(inputs)
	return ko_universe_time_sync_accept(inputs)
});