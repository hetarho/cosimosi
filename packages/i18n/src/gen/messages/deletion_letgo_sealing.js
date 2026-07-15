/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_SealingInputs */

const en_deletion_letgo_sealing = /** @type {(inputs: Deletion_Letgo_SealingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Letting go…`)
};

const ko_deletion_letgo_sealing = /** @type {(inputs: Deletion_Letgo_SealingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주는 중…`)
};

/**
* | output |
* | --- |
* | "Letting go…" |
*
* @param {Deletion_Letgo_SealingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_sealing = /** @type {((inputs?: Deletion_Letgo_SealingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_SealingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_sealing(inputs)
	return ko_deletion_letgo_sealing(inputs)
});