/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Export_Format_CsvInputs */

const en_me_export_format_csv = /** @type {(inputs: Me_Export_Format_CsvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`CSV`)
};

const ko_me_export_format_csv = /** @type {(inputs: Me_Export_Format_CsvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`CSV`)
};

/**
* | output |
* | --- |
* | "CSV" |
*
* @param {Me_Export_Format_CsvInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_export_format_csv = /** @type {((inputs?: Me_Export_Format_CsvInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Export_Format_CsvInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_export_format_csv(inputs)
	return ko_me_export_format_csv(inputs)
});