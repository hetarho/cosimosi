/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ linkedAt: NonNullable<unknown> }} Me_Provider_Linked_AtInputs */

const en_me_provider_linked_at = /** @type {(inputs: Me_Provider_Linked_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Linked ${i?.linkedAt}`)
};

const ko_me_provider_linked_at = /** @type {(inputs: Me_Provider_Linked_AtInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.linkedAt}에 연결`)
};

/**
* | output |
* | --- |
* | "Linked {linkedAt}" |
*
* @param {Me_Provider_Linked_AtInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_provider_linked_at = /** @type {((inputs: Me_Provider_Linked_AtInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Provider_Linked_AtInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_provider_linked_at(inputs)
	return ko_me_provider_linked_at(inputs)
});