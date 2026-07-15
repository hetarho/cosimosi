/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_RestoringInputs */

const en_deletion_restoring = /** @type {(inputs: Deletion_RestoringInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Restoring…`)
};

const ko_deletion_restoring = /** @type {(inputs: Deletion_RestoringInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`되돌리는 중…`)
};

/**
* | output |
* | --- |
* | "Restoring…" |
*
* @param {Deletion_RestoringInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restoring = /** @type {((inputs?: Deletion_RestoringInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_RestoringInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restoring(inputs)
	return ko_deletion_restoring(inputs)
});