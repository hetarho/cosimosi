/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Sync_Consent_TitleInputs */

const en_universe_time_sync_consent_title = /** @type {(inputs: Universe_Time_Sync_Consent_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Universe time`)
};

const ko_universe_time_sync_consent_title = /** @type {(inputs: Universe_Time_Sync_Consent_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 시간`)
};

/**
* | output |
* | --- |
* | "Universe time" |
*
* @param {Universe_Time_Sync_Consent_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_sync_consent_title = /** @type {((inputs?: Universe_Time_Sync_Consent_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Sync_Consent_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_sync_consent_title(inputs)
	return ko_universe_time_sync_consent_title(inputs)
});