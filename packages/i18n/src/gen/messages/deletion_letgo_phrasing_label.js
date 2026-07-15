/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Phrasing_LabelInputs */

const en_deletion_letgo_phrasing_label = /** @type {(inputs: Deletion_Letgo_Phrasing_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Words to let go of`)
};

const ko_deletion_letgo_phrasing_label = /** @type {(inputs: Deletion_Letgo_Phrasing_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`놓아주고 싶은 말`)
};

/**
* | output |
* | --- |
* | "Words to let go of" |
*
* @param {Deletion_Letgo_Phrasing_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_phrasing_label = /** @type {((inputs?: Deletion_Letgo_Phrasing_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Phrasing_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_phrasing_label(inputs)
	return ko_deletion_letgo_phrasing_label(inputs)
});