/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_History_ErrorInputs */

const en_me_stardust_history_error = /** @type {(inputs: Me_Stardust_History_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The history could not be loaded.`)
};

const ko_me_stardust_history_error = /** @type {(inputs: Me_Stardust_History_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`내역을 불러오지 못했어요.`)
};

/**
* | output |
* | --- |
* | "The history could not be loaded." |
*
* @param {Me_Stardust_History_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_history_error = /** @type {((inputs?: Me_Stardust_History_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_History_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_history_error(inputs)
	return ko_me_stardust_history_error(inputs)
});