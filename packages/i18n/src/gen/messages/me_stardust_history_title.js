/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_History_TitleInputs */

const en_me_stardust_history_title = /** @type {(inputs: Me_Stardust_History_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust that came and went`)
};

const ko_me_stardust_history_title = /** @type {(inputs: Me_Stardust_History_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오고 간 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust that came and went" |
*
* @param {Me_Stardust_History_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_history_title = /** @type {((inputs?: Me_Stardust_History_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_History_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_history_title(inputs)
	return ko_me_stardust_history_title(inputs)
});