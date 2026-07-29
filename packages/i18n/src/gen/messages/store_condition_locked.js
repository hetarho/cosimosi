/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Condition_LockedInputs */

const en_store_condition_locked = /** @type {(inputs: Store_Condition_LockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Opens with an achievement`)
};

const ko_store_condition_locked = /** @type {(inputs: Store_Condition_LockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`업적으로 열립니다`)
};

/**
* | output |
* | --- |
* | "Opens with an achievement" |
*
* @param {Store_Condition_LockedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_condition_locked = /** @type {((inputs?: Store_Condition_LockedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Condition_LockedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_condition_locked(inputs)
	return ko_store_condition_locked(inputs)
});