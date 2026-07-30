/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Forgetting_BodyInputs */

const en_landing_theory_forgetting_body = /** @type {(inputs: Landing_Theory_Forgetting_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Much of forgetting looks less like erasure than like losing the route to something still there. So nothing here is deleted when it fades — your original entry is kept, always.`)
};

const ko_landing_theory_forgetting_body = /** @type {(inputs: Landing_Theory_Forgetting_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`잊음의 많은 부분은 지워짐보다, 아직 있는 것으로 가는 길을 잃는 일처럼 보입니다. 그래서 여기서는 희미해져도 지워지지 않습니다. 당신이 쓴 원본은 언제나 그대로 남습니다.`)
};

/**
* | output |
* | --- |
* | "Much of forgetting looks less like erasure than like losing the route to something still there. So nothing here is deleted when it fades — your original entr..." |
*
* @param {Landing_Theory_Forgetting_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_forgetting_body = /** @type {((inputs?: Landing_Theory_Forgetting_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Forgetting_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_forgetting_body(inputs)
	return ko_landing_theory_forgetting_body(inputs)
});