/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Approve_EmptyInputs */

const en_deletion_letgo_approve_empty = /** @type {(inputs: Deletion_Letgo_Approve_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`There is no meaning used only by this memory.`)
};

const ko_deletion_letgo_approve_empty = /** @type {(inputs: Deletion_Letgo_Approve_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 기억에서만 쓰는 의미가 없어요.`)
};

/**
* | output |
* | --- |
* | "There is no meaning used only by this memory." |
*
* @param {Deletion_Letgo_Approve_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_approve_empty = /** @type {((inputs?: Deletion_Letgo_Approve_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Approve_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_approve_empty(inputs)
	return ko_deletion_letgo_approve_empty(inputs)
});