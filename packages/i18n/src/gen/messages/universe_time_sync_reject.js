/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Sync_RejectInputs */

const en_universe_time_sync_reject = /** @type {(inputs: Universe_Time_Sync_RejectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No`)
};

const ko_universe_time_sync_reject = /** @type {(inputs: Universe_Time_Sync_RejectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아니오`)
};

/**
* | output |
* | --- |
* | "No" |
*
* @param {Universe_Time_Sync_RejectInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_sync_reject = /** @type {((inputs?: Universe_Time_Sync_RejectInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Sync_RejectInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_sync_reject(inputs)
	return ko_universe_time_sync_reject(inputs)
});