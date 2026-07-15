/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Permanent_After_WindowInputs */

const en_deletion_delete_permanent_after_window = /** @type {(inputs: Deletion_Delete_Permanent_After_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`After that, the original diary text is deleted for good.`)
};

const ko_deletion_delete_permanent_after_window = /** @type {(inputs: Deletion_Delete_Permanent_After_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 기간이 지나면 일기 원문도 완전히 지워져요.`)
};

/**
* | output |
* | --- |
* | "After that, the original diary text is deleted for good." |
*
* @param {Deletion_Delete_Permanent_After_WindowInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_permanent_after_window = /** @type {((inputs?: Deletion_Delete_Permanent_After_WindowInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Permanent_After_WindowInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_permanent_after_window(inputs)
	return ko_deletion_delete_permanent_after_window(inputs)
});