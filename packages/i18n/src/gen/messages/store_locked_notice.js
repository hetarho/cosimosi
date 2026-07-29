/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Store_Locked_NoticeInputs */

const en_store_locked_notice = /** @type {(inputs: Store_Locked_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name} hasn't opened yet.`)
};

const ko_store_locked_notice = /** @type {(inputs: Store_Locked_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name}은 아직 열리지 않았어요.`)
};

/**
* | output |
* | --- |
* | "{name} hasn't opened yet." |
*
* @param {Store_Locked_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_locked_notice = /** @type {((inputs: Store_Locked_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Locked_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_locked_notice(inputs)
	return ko_store_locked_notice(inputs)
});