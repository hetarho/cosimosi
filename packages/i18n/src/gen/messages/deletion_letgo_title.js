/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_TitleInputs */

const en_deletion_letgo_title = /** @type {(inputs: Deletion_Letgo_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Letting go`)
};

const ko_deletion_letgo_title = /** @type {(inputs: Deletion_Letgo_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주기`)
};

/**
* | output |
* | --- |
* | "Letting go" |
*
* @param {Deletion_Letgo_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_title = /** @type {((inputs?: Deletion_Letgo_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_title(inputs)
	return ko_deletion_letgo_title(inputs)
});