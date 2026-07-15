/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Resource_TitleInputs */

const en_deletion_letgo_resource_title = /** @type {(inputs: Deletion_Letgo_Resource_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`If it feels too heavy to carry alone`)
};

const ko_deletion_letgo_resource_title = /** @type {(inputs: Deletion_Letgo_Resource_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`혼자 견디기 버겁다면`)
};

/**
* | output |
* | --- |
* | "If it feels too heavy to carry alone" |
*
* @param {Deletion_Letgo_Resource_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_resource_title = /** @type {((inputs?: Deletion_Letgo_Resource_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Resource_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_resource_title(inputs)
	return ko_deletion_letgo_resource_title(inputs)
});