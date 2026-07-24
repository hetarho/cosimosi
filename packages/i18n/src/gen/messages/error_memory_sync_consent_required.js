/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Sync_Consent_RequiredInputs */

const en_error_memory_sync_consent_required = /** @type {(inputs: Error_Memory_Sync_Consent_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Review and accept memory sync before continuing.`)
};

const ko_error_memory_sync_consent_required = /** @type {(inputs: Error_Memory_Sync_Consent_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계속하기 전에 기억 동기화 내용을 확인하고 동의해 주세요.`)
};

/**
* | output |
* | --- |
* | "Review and accept memory sync before continuing." |
*
* @param {Error_Memory_Sync_Consent_RequiredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_sync_consent_required = /** @type {((inputs?: Error_Memory_Sync_Consent_RequiredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Sync_Consent_RequiredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_sync_consent_required(inputs)
	return ko_error_memory_sync_consent_required(inputs)
});