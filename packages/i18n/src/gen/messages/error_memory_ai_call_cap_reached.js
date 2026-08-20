/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_Ai_Call_Cap_ReachedInputs */

const en_error_memory_ai_call_cap_reached = /** @type {(inputs: Error_Memory_Ai_Call_Cap_ReachedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You have used up today's allowance. It comes back after a day.`)
};

const ko_error_memory_ai_call_cap_reached = /** @type {(inputs: Error_Memory_Ai_Call_Cap_ReachedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘 쓸 수 있는 몫을 다 썼어요. 하루가 지나면 다시 쓸 수 있어요.`)
};

/**
* | output |
* | --- |
* | "You have used up today's allowance. It comes back after a day." |
*
* @param {Error_Memory_Ai_Call_Cap_ReachedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_ai_call_cap_reached = /** @type {((inputs?: Error_Memory_Ai_Call_Cap_ReachedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_Ai_Call_Cap_ReachedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_ai_call_cap_reached(inputs)
	return ko_error_memory_ai_call_cap_reached(inputs)
});