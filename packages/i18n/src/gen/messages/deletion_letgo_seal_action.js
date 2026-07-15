/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Seal_ActionInputs */

const en_deletion_letgo_seal_action = /** @type {(inputs: Deletion_Letgo_Seal_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let go`)
};

const ko_deletion_letgo_seal_action = /** @type {(inputs: Deletion_Letgo_Seal_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주기`)
};

/**
* | output |
* | --- |
* | "Let go" |
*
* @param {Deletion_Letgo_Seal_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_seal_action = /** @type {((inputs?: Deletion_Letgo_Seal_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Seal_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_seal_action(inputs)
	return ko_deletion_letgo_seal_action(inputs)
});