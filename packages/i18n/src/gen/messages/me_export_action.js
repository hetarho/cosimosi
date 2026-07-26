/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Export_ActionInputs */

const en_me_export_action = /** @type {(inputs: Me_Export_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Export diaries`)
};

const ko_me_export_action = /** @type {(inputs: Me_Export_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 내보내기`)
};

/**
* | output |
* | --- |
* | "Export diaries" |
*
* @param {Me_Export_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_export_action = /** @type {((inputs?: Me_Export_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Export_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_export_action(inputs)
	return ko_me_export_action(inputs)
});