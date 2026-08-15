/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_PinprickInputs */

const en_store_ornament_mote_pinprick = /** @type {(inputs: Store_Ornament_Mote_PinprickInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pinprick`)
};

const ko_store_ornament_mote_pinprick = /** @type {(inputs: Store_Ornament_Mote_PinprickInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`바늘 끝`)
};

/**
* | output |
* | --- |
* | "Pinprick" |
*
* @param {Store_Ornament_Mote_PinprickInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_pinprick = /** @type {((inputs?: Store_Ornament_Mote_PinprickInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_PinprickInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_pinprick(inputs)
	return ko_store_ornament_mote_pinprick(inputs)
});