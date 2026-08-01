/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ current: NonNullable<unknown>, total: NonNullable<unknown> }} Landing_Walk_ProgressInputs */

const en_landing_walk_progress = /** @type {(inputs: Landing_Walk_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Step ${i?.current} of ${i?.total}`)
};

const ko_landing_walk_progress = /** @type {(inputs: Landing_Walk_ProgressInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.current} / ${i?.total} 단계`)
};

/**
* | output |
* | --- |
* | "Step {current} of {total}" |
*
* @param {Landing_Walk_ProgressInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_progress = /** @type {((inputs: Landing_Walk_ProgressInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_ProgressInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_progress(inputs)
	return ko_landing_walk_progress(inputs)
});