/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Memory_Restore_DescriptionInputs */

const en_memory_restore_description = /** @type {(inputs: Memory_Restore_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Use stardust to restore this memory’s stored words before they faded. This does not rewrite the memory.`)
};

const ko_memory_restore_description = /** @type {(inputs: Memory_Restore_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루를 사용해 흐려지기 전의 저장된 기억을 그대로 되살려요. 내용을 다시 쓰지는 않아요.`)
};

/**
* | output |
* | --- |
* | "Use stardust to restore this memory’s stored words before they faded. This does not rewrite the memory." |
*
* @param {Memory_Restore_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const memory_restore_description = /** @type {((inputs?: Memory_Restore_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Memory_Restore_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_memory_restore_description(inputs)
	return ko_memory_restore_description(inputs)
});