/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Resource_ContactInputs */

const en_deletion_letgo_resource_contact = /** @type {(inputs: Deletion_Letgo_Resource_ContactInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Mental health line 1577-0199 · Suicide prevention line 109`)
};

const ko_deletion_letgo_resource_contact = /** @type {(inputs: Deletion_Letgo_Resource_ContactInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`정신건강 상담 1577-0199 · 자살예방 상담 109`)
};

/**
* | output |
* | --- |
* | "Mental health line 1577-0199 · Suicide prevention line 109" |
*
* @param {Deletion_Letgo_Resource_ContactInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_resource_contact = /** @type {((inputs?: Deletion_Letgo_Resource_ContactInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Resource_ContactInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_resource_contact(inputs)
	return ko_deletion_letgo_resource_contact(inputs)
});