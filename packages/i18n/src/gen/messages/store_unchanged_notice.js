/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Unchanged_NoticeInputs */

const en_store_unchanged_notice = /** @type {(inputs: Store_Unchanged_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing has changed.`)
};

const ko_store_unchanged_notice = /** @type {(inputs: Store_Unchanged_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`바뀐 게 없어요.`)
};

/**
* | output |
* | --- |
* | "Nothing has changed." |
*
* @param {Store_Unchanged_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_unchanged_notice = /** @type {((inputs?: Store_Unchanged_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Unchanged_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_unchanged_notice(inputs)
	return ko_store_unchanged_notice(inputs)
});