/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Suggest_ActionInputs */

const en_deletion_letgo_suggest_action = /** @type {(inputs: Deletion_Letgo_Suggest_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Find the connected meaning`)
};

const ko_deletion_letgo_suggest_action = /** @type {(inputs: Deletion_Letgo_Suggest_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이어진 의미 찾기`)
};

/**
* | output |
* | --- |
* | "Find the connected meaning" |
*
* @param {Deletion_Letgo_Suggest_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_suggest_action = /** @type {((inputs?: Deletion_Letgo_Suggest_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Suggest_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_suggest_action(inputs)
	return ko_deletion_letgo_suggest_action(inputs)
});