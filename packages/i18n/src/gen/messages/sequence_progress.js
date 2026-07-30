/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ current: NonNullable<unknown>, total: NonNullable<unknown> }} Sequence_ProgressInputs */

const en_sequence_progress = /** @type {(inputs: Sequence_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.current} of ${i?.total}`)
};

const ko_sequence_progress = /** @type {(inputs: Sequence_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.total} 중 ${i?.current}`)
};

/**
* | output |
* | --- |
* | "{current} of {total}" |
*
* @param {Sequence_ProgressInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_progress = /** @type {((inputs: Sequence_ProgressInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_ProgressInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_progress(inputs)
	return ko_sequence_progress(inputs)
});