/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_History_EmptyInputs */

const en_me_stardust_history_empty = /** @type {(inputs: Me_Stardust_History_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No stardust has come or gone yet.`)
};

const ko_me_stardust_history_empty = /** @type {(inputs: Me_Stardust_History_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 오고 간 별가루가 없어요.`)
};

/**
* | output |
* | --- |
* | "No stardust has come or gone yet." |
*
* @param {Me_Stardust_History_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_history_empty = /** @type {((inputs?: Me_Stardust_History_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_History_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_history_empty(inputs)
	return ko_me_stardust_history_empty(inputs)
});