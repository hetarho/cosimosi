/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ days: NonNullable<unknown> }} Landing_Play_DaysInputs */

const en_landing_play_days = /** @type {(inputs: Landing_Play_DaysInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`day ${i?.days}`)
};

const ko_landing_play_days = /** @type {(inputs: Landing_Play_DaysInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.days}일`)
};

/**
* | output |
* | --- |
* | "day {days}" |
*
* @param {Landing_Play_DaysInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_days = /** @type {((inputs: Landing_Play_DaysInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_DaysInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_days(inputs)
	return ko_landing_play_days(inputs)
});