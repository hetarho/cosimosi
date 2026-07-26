/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_PendingInputs */

const en_me_stardust_pending = /** @type {(inputs: Me_Stardust_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This record is not available yet.`)
};

const ko_me_stardust_pending = /** @type {(inputs: Me_Stardust_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 펼쳐지지 않은 기록이에요.`)
};

/**
* | output |
* | --- |
* | "This record is not available yet." |
*
* @param {Me_Stardust_PendingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_pending = /** @type {((inputs?: Me_Stardust_PendingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_PendingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_pending(inputs)
	return ko_me_stardust_pending(inputs)
});