/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Synapse_TitleInputs */

const en_landing_theory_synapse_title = /** @type {(inputs: Landing_Theory_Synapse_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Connections change with use`)
};

const ko_landing_theory_synapse_title = /** @type {(inputs: Landing_Theory_Synapse_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`연결은 쓰는 만큼 달라져요`)
};

/**
* | output |
* | --- |
* | "Connections change with use" |
*
* @param {Landing_Theory_Synapse_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_synapse_title = /** @type {((inputs?: Landing_Theory_Synapse_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Synapse_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_synapse_title(inputs)
	return ko_landing_theory_synapse_title(inputs)
});