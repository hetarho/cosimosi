/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Export_ReassuranceInputs */

const en_deletion_letgo_export_reassurance = /** @type {(inputs: Deletion_Letgo_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The original diary text is not deleted. You can export it as CSV or MD anytime.`)
};

const ko_deletion_letgo_export_reassurance = /** @type {(inputs: Deletion_Letgo_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 원문은 지우지 않아요. 언제든 CSV·MD로 내보낼 수 있어요.`)
};

/**
* | output |
* | --- |
* | "The original diary text is not deleted. You can export it as CSV or MD anytime." |
*
* @param {Deletion_Letgo_Export_ReassuranceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_export_reassurance = /** @type {((inputs?: Deletion_Letgo_Export_ReassuranceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Export_ReassuranceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_export_reassurance(inputs)
	return ko_deletion_letgo_export_reassurance(inputs)
});