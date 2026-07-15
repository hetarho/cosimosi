/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_SuggestingInputs */

const en_deletion_letgo_suggesting = /** @type {(inputs: Deletion_Letgo_SuggestingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Looking for the connected meaning…`)
};

const ko_deletion_letgo_suggesting = /** @type {(inputs: Deletion_Letgo_SuggestingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이어진 의미를 찾는 중…`)
};

/**
* | output |
* | --- |
* | "Looking for the connected meaning…" |
*
* @param {Deletion_Letgo_SuggestingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_suggesting = /** @type {((inputs?: Deletion_Letgo_SuggestingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_SuggestingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_suggesting(inputs)
	return ko_deletion_letgo_suggesting(inputs)
});