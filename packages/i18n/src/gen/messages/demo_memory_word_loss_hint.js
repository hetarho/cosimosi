/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Memory_Word_Loss_HintInputs */

const en_demo_memory_word_loss_hint = /** @type {(inputs: Demo_Memory_Word_Loss_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The blurred parts are words lost with time. The words you still remember stay clear.`)
};

const ko_demo_memory_word_loss_hint = /** @type {(inputs: Demo_Memory_Word_Loss_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`흐릿한 부분은 시간이 지나며 잃어버린 단어예요. 아직 기억하는 단어는 또렷하게 남아 있어요.`)
};

/**
* | output |
* | --- |
* | "The blurred parts are words lost with time. The words you still remember stay clear." |
*
* @param {Demo_Memory_Word_Loss_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_memory_word_loss_hint = /** @type {((inputs?: Demo_Memory_Word_Loss_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Memory_Word_Loss_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_memory_word_loss_hint(inputs)
	return ko_demo_memory_word_loss_hint(inputs)
});