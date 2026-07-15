/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Export_ReassuranceInputs */

const en_deletion_delete_export_reassurance = /** @type {(inputs: Deletion_Delete_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Before deleting, or while it can still be undone, you can export it as CSV or MD.`)
};

const ko_deletion_delete_export_reassurance = /** @type {(inputs: Deletion_Delete_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지우기 전이나 되돌릴 수 있는 동안에는 CSV·MD로 내보낼 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Before deleting, or while it can still be undone, you can export it as CSV or MD." |
*
* @param {Deletion_Delete_Export_ReassuranceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_export_reassurance = /** @type {((inputs?: Deletion_Delete_Export_ReassuranceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Export_ReassuranceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_export_reassurance(inputs)
	return ko_deletion_delete_export_reassurance(inputs)
});