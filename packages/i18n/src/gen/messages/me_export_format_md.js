/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Export_Format_MdInputs */

const en_me_export_format_md = /** @type {(inputs: Me_Export_Format_MdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Markdown`)
};

const ko_me_export_format_md = /** @type {(inputs: Me_Export_Format_MdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Markdown`)
};

/**
* | output |
* | --- |
* | "Markdown" |
*
* @param {Me_Export_Format_MdInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_export_format_md = /** @type {((inputs?: Me_Export_Format_MdInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Export_Format_MdInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_export_format_md(inputs)
	return ko_me_export_format_md(inputs)
});