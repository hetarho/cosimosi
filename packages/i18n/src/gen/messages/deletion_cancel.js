/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_CancelInputs */

const en_deletion_cancel = /** @type {(inputs: Deletion_CancelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Never mind`)
};

const ko_deletion_cancel = /** @type {(inputs: Deletion_CancelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그만두기`)
};

/**
* | output |
* | --- |
* | "Never mind" |
*
* @param {Deletion_CancelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_cancel = /** @type {((inputs?: Deletion_CancelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_CancelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_cancel(inputs)
	return ko_deletion_cancel(inputs)
});