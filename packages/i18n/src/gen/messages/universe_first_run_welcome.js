/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_First_Run_WelcomeInputs */

const en_universe_first_run_welcome = /** @type {(inputs: Universe_First_Run_WelcomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It's still empty. Write your first diary, and a star is born here.`)
};

const ko_universe_first_run_welcome = /** @type {(inputs: Universe_First_Run_WelcomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 비어 있어요. 첫 일기를 적으면, 여기에 별 하나가 태어납니다.`)
};

/**
* | output |
* | --- |
* | "It's still empty. Write your first diary, and a star is born here." |
*
* @param {Universe_First_Run_WelcomeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_first_run_welcome = /** @type {((inputs?: Universe_First_Run_WelcomeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_First_Run_WelcomeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_first_run_welcome(inputs)
	return ko_universe_first_run_welcome(inputs)
});