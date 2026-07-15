/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Approve_LeadInputs */

const en_deletion_letgo_approve_lead = /** @type {(inputs: Deletion_Letgo_Approve_LeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose the meaning to let go of. Only what you choose is blurred.`)
};

const ko_deletion_letgo_approve_lead = /** @type {(inputs: Deletion_Letgo_Approve_LeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아줄 의미를 골라 주세요. 고른 것만 흐려져요.`)
};

/**
* | output |
* | --- |
* | "Choose the meaning to let go of. Only what you choose is blurred." |
*
* @param {Deletion_Letgo_Approve_LeadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_approve_lead = /** @type {((inputs?: Deletion_Letgo_Approve_LeadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Approve_LeadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_approve_lead(inputs)
	return ko_deletion_letgo_approve_lead(inputs)
});