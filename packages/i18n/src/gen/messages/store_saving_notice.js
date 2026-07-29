/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Saving_NoticeInputs */

const en_store_saving_notice = /** @type {(inputs: Store_Saving_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Saving…`)
};

const ko_store_saving_notice = /** @type {(inputs: Store_Saving_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`저장하는 중…`)
};

/**
* | output |
* | --- |
* | "Saving…" |
*
* @param {Store_Saving_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_saving_notice = /** @type {((inputs?: Store_Saving_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Saving_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_saving_notice(inputs)
	return ko_store_saving_notice(inputs)
});