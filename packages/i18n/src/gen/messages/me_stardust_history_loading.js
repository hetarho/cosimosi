/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_History_LoadingInputs */

const en_me_stardust_history_loading = /** @type {(inputs: Me_Stardust_History_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading the history…`)
};

const ko_me_stardust_history_loading = /** @type {(inputs: Me_Stardust_History_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`내역을 불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Loading the history…" |
*
* @param {Me_Stardust_History_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_history_loading = /** @type {((inputs?: Me_Stardust_History_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_History_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_history_loading(inputs)
	return ko_me_stardust_history_loading(inputs)
});