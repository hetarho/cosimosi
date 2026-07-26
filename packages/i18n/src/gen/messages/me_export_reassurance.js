/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Export_ReassuranceInputs */

const en_me_export_reassurance = /** @type {(inputs: Me_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your diaries stay yours. You can carry them out as CSV or Markdown.`)
};

const ko_me_export_reassurance = /** @type {(inputs: Me_Export_ReassuranceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기는 그대로 남아요. CSV나 Markdown으로 언제든 가져갈 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Your diaries stay yours. You can carry them out as CSV or Markdown." |
*
* @param {Me_Export_ReassuranceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_export_reassurance = /** @type {((inputs?: Me_Export_ReassuranceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Export_ReassuranceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_export_reassurance(inputs)
	return ko_me_export_reassurance(inputs)
});