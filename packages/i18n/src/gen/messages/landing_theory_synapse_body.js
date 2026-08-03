/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Synapse_BodyInputs */

const en_landing_theory_synapse_body = /** @type {(inputs: Landing_Theory_Synapse_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Links between cells strengthen when used together and weaken when they are not. In here, that is why two entries that keep appearing together are drawn closer.`)
};

const ko_landing_theory_synapse_body = /** @type {(inputs: Landing_Theory_Synapse_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`세포 사이의 연결은 함께 쓰이면 강해지고 그렇지 않으면 약해져요. 자주 함께 나타난 두 기록은 그래서 점점 가까워져요.`)
};

/**
* | output |
* | --- |
* | "Links between cells strengthen when used together and weaken when they are not. In here, that is why two entries that keep appearing together are drawn closer." |
*
* @param {Landing_Theory_Synapse_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_synapse_body = /** @type {((inputs?: Landing_Theory_Synapse_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Synapse_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_synapse_body(inputs)
	return ko_landing_theory_synapse_body(inputs)
});