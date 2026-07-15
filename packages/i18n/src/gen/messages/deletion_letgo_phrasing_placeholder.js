/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Phrasing_PlaceholderInputs */

const en_deletion_letgo_phrasing_placeholder = /** @type {(inputs: Deletion_Letgo_Phrasing_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write what stayed with you`)
};

const ko_deletion_letgo_phrasing_placeholder = /** @type {(inputs: Deletion_Letgo_Phrasing_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`마음에 남은 말을 적어요`)
};

/**
* | output |
* | --- |
* | "Write what stayed with you" |
*
* @param {Deletion_Letgo_Phrasing_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_phrasing_placeholder = /** @type {((inputs?: Deletion_Letgo_Phrasing_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Phrasing_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_phrasing_placeholder(inputs)
	return ko_deletion_letgo_phrasing_placeholder(inputs)
});