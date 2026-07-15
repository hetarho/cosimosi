/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_PermanenceInputs */

const en_deletion_letgo_permanence = /** @type {(inputs: Deletion_Letgo_PermanenceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Once you let it go, it cannot be undone.`)
};

const ko_deletion_letgo_permanence = /** @type {(inputs: Deletion_Letgo_PermanenceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 번 놓아주면 되돌릴 수 없어요.`)
};

/**
* | output |
* | --- |
* | "Once you let it go, it cannot be undone." |
*
* @param {Deletion_Letgo_PermanenceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_permanence = /** @type {((inputs?: Deletion_Letgo_PermanenceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_PermanenceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_permanence(inputs)
	return ko_deletion_letgo_permanence(inputs)
});